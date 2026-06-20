import * as fs from "fs/promises";
import * as path from "path";
import { config, __dirname } from "./config.js";
import {
  getVaultWikiDir,
  listNoteTitles,
  parseMarkdownNote,
  findInboundLinks,
  listCollections,
  listOverviews,
} from "./utils.js";

/**
 * Wraps response data in the MCP JSON text content format.
 */
function jsonResponse(data: any) {
  return {
    content: [{ type: "text", text: JSON.stringify(data, null, 2) }],
  };
}

/**
 * Handles all tool call dispatching for the CallToolRequestSchema handler.
 */
export async function handleToolCall(name: string, args: Record<string, any>) {
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
  const vault_name = args?.vault_name;
  const wikiDir = getVaultWikiDir(vault_name);
  const actualVault = config.vaultMode === "single" ? config.vaultName : vault_name;

  switch (name) {
    case "get_topics": {
      const topics = await listNoteTitles(wikiDir, "topics");
      return jsonResponse({ vault: actualVault, topics });
    }

    case "get_topic_details": {
      const title = args.title;
      if (!title) throw new Error("Missing required argument: title");

      const safeFile = title.replace(/\s+/g, "_") + ".md";
      const filePath = path.join(wikiDir, "topics", safeFile);

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
        throw new Error(`Topic note not found: "${title}"`);
      }
    }

    case "get_summaries": {
      const summaries = await listNoteTitles(wikiDir, "summaries");
      return jsonResponse({ vault: actualVault, summaries });
    }

    case "get_summary": {
      const title = args.title;
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
      const title = args.title;
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

    case "get_collections": {
      const collections = await listCollections(wikiDir);
      return jsonResponse({ vault: actualVault, collections });
    }

    case "get_collection_items": {
      const collection = args.collection;
      if (!collection) throw new Error("Missing required argument: collection");

      const collections = await listCollections(wikiDir);
      if (!collections.includes(collection)) {
        throw new Error(`Collection not found: "${collection}"`);
      }

      const items = await listNoteTitles(wikiDir, collection);
      return jsonResponse({ vault: actualVault, collection, items });
    }

    case "get_collection_item": {
      const collection = args.collection;
      const title = args.title;
      if (!collection) throw new Error("Missing required argument: collection");
      if (!title) throw new Error("Missing required argument: title");

      const collections = await listCollections(wikiDir);
      if (!collections.includes(collection)) {
        throw new Error(`Collection not found: "${collection}"`);
      }

      const fileUnderscore = title.replace(/\s+/g, "_") + ".md";
      const fileSpace = title.replace(/_/g, " ") + ".md";
      let filePath = path.join(wikiDir, collection, fileUnderscore);
      try {
        await fs.access(filePath);
      } catch {
        filePath = path.join(wikiDir, collection, fileSpace);
      }

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
        throw new Error(`Collection item not found: "${collection}/${title}"`);
      }
    }

    case "get_overviews": {
      const overviews = await listOverviews(wikiDir);
      return jsonResponse({ vault: actualVault, overviews });
    }

    case "get_overview": {
      const title = args.title;
      if (!title) throw new Error("Missing required argument: title");

      const overviews = await listOverviews(wikiDir);
      if (!overviews.some((o) => o.toLowerCase() === title.toLowerCase())) {
        throw new Error(`Overview not found: "${title}"`);
      }

      const matchedOverview = overviews.find((o) => o.toLowerCase() === title.toLowerCase())!;
      const safeFile = matchedOverview + ".md";
      const filePath = path.join(wikiDir, safeFile);

      try {
        const parsed = await parseMarkdownNote(filePath);
        const inbound = await findInboundLinks(wikiDir, matchedOverview);

        return jsonResponse({
          title: parsed.metadata.title || matchedOverview,
          metadata: parsed.metadata,
          content: parsed.content,
          links: {
            outbound_links: parsed.links.outbound_links,
            inbound_links: inbound,
          },
        });
      } catch {
        throw new Error(`Overview not found: "${title}"`);
      }
    }

    default:
      throw new Error(`Tool handler not registered: ${name}`);
  }
}
