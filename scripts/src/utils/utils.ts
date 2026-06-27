import * as fs from 'fs/promises';
import * as fsSync from 'fs';
import * as path from 'path';
import matter from 'gray-matter';
import { config } from './config.js';
import { callAgenticModel } from './llm.js';

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
 * Standardizes a title into a safe lowercase, space-preserving markdown filename.
 * e.g., "Andrej Karpathy" -> "Andrej Karpathy.md"
 */
export function toSafeFilename(title: string): string {
  return title.trim().replace(/[\\/:*?"<>|]/g, "") + ".md";
}

/**
 * Parses a safe filename back into a clean display title/subject.
 * e.g., "Andrej Karpathy.md" -> "Andrej Karpathy"
 */
export function fromSafeFilename(filename: string): string {
  const base = path.basename(filename, ".md");
  return base.replace(/_/g, " ");
}

/**
 * Resolves the absolute path to a vault's root directory, supporting absolute/relative paths and vault names.
 */
export function getVaultDir(requestedVault?: string): string {
  const target = requestedVault || config.vaultName;
  if (!target) {
    throw new Error("Missing parameter: vault is required.");
  }
  if (path.isAbsolute(target)) {
    return target;
  }
  // Check if exists as a directory relative to the current working directory
  const relativePath = path.resolve(target);
  if (fsSync.existsSync(relativePath) && fsSync.statSync(relativePath).isDirectory()) {
    return relativePath;
  }
  return path.join(config.vaultsRoot, target);
}

/**
 * Resolves the absolute path to a specific vault's compiled wiki folder.
 */
export function getVaultWikiDir(requestedVault?: string): string {
  return path.join(getVaultDir(requestedVault), "wiki");
}

/**
 * Clean markdown code block formatting from response string.
 */
export function cleanMarkdownResponse(text: string): string {
  let cleaned = text.trim();
  if (cleaned.startsWith('```markdown')) {
    cleaned = cleaned.slice(11);
  } else if (cleaned.startsWith('```')) {
    cleaned = cleaned.slice(3);
  }
  if (cleaned.endsWith('```')) {
    cleaned = cleaned.slice(0, -3);
  }
  return cleaned.trim();
}

/**
 * Rebuilds the folder-level index.md file for a wiki directory.
 */
export function rebuildFolderIndex(wikiDir: string, folderName: string, header: string) {
  const dirPath = path.join(wikiDir, folderName);
  if (!fsSync.existsSync(dirPath)) return;
  const files = fsSync.readdirSync(dirPath);
  const items: [string, string, string][] = [];

  for (const filename of files) {
    if (!filename.endsWith('.md') || filename === 'index.md') continue;
    const filepath = path.join(dirPath, filename);
    try {
      const rawText = fsSync.readFileSync(filepath, 'utf8');
      const parsed = matter(rawText);
      const metadata = parsed.data || {};
      const filenameNoExt = path.basename(filename, '.md');
      const title = metadata.title || filenameNoExt;
      const desc = metadata.description || '';
      items.push([filenameNoExt, title, desc]);
    } catch {}
  }

  const indexPath = path.join(dirPath, 'index.md');
  if (items.length === 0) {
    if (fsSync.existsSync(indexPath)) fsSync.unlinkSync(indexPath);
    return;
  }

  // Sort items alphabetically (case-insensitive). If folder is 'persons', sort by last name first.
  if (folderName === 'persons') {
    items.sort((a, b) => {
      const getLastName = (name: string) => {
        const parts = name.trim().split(/\s+/);
        return parts[parts.length - 1] || name;
      };
      const lastNameA = getLastName(a[0]);
      const lastNameB = getLastName(b[0]);
      const cmp = lastNameA.localeCompare(lastNameB, undefined, { sensitivity: 'base', numeric: true });
      if (cmp !== 0) return cmp;
      return a[0].localeCompare(b[0], undefined, { sensitivity: 'base', numeric: true });
    });
  } else {
    items.sort((a, b) => a[0].localeCompare(b[0], undefined, { sensitivity: 'base', numeric: true }));
  }

  const lines = [`# ${header}\n`];
  for (const [nameNoExt, title, desc] of items) {
    const linkPart = title === nameNoExt ? `[[${nameNoExt}]]` : `[[${nameNoExt}|${title}]]`;
    if (desc) {
      lines.push(`* ${linkPart} - ${desc.trim()}`);
    } else {
      lines.push(`* ${linkPart}`);
    }
  }
  lines.push('');
  fsSync.writeFileSync(indexPath, lines.join('\n'), 'utf8');
}

/**
 * Shared logic to build or update downstream entity cards (Concepts or Persons).
 */
export async function generateEntityCard({
  entityName,
  entityType,
  vaultName,
  referenceSummaryPath,
  wikiDir,
  projectRootDir
}: {
  entityName: string;
  entityType: 'concept' | 'person';
  vaultName: string;
  referenceSummaryPath: string;
  wikiDir: string;
  projectRootDir: string;
}) {
  const folderName = entityType === 'concept' ? 'concepts' : 'persons';
  const entityFilename = toSafeFilename(entityName);
  const entityPath = path.join(wikiDir, folderName, entityFilename);

  const promptsDir = path.join(projectRootDir, 'scripts', 'prompts');
  const promptTemplate = fsSync.readFileSync(path.join(promptsDir, `${entityType}.md`), 'utf8');

  let existingContent = '';
  if (fsSync.existsSync(entityPath)) {
    existingContent = fsSync.readFileSync(entityPath, 'utf8');
  }

  let summaryContent = '';
  if (fsSync.existsSync(referenceSummaryPath)) {
    summaryContent = fsSync.readFileSync(referenceSummaryPath, 'utf8');
  } else {
    throw new Error(`Reference summary file '${referenceSummaryPath}' not found.`);
  }

  const schemaPath = path.join(getVaultDir(vaultName), 'schemas', `${entityType}.md`);
  const schemaContent = fsSync.existsSync(schemaPath) ? fsSync.readFileSync(schemaPath, 'utf8') : '';

  const prompt = promptTemplate
    .replace(/\$NAME/g, entityName)
    .replace('$EXISTING_CONTENT', existingContent || '(empty)')
    .replace('$SUMMARY_CONTENT', summaryContent)
    .replace('$SCHEMA', schemaContent);

  const typeLabel = entityType === 'concept' ? 'concept card' : 'person biography';
  console.log(`Calling agentic LLM model to build ${typeLabel}: ${entityName}...`);

  let responseText = await callAgenticModel([{ role: 'user', content: prompt }]);
  responseText = cleanMarkdownResponse(responseText);
  const entityDir = path.dirname(entityPath);
  if (!fsSync.existsSync(entityDir)) {
    fsSync.mkdirSync(entityDir, { recursive: true });
  }
  fsSync.writeFileSync(entityPath, responseText, 'utf8');
  console.log(`Success: Wrote ${entityType} file to ${entityPath}`);

  // Rebuild the index
  const indexHeader = entityType === 'concept' ? 'Concepts' : 'Persons';
  rebuildFolderIndex(wikiDir, folderName, indexHeader);
}

/**
 * Lists all parsed frontmatter objects from notes in a collection folder, filtered by presence of keys.
 */
export async function getAllFrontmatters(
  wikiDir: string,
  collection: string,
  keys?: string[]
): Promise<Array<{ title: string; frontmatter: any; filePath: string }>> {
  const dirPath = path.join(wikiDir, collection);
  const results: Array<{ title: string; frontmatter: any; filePath: string }> = [];

  try {
    const files = await fs.readdir(dirPath);
    for (const file of files) {
      if (!file.endsWith(".md") || file === 'index.md') continue;
      const filePath = path.join(dirPath, file);
      try {
        const rawText = await fs.readFile(filePath, "utf-8");
        const parsed = matter(rawText);
        const metadata = parsed.data || {};
        const title = metadata.title || metadata.name || fromSafeFilename(file);

        if (keys && keys.length > 0) {
          const hasMatchingKey = keys.some(key => {
            const val = metadata[key];
            if (val === undefined || val === null || val === "") return false;
            if (Array.isArray(val) && val.length === 0) return false;
            return true;
          });
          if (!hasMatchingKey) continue;
        }

        results.push({
          title,
          frontmatter: metadata,
          filePath
        });
      } catch {
        // Ignore unreadable or poorly formatted markdown files
      }
    }
  } catch {
    // Directory might not exist yet, return empty list
  }

  return results;
}
