import * as fs from 'fs';
import * as fsPromises from 'fs/promises';
import * as path from 'path';
import * as readline from 'readline';
import matter from 'gray-matter';
import YAML from 'yaml';
import { config } from './config.js';
import { gitCommit } from './git.js';

/**
 * Resolves the absolute path to a vault's root directory, supporting absolute/relative paths and vault names.
 */
export function getVaultDir(requestedVault?: string): string {
  const target = requestedVault || config.vaultName;
  if (!target) {
    throw new Error('Missing parameter: vault is required.');
  }
  if (path.isAbsolute(target)) {
    return target;
  }
  // If the target explicitly looks like a path (starts with . or contains a path separator), resolve it directly
  if (target.startsWith('.') || target.includes('/') || target.includes('\\')) {
    return path.resolve(target);
  }
  const relativePath = path.resolve(target);
  if (fs.existsSync(relativePath) && fs.statSync(relativePath).isDirectory()) {
    return relativePath;
  }
  return path.join(config.vaultsRoot, target);
}

/**
 * Resolves the absolute path to a specific vault's compiled wiki folder.
 */
export function getVaultWikiDir(requestedVault?: string): string {
  return path.join(getVaultDir(requestedVault), 'wiki');
}

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
  if (!content) return '';
  return content.replace(/\[\[([^\]|]+)(?:\|([^\]]+))?\]\]/g, (match, p1, p2) => {
    return p2 || p1;
  });
}

/**
 * Standardizes a title into a safe lowercase, space-preserving markdown filename.
 * e.g., "Andrej Karpathy" -> "Andrej Karpathy.md"
 */
export function toSafeFilename(title: string): string {
  return title.trim().replace(/[\\/:*?"<>|]/g, '') + '.md';
}

/**
 * Parses a safe filename back into a clean display title/subject.
 * e.g., "Andrej Karpathy.md" -> "Andrej Karpathy"
 */
export function fromSafeFilename(filename: string): string {
  const base = path.basename(filename, '.md');
  return base.replace(/_/g, ' ');
}

/**
 * Clean markdown code block formatting from response string.
 */
export function cleanMarkdownResponse(text: string): string {
  let cleaned = text.trim();
  cleaned = cleaned.replace(/^```[a-zA-Z]*\n/, '');
  cleaned = cleaned.replace(/\n```$/, '');
  return cleaned.trim();
}

/**
 * High-performance line-buffered YAML frontmatter stream reader.
 * Reads strictly until the second --- marker is encountered.
 */
export async function readFrontmatter(filePath: string): Promise<any> {
  if (!fs.existsSync(filePath)) {
    return {};
  }
  try {
    const fileStream = fs.createReadStream(filePath, { encoding: 'utf8' });
    const rl = readline.createInterface({ input: fileStream, crlfDelay: Infinity });

    let inYaml = false;
    const yamlLines: string[] = [];

    for await (const line of rl) {
      const trimmed = line.trim();
      if (trimmed === '---') {
        if (!inYaml) {
          inYaml = true;
        } else {
          break;
        }
      } else if (inYaml) {
        yamlLines.push(line);
      }
    }
    rl.close();
    fileStream.close();

    if (yamlLines.length === 0) return {};
    const cleanYaml = yamlLines.filter(line => !line.trim().startsWith('```')).join('\n');
    return YAML.parse(cleanYaml) || {};
  } catch (e) {
    // Fallback if parsing fails or stream error
    try {
      const content = fs.readFileSync(filePath, 'utf8');
      const parsed = matter(content);
      return parsed.data || {};
    } catch {
      return {};
    }
  }
}

/**
 * Rebuilds the folder-level index.md file for a wiki directory.
 */
export async function rebuildFolderIndex(wikiDir: string, relativeFolderPath: string, header: string): Promise<void> {
  const dirPath = path.join(wikiDir, relativeFolderPath);
  if (!fs.existsSync(dirPath)) return;
  const files = await fsPromises.readdir(dirPath);
  const items: [string, string, string][] = [];

  const folderName = path.basename(relativeFolderPath);
  for (const filename of files) {
    if (!filename.endsWith('.md') || filename === 'index.md' || filename === `${folderName}-cloud.md` || filename === `${folderName}-cloud-fullscreen.md`) continue;
    const filepath = path.join(dirPath, filename);
    try {
      const metadata = await readFrontmatter(filepath);
      const filenameNoExt = path.basename(filename, '.md');
      const title = metadata.title || filenameNoExt;
      const desc = metadata.description || '';
      items.push([filenameNoExt, title, desc]);
    } catch {}
  }

  const indexPath = path.join(dirPath, 'index.md');
  if (items.length === 0) {
    if (fs.existsSync(indexPath)) {
      fs.writeFileSync(
        indexPath,
        `---\ntitle: "${header} Index"\n---\n# ${header} Index\n\nNo items available.\n`,
        'utf8'
      );
    }
    return;
  }

  // Sort items alphabetically. If folder is 'persons' or 'person', sort by last name first.
  if (folderName === 'person' || folderName === 'persons') {
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

  const isCollection = relativeFolderPath.startsWith('collections/') || relativeFolderPath.startsWith('collections\\');
  const titleCapitalized = folderName.charAt(0).toUpperCase() + folderName.slice(1);

  if (isCollection) {
    // Generate and write relation clouds
    const cloudPath = path.join(dirPath, `${folderName}-cloud.md`);
    const cloudFullscreenPath = path.join(dirPath, `${folderName}-cloud-fullscreen.md`);
    const timestampStr = new Date().toISOString().replace(/\.\d{3}Z$/, 'Z');
    
    const cloudContent = `---
type: "Overview"
title: "${titleCapitalized} Relation Cloud"
description: "Interactive graph linking ${folderName} cards sharing common tags."
timestamp: "${timestampStr}"
hide:
  - navigation
  - toc
---
# ${titleCapitalized} Relation Cloud

<div class="graph-search-container"><div class="search-input-wrapper"><input type="text" id="graph-search" placeholder="Search ${folderName} by name or tag..." autocomplete="off"><button id="search-clear" class="search-clear-btn" type="button">&times;</button></div></div>

<div id="cy-fullscreen" data-collection="${folderName}"></div>

<p class="graph-hint">💡 Note: Only showing ${folderName} with more than 1 shared tags.</p>
`;
    fs.writeFileSync(cloudPath, cloudContent, 'utf8');
    gitCommit(cloudPath, `Updated ${folderName}-cloud overview page`);

    if (fs.existsSync(cloudFullscreenPath)) {
      try {
        fs.unlinkSync(cloudFullscreenPath);
        gitCommit(cloudFullscreenPath, `Deleted obsolete ${folderName}-cloud-fullscreen overview page`);
      } catch (e: any) {
        console.warn(`Failed to clean up ${cloudFullscreenPath}:`, e.message);
      }
    }
  }

  const lines = [
    `---`,
    `title: "${header} Index"`,
    `---`,
    `# ${header} Index\n`,
  ];
  if (isCollection) {
    lines.push(`- [[${folderName}-cloud|${titleCapitalized} Relation Cloud ↗]]\n`);
  }
  lines.push(`## List of Items\n`);
  for (const [nameNoExt, title, desc] of items) {
    const linkPart = title === nameNoExt ? `[[${nameNoExt}]]` : `[[${nameNoExt}|${title}]]`;
    if (desc) {
      lines.push(`* ${linkPart} - ${desc.trim()}`);
    } else {
      lines.push(`* ${linkPart}`);
    }
  }
  lines.push('');
  fs.writeFileSync(indexPath, lines.join('\n'), 'utf8');
  gitCommit(indexPath, `Updated index for ${relativeFolderPath}`);
}

/**
 * Generates the tags.md page with the MkDocs Material tags index marker.
 * This enables clickable tag pills on entity pages and a central tags overview.
 */
export function rebuildTagsPage(wikiDir: string): void {
  const tagsPath = path.join(wikiDir, 'tags.md');
  const content = `---
title: "Tags"
---
# Tags

Browse all tags used across the wiki:

<!-- material/tags -->
`;
  fs.writeFileSync(tagsPath, content, 'utf8');
  gitCommit(tagsPath, 'Updated tags overview page');
  console.log(`Created/updated tags page at ${tagsPath}`);
}

/**
 * Rebuilds the root index.md file listing all folders and overview pages dynamically.
 */
export async function rebuildWikiRootIndex(wikiDir: string): Promise<void> {
  const indexPath = path.join(wikiDir, 'index.md');
  const vaultNameResolved = path.basename(path.dirname(wikiDir));

  // Dynamically inspect collections, summaries, overviews
  const listItems: string[] = [];

  const collectionsDir = path.join(wikiDir, 'collections');
  if (fs.existsSync(collectionsDir)) {
    const collectionFolders = fs.readdirSync(collectionsDir).filter(f => {
      return fs.statSync(path.join(collectionsDir, f)).isDirectory();
    });
    for (const folder of collectionFolders) {
      const headerName = folder.charAt(0).toUpperCase() + folder.slice(1);
      listItems.push(`- [[collections/${folder}/index|${headerName}]]`);
    }
  }

  if (fs.existsSync(path.join(wikiDir, 'summaries'))) {
    listItems.push(`- [[summaries/index|Summaries]]`);
  }

  const overviewsDir = path.join(wikiDir, 'overviews');
  if (fs.existsSync(overviewsDir)) {
    listItems.push(`- [[overviews/index|Overviews]]`);
  }

  if (fs.existsSync(path.join(wikiDir, 'tags.md'))) {
    listItems.push(`- [[tags|Tags]]`);
  }

  // Sort list items alphabetically
  listItems.sort((a, b) => a.localeCompare(b));

  const indexContent = `---
type: "Overview"
title: "${vaultNameResolved} Wiki"
description: "Home page for the ${vaultNameResolved} wiki."
timestamp: "${new Date().toISOString().replace(/\.\d{3}Z$/, 'Z')}"
---
# ${vaultNameResolved} Wiki

Welcome to the wiki. Browse the available pages:

${listItems.join('\n')}
`;

  fs.writeFileSync(indexPath, indexContent, 'utf8');
  gitCommit(indexPath, 'Updated wiki index');
  console.log(`Created/updated base wiki index at ${indexPath}`);
}
