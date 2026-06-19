import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";
import * as fs from "fs/promises";
import * as path from "path";
import { fileURLToPath } from "url";
import matter from "gray-matter";

// Emulate __dirname for ES Modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// 1. Configuration Interface
interface McpConfig {
  vaultMode: "all" | "single";
  vaultName: string;
  vaultsRoot: string;
}

let config: McpConfig = {
  vaultMode: "all",
  vaultName: "LLM-Wiki",
  vaultsRoot: "../Vaults",
};

// Parse command line arguments for configuration
function parseArgs() {
  const args = process.argv.slice(2);
  let vaultSpecified = false;

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg.startsWith("--vault=")) {
      config.vaultName = arg.split("=")[1];
      vaultSpecified = true;
    } else if (arg === "--vault" && i + 1 < args.length) {
      config.vaultName = args[++i];
      vaultSpecified = true;
    } else if (arg.startsWith("--vaults-root=")) {
      config.vaultsRoot = arg.split("=")[1];
    } else if (arg === "--vaults-root" && i + 1 < args.length) {
      config.vaultsRoot = args[++i];
    }
  }

  // If a specific vault is provided, implicitly run in single-vault mode
  config.vaultMode = vaultSpecified ? "single" : "all";

  console.error(`MCP Server started. Mode: ${config.vaultMode}, Target Vault: ${config.vaultName}, Root: ${config.vaultsRoot}`);
}

// 2. Helper Utilities for Markdown Parsing and Path/Link Sanitization

/**
 * Strips brackets and aliases from Obsidian wikilinks:
 * [[Alan Turing]] -> "Alan Turing"
 * [[Alan Turing|Turing]] -> "Alan Turing"
 */
export function sanitizeWikilinks(text: string): string[] {
  if (!text) return [];
  const links: string[] = [];
  const regex = /\[\[([^\]|]+)(?:\|[^\]]+)?\]\]/g;
  let match;
  while ((match = regex.exec(text)) !== null) {
    links.push(match[1].trim());
  }
  return Array.from(new Set(links));
}

/**
 * Strips bracket wrappers from text content so LLM reads plain prose
 */
export function cleanContentBody(content: string): string {
  if (!content) return "";
  return content.replace(/\[\[([^\]|]+)(?:\|([^\]]+))?\]\]/g, (match, p1, p2) => {
    return p2 || p1;
  });
}

/**
 * Validates and resolves the absolute path to a specific vault's compiled wiki folder.
 * Resolves both absolute and relative vaultsRoot paths.
 */
export function getVaultWikiDir(requestedVault?: string): string {
  // In single-vault mode, always ignore the requestedVault and use the configured vaultName
  const targetVault = config.vaultMode === "single" ? config.vaultName : requestedVault;

  if (!targetVault) {
    throw new Error("Missing parameter: vault_name is required in multi-vault mode.");
  }

  // Resolve vaultsRoot relative to script directory
  const rootDir = path.isAbsolute(config.vaultsRoot)
    ? config.vaultsRoot
    : path.resolve(__dirname, "..", config.vaultsRoot);

  return path.join(rootDir, targetVault, "wiki");
}

/**
 * Reads a markdown file, extracts YAML frontmatter, cleans body text, and harvests outbound wikilinks.
 */
export async function parseMarkdownNote(filePath: string) {
  const rawText = await fs.readFile(filePath, "utf-8");
  const { data: metadata, content: rawBody } = matter(rawText);
  const cleanBody = cleanContentBody(rawBody);
  const outboundLinks = sanitizeWikilinks(rawBody);

  return {
    metadata: metadata || {},
    content: cleanBody.trim(),
    links: {
      outbound_links: outboundLinks,
    },
  };
}

/**
 * Searches all markdown files in a vault to discover inbound wikilinks targeting a specific node name.
 */
export async function findInboundLinks(wikiDir: string, targetName: string): Promise<string[]> {
  const folders = ["concepts", "persons", "summaries", "reports"];
  const inboundLinks: string[] = [];
  const normalizedTarget = targetName.toLowerCase();

  for (const folder of folders) {
    const dirPath = path.join(wikiDir, folder);
    try {
      const files = await fs.readdir(dirPath);
      for (const file of files) {
        if (!file.endsWith(".md")) continue;
        if (file === "index.md") continue;
        const filePath = path.join(dirPath, file);
        const rawContent = await fs.readFile(filePath, "utf-8");
        const outlinks = sanitizeWikilinks(rawContent);

        if (outlinks.some((link) => link.toLowerCase() === normalizedTarget)) {
          // Harvest the title/subject of the referencing file
          const parsed = matter(rawContent);
          const title = parsed.data.title || parsed.data.name || path.basename(file, ".md").replace(/_/g, " ");
          inboundLinks.push(title);
        }
      }
    } catch {
      // Folder might not exist, skip gracefully
    }
  }
  return Array.from(new Set(inboundLinks));
}

/**
 * Parses connection registry table inside social-graph.md to map connections for a given individual.
 */
export async function parseConnections(wikiDir: string, personName: string) {
  const connections: Array<{ target: string; relationship: string; context: string }> = [];
  try {
    const socialGraphPath = path.join(wikiDir, "social-graph.md");
    const rawContent = await fs.readFile(socialGraphPath, "utf-8");
    const lines = rawContent.split("\n");

    const normalizedPerson = personName.toLowerCase();

    for (const line of lines) {
      if (!line.startsWith("|") || line.includes("---|") || line.includes("Person A")) continue;

      const cells = line.split("|").map(c => c.trim()).filter(Boolean);
      if (cells.length < 3) continue;

      const personA = sanitizeWikilinks(cells[0])[0] || cells[0];
      const rel = cells[1];
      const personB = sanitizeWikilinks(cells[2])[0] || cells[2];
      const context = cells[3] || "";

      if (personA.toLowerCase() === normalizedPerson) {
        connections.push({
          target: personB,
          relationship: rel,
          context: cleanContentBody(context),
        });
      } else if (personB.toLowerCase() === normalizedPerson) {
        connections.push({
          target: personA,
          relationship: `${rel} (Reciprocal)`,
          context: cleanContentBody(context),
        });
      }
    }
  } catch (err: any) {
    console.error("Error reading social-graph connections:", err.message);
  }
  return connections;
}

/**
 * Safely lists titles of markdown files inside a vault subdirectory
 */
export async function listNoteTitles(wikiDir: string, subfolder: string): Promise<Array<{ title: string }>> {
  const dirPath = path.join(wikiDir, subfolder);
  try {
    const files = await fs.readdir(dirPath);
    const titles: Array<{ title: string }> = [];

    for (const file of files) {
      if (!file.endsWith(".md")) continue;
      if (file === "index.md") continue;
      const filePath = path.join(dirPath, file);
      const rawText = await fs.readFile(filePath, "utf-8");
      const parsed = matter(rawText);
      const title = parsed.data.title || parsed.data.name || path.basename(file, ".md").replace(/_/g, " ");
      titles.push({ title });
    }
    return titles;
  } catch {
    return [];
  }
}

// 3. Initialize MCP Server
const server = new Server(
  {
    name: "mycelium-mind-mcp",
    version: "1.0.0",
  },
  {
    capabilities: {
      tools: {},
    },
  }
);

// 4. Declare Tools to Client
server.setRequestHandler(ListToolsRequestSchema, async () => {
  const vaultNameProp = {
    type: "string",
    description: config.vaultMode === "single" 
      ? "Optional and ignored. Defaults strictly to configured vault."
      : "Required. The name of the target vault.",
  };

  const tools = [];

  // Expose get_vaults ONLY in multi-vault ("all") mode
  if (config.vaultMode === "all") {
    tools.push({
      name: "get_vaults",
      description: "Discovers and lists all configured vaults in the Mycelium Mind environment.",
      inputSchema: { type: "object", properties: {} },
    });
  }

  tools.push(
    {
      name: "get_persons",
      description: "Lists all registered individuals/biographies in the specified vault.",
      inputSchema: {
        type: "object",
        properties: { vault_name: vaultNameProp },
        required: config.vaultMode === "all" ? ["vault_name"] : [],
      },
    },
    {
      name: "get_person_details",
      description: "Retrieves complete biography, metadata, clean links, and social graph connections for a person.",
      inputSchema: {
        type: "object",
        properties: {
          vault_name: vaultNameProp,
          name: { type: "string", description: "The name of the person (e.g. 'Alan Turing')" },
        },
        required: config.vaultMode === "all" ? ["vault_name", "name"] : ["name"],
      },
    },
    {
      name: "get_concepts",
      description: "Lists all conceptual topic nodes in the specified vault.",
      inputSchema: {
        type: "object",
        properties: { vault_name: vaultNameProp },
        required: config.vaultMode === "all" ? ["vault_name"] : [],
      },
    },
    {
      name: "get_concept_details",
      description: "Retrieves metadata, content, and inbound/outbound links for a conceptual node.",
      inputSchema: {
        type: "object",
        properties: {
          vault_name: vaultNameProp,
          title: { type: "string", description: "The title of the concept (e.g. 'Enigma Machine')" },
        },
        required: config.vaultMode === "all" ? ["vault_name", "title"] : ["title"],
      },
    },
    {
      name: "get_timeline",
      description: "Returns chronological events between two dates with clean source references.",
      inputSchema: {
        type: "object",
        properties: {
          vault_name: vaultNameProp,
          start_date: { type: "string", description: "Start date YYYY-MM-DD or partial YYYY (inclusive)" },
          end_date: { type: "string", description: "End date YYYY-MM-DD or partial YYYY (inclusive)" },
        },
        required: config.vaultMode === "all" 
          ? ["vault_name", "start_date", "end_date"]
          : ["start_date", "end_date"],
      },
    },
    {
      name: "get_summaries",
      description: "Lists all ingested document summaries in the specified vault.",
      inputSchema: {
        type: "object",
        properties: { vault_name: vaultNameProp },
        required: config.vaultMode === "all" ? ["vault_name"] : [],
      },
    },
    {
      name: "get_summary",
      description: "Retrieves complete content, clean wikilinks, metadata, and original source asset titles for an entry.",
      inputSchema: {
        type: "object",
        properties: {
          vault_name: vaultNameProp,
          title: { type: "string", description: "The title of the summary" },
        },
        required: config.vaultMode === "all" ? ["vault_name", "title"] : ["title"],
      },
    },
    {
      name: "get_reports",
      description: "Lists all compiled cross-vault thematic reports in the specified vault.",
      inputSchema: {
        type: "object",
        properties: { vault_name: vaultNameProp },
        required: config.vaultMode === "all" ? ["vault_name"] : [],
      },
    },
    {
      name: "get_report",
      description: "Retrieves comprehensive synthesis report content and clean links.",
      inputSchema: {
        type: "object",
        properties: {
          vault_name: vaultNameProp,
          title: { type: "string", description: "The title of the report" },
        },
        required: config.vaultMode === "all" ? ["vault_name", "title"] : ["title"],
      },
    },
  );

  return { tools };
});

// 5. Handle Tool Executions
server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;

  // Utility to map response format
  const jsonResponse = (data: any) => ({
    content: [{ type: "text", text: JSON.stringify(data, null, 2) }],
  });

  try {
    // General discovery tool
    if (name === "get_vaults") {
      if (config.vaultMode === "single") {
        throw new Error("Tool 'get_vaults' is disabled in single-vault mode.");
      }

      const rootDir = path.isAbsolute(config.vaultsRoot)
        ? config.vaultsRoot
        : path.resolve(__dirname, "..", config.vaultsRoot);

      try {
        const dirs = await fs.readdir(rootDir, { withFileTypes: true });
        const vaults = dirs
          .filter((d) => d.isDirectory() && !d.name.startsWith("."))
          .map((d) => ({ name: d.name }));
        return jsonResponse({ vaults });
      } catch (err: any) {
        throw new Error(`Failed to list vaults at ${rootDir}: ${err.message}`);
      }
    }

    // Vault-Specific Queries
    const vault_name = (args as any)?.vault_name;
    const wikiDir = getVaultWikiDir(vault_name);
    const actualVault = config.vaultMode === "single" ? config.vaultName : vault_name;

    switch (name) {
      case "get_persons": {
        const persons = await listNoteTitles(wikiDir, "persons");
        // Format to match specification schema: { name: '...' }
        const formatted = persons.map((p) => ({ name: p.title }));
        return jsonResponse({ vault: actualVault, persons: formatted });
      }

      case "get_person_details": {
        const targetName = (args as any).name;
        if (!targetName) throw new Error("Missing required argument: name");

        // Format name to match Mycelium Mind file conventions (e.g. "Alan Turing" -> "Alan_Turing.md")
        const safeFile = targetName.replace(/\s+/g, "_") + ".md";
        const personFilePath = path.join(wikiDir, "persons", safeFile);

        try {
          const parsed = await parseMarkdownNote(personFilePath);
          const inbound = await findInboundLinks(wikiDir, targetName);
          const connections = await parseConnections(wikiDir, targetName);

          return jsonResponse({
            name: parsed.metadata.name || targetName,
            metadata: parsed.metadata,
            bio: parsed.content,
            links: {
              outbound_links: parsed.links.outbound_links,
              inbound_links: inbound,
            },
            social_graph: {
              connections,
            },
          });
        } catch {
          throw new Error(`Person profile not found: "${targetName}". Make sure it is spelled exactly as titled.`);
        }
      }

      case "get_concepts": {
        const concepts = await listNoteTitles(wikiDir, "concepts");
        return jsonResponse({ vault: actualVault, concepts });
      }

      case "get_concept_details": {
        const title = (args as any).title;
        if (!title) throw new Error("Missing required argument: title");

        const safeFile = title.replace(/\s+/g, "_") + ".md";
        const filePath = path.join(wikiDir, "concepts", safeFile);

        try {
          const parsed = await parseMarkdownNote(filePath);
          const inbound = await findInboundLinks(wikiDir, title);

          return jsonResponse({
            title: parsed.metadata.title || title,
            metadata: parsed.metadata,
            content: parsed.content,
            links: {
              outbound_links: parsed.links.outbound_links,
              inbound_links: inbound,
            },
          });
        } catch {
          throw new Error(`Concept note not found: "${title}"`);
        }
      }

      case "get_summaries": {
        const summaries = await listNoteTitles(wikiDir, "summaries");
        return jsonResponse({ vault: actualVault, summaries });
      }

      case "get_summary": {
        const title = (args as any).title;
        if (!title) throw new Error("Missing required argument: title");

        const safeFile = title.replace(/\s+/g, "_") + ".md";
        const filePath = path.join(wikiDir, "summaries", safeFile);

        try {
          const parsed = await parseMarkdownNote(filePath);
          const inbound = await findInboundLinks(wikiDir, title);

          // Extract source files references if defined in metadata
          const sourcesRaw = parsed.metadata.sources || parsed.metadata.source || [];
          const sourceAssets = (Array.isArray(sourcesRaw) ? sourcesRaw : [sourcesRaw])
            .map((s: string) => path.basename(s));

          return jsonResponse({
            title: parsed.metadata.title || title,
            metadata: parsed.metadata,
            content: parsed.content,
            source_assets: sourceAssets,
            links: {
              outbound_links: parsed.links.outbound_links,
              inbound_links: inbound,
            },
          });
        } catch {
          throw new Error(`Summary entry not found: "${title}"`);
        }
      }

      case "get_reports": {
        const reports = await listNoteTitles(wikiDir, "reports");
        return jsonResponse({ vault: actualVault, reports });
      }

      case "get_report": {
        const title = (args as any).title;
        if (!title) throw new Error("Missing required argument: title");

        const safeFile = title.replace(/\s+/g, "_") + ".md";
        const filePath = path.join(wikiDir, "reports", safeFile);

        try {
          const parsed = await parseMarkdownNote(filePath);
          const inbound = await findInboundLinks(wikiDir, title);

          return jsonResponse({
            title: parsed.metadata.title || title,
            metadata: parsed.metadata,
            content: parsed.content,
            links: {
              outbound_links: parsed.links.outbound_links,
              inbound_links: inbound,
            },
          });
        } catch {
          throw new Error(`Thematic report not found: "${title}"`);
        }
      }

      case "get_timeline": {
        const startDate = (args as any).start_date;
        const endDate = (args as any).end_date;

        if (!startDate || !endDate) {
          throw new Error("Missing temporal bounds. Both start_date and end_date are required.");
        }

        const startVal = new Date(startDate).getTime();
        const endVal = new Date(endDate).getTime();

        if (isNaN(startVal) || isNaN(endVal)) {
          throw new Error("Invalid date range format. Use YYYY-MM-DD or YYYY.");
        }

        // Parse master timeline.md file
        const timelinePath = path.join(wikiDir, "timeline.md");
        const events: Array<{ date: string; description: string; links: string[]; source_asset_title?: string }> = [];

        try {
          const rawText = await fs.readFile(timelinePath, "utf-8");
          const lines = rawText.split("\n");

          // Bulletproof regex search for YYYY-MM-DD or YYYY dates
          const dateRegex = /\b(\d{4})(?:-(\d{2})-(\d{2}))?\b/;

          for (const line of lines) {
            const trimmed = line.trim();
            if (!trimmed || trimmed.startsWith("#") || trimmed.startsWith("_")) continue;

            const match = dateRegex.exec(trimmed);
            if (!match) continue;

            const fullMatchDate = match[0];
            const eventTime = new Date(fullMatchDate).getTime();

            if (isNaN(eventTime)) continue;

            // Date boundary check
            if (eventTime >= startVal && eventTime <= endVal) {
              const cleanLine = cleanContentBody(trimmed);
              const links = sanitizeWikilinks(trimmed);

              // Attempt to scrape source asset title if logged
              const assetMatch = /\b(source:\s*)?([a-zA-Z0-9_\-\.]+\.(?:pdf|png|jpg|jpeg|txt|md))\b/i.exec(trimmed);
              const assetTitle = assetMatch ? assetMatch[2] : undefined;

              // Extract clean description text (excluding date marker and source markers)
              let desc = cleanLine.replace(fullMatchDate, "").replace(/^[:\s\-\*\|]+/, "").trim();
              if (assetTitle) {
                desc = desc.replace(new RegExp(`\\(?source:\\s*${assetTitle}\\)?`, "i"), "").trim();
                desc = desc.replace(new RegExp(`\\(?${assetTitle}\\)?`, "i"), "").trim();
              }

              events.push({
                date: fullMatchDate,
                description: desc,
                links,
                source_asset_title: assetTitle,
              });
            }
          }
        } catch {
          // If timeline.md is missing or failed, return empty array gracefully
        }

        return jsonResponse({
          vault: actualVault,
          range: { start: startDate, end: endDate },
          events,
        });
      }

      default:
        throw new Error(`Tool handler not registered: ${name}`);
    }
  } catch (error: any) {
    return {
      isError: true,
      content: [{ type: "text", text: JSON.stringify({ error: error.message }, null, 2) }],
    };
  }
});

// 6. Bootstrap stdio Server Transport
async function main() {
  parseArgs();
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error("Mycelium Mind MCP Server successfully running on stdio.");
}

main().catch((err) => {
  console.error("Critical MCP server startup failure:", err);
  process.exit(1);
});
