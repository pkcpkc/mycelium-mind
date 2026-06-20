import * as fs from "fs/promises";
import * as path from "path";
import matter from "gray-matter";
import { config, __dirname } from "./config.js";

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
  const inboundLinks: string[] = [];
  const normalizedTarget = targetName.toLowerCase();

  try {
    const entries = await fs.readdir(wikiDir, { withFileTypes: true });
    const folders = entries
      .filter((entry) => entry.isDirectory() && !entry.name.startsWith("."))
      .map((entry) => entry.name);

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
  } catch {
    // Ignore readdir failure
  }
  return Array.from(new Set(inboundLinks));
}

/**
 * Lists all non-core subdirectories in the wiki directory to discover collections.
 */
export async function listCollections(wikiDir: string): Promise<string[]> {
  try {
    const entries = await fs.readdir(wikiDir, { withFileTypes: true });
    return entries
      .filter(
        (entry) =>
          entry.isDirectory() &&
          !["topics", "summaries", "reports", "assets"].includes(entry.name) &&
          !entry.name.startsWith(".")
      )
      .map((entry) => entry.name);
  } catch {
    return [];
  }
}

/**
 * Lists all root-level markdown files (excluding index.md) to discover overviews.
 */
export async function listOverviews(wikiDir: string): Promise<string[]> {
  try {
    const entries = await fs.readdir(wikiDir, { withFileTypes: true });
    return entries
      .filter(
        (entry) =>
          entry.isFile() &&
          entry.name.endsWith(".md") &&
          entry.name !== "index.md" &&
          !entry.name.startsWith(".")
      )
      .map((entry) => path.basename(entry.name, ".md"));
  } catch {
    return [];
  }
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
