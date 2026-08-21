import * as fs from 'fs';
import * as path from 'path';
import YAML from 'yaml';

// Regex patterns
export const wikilinkRe = /\[\[([^\]]+)\]\]/g;
export const stdLinkRe = /\[([^\]]+)\]\(((?!(?:https?:\/\/|mailto:))[^)]+?\.md)(#[^)]*)?\)/g;

/**
 * Builds a file name-to-path index for fuzzy link rewriting.
 */
export function buildDocsFileMap(docsDir: string): Record<string, string> {
  const fileMap: Record<string, string> = {};

  function walk(dir: string) {
    const files = fs.readdirSync(dir);
    for (const file of files) {
      const fullPath = path.join(dir, file);
      const stat = fs.statSync(fullPath);
      if (stat.isDirectory()) {
        walk(fullPath);
      } else if (file.endsWith('.md')) {
        const relPath = path.relative(docsDir, fullPath);
        const relPathNorm = relPath.replace(/\\/g, '/');
        const basename = path.basename(file, '.md');
        const basenameLower = basename.toLowerCase();

        if (basenameLower === 'index') {
          if (relPathNorm === 'index.md') {
            fileMap[basenameLower] = relPath;
          }
          const parentDir = path.dirname(relPathNorm);
          if (parentDir !== '.') {
            fileMap[parentDir.toLowerCase()] = relPath;
            fileMap[`${parentDir}/index`.toLowerCase()] = relPath;
          }
        } else {
          fileMap[basenameLower] = relPath;
          const relPathNoExt = relPathNorm.slice(0, -3);
          fileMap[relPathNoExt.toLowerCase()] = relPath;
        }
      }
    }
  }

  walk(docsDir);
  return fileMap;
}

/**
 * Finds the closest matching relative document path from the fileMap.
 */
export function findFuzzyMatch(targetLower: string, fileMap: Record<string, string>): string | null {
  if (!targetLower) return null;
  if (fileMap[targetLower]) return fileMap[targetLower];
  const keys = Object.keys(fileMap).sort((a, b) => b.length - a.length);
  for (const k of keys) {
    if (k.length >= 3 && targetLower.length >= 3) {
      if (targetLower.startsWith(k) || k.startsWith(targetLower)) {
        return fileMap[k];
      }
    }
  }
  return null;
}

/**
 * Rewrites wikilinks [[...]] and standard Markdown relative links [...](...md) into HTML/relative MkDocs links.
 */
export function rewriteMarkdownLinks(
  content: string,
  filePath: string,
  docsDir: string,
  fileMap: Record<string, string>
): string {
  const currentDirAbs = path.dirname(filePath);

  let newContent = content.replace(wikilinkRe, (match, linkContent) => {
    let targetPart = '';
    let label = '';
    if (linkContent.includes('|')) {
      const parts = linkContent.split('|');
      targetPart = parts[0];
      label = parts[1];
    } else {
      targetPart = linkContent;
    }

    let target = '';
    let anchorPart = '';
    if (targetPart.includes('#')) {
      const parts = targetPart.split('#');
      target = parts[0];
      anchorPart = `#${parts[1]}`;
    } else {
      target = targetPart;
    }

    const targetClean = target.trim();
    const targetLower = targetClean.toLowerCase();
    const targetRelPath = findFuzzyMatch(targetLower, fileMap);

    if (targetRelPath) {
      const targetAbsPath = path.join(docsDir, targetRelPath);
      const relPath = path.relative(currentDirAbs, targetAbsPath);
      const urlPath = relPath.replace(/\\/g, '/');

      if (!label) {
        label = anchorPart ? `${targetClean} > ${anchorPart.slice(1)}` : targetClean;
      }
      return `[${label.trim()}](${urlPath}${anchorPart})`;
    } else {
      if (targetClean.startsWith('#')) {
        if (!label) label = targetClean.slice(1);
        return `[${label.trim()}](${targetClean})`;
      }
      return label ? label.trim() : targetClean;
    }
  });

  newContent = newContent.replace(stdLinkRe, (match, label, pathPart, anchorPart = '') => {
    let cleanedPath = pathPart;
    if (cleanedPath.startsWith('wiki/')) {
      cleanedPath = cleanedPath.slice(5);
    } else if (cleanedPath.startsWith('./wiki/')) {
      cleanedPath = cleanedPath.slice(7);
    }

    let pathRelativeToDocs = cleanedPath;
    if (cleanedPath.startsWith('.')) {
      const currentFileDirFromDocs = path.relative(docsDir, currentDirAbs);
      pathRelativeToDocs = path.join(currentFileDirFromDocs, cleanedPath);
    }
    const relPathNoExt = pathRelativeToDocs.endsWith('.md') ? pathRelativeToDocs.slice(0, -3) : pathRelativeToDocs;
    const relPathLower = relPathNoExt.toLowerCase().replace(/\\/g, '/');
    let targetRelPath = findFuzzyMatch(relPathLower, fileMap);

    if (!targetRelPath) {
      const baseNameWithExt = path.basename(cleanedPath);
      const baseNameNoExt = path.basename(baseNameWithExt, '.md');
      const baseNameLower = baseNameNoExt.toLowerCase();
      targetRelPath = findFuzzyMatch(baseNameLower, fileMap);
    }

    if (targetRelPath) {
      const targetAbsPath = path.join(docsDir, targetRelPath);
      const relPath = path.relative(currentDirAbs, targetAbsPath);
      const normalizedPath = relPath.replace(/\\/g, '/');
      return `[${label}](${normalizedPath}${anchorPart})`;
    } else {
      return label;
    }
  });

  return newContent;
}

/**
 * Iterates through all markdown files in docsDir and rewrites links in place.
 */
export function rewriteAllMarkdownLinks(docsDir: string): void {
  const fileMap = buildDocsFileMap(docsDir);

  function walk(dir: string) {
    const files = fs.readdirSync(dir);
    for (const file of files) {
      const fullPath = path.join(dir, file);
      const stat = fs.statSync(fullPath);
      if (stat.isDirectory()) {
        walk(fullPath);
      } else if (file.endsWith('.md')) {
        const originalContent = fs.readFileSync(fullPath, 'utf8');
        const rewritten = rewriteMarkdownLinks(originalContent, fullPath, docsDir, fileMap);
        if (rewritten !== originalContent) {
          fs.writeFileSync(fullPath, rewritten, 'utf8');
        }
      }
    }
  }

  walk(docsDir);
}

/**
 * Gathers tag mappings from frontmatters across all documents in docsDir.
 */
export function extractTagsMapping(docsDir: string): { item: { title: string; url: string }; tags: string[] }[] {
  const tagsMapping: { item: { title: string; url: string }; tags: string[] }[] = [];

  function walk(dir: string) {
    const files = fs.readdirSync(dir);
    for (const file of files) {
      const fullPath = path.join(dir, file);
      const stat = fs.statSync(fullPath);
      if (stat.isDirectory()) {
        walk(fullPath);
      } else if (file.endsWith('.md')) {
        try {
          const content = fs.readFileSync(fullPath, 'utf8');
          const fmMatch = content.match(/^---\r?\n([\s\S]+?)\r?\n---/);
          if (fmMatch) {
            const fmData = YAML.parse(fmMatch[1]) || {};
            const rawTags = fmData.tags || [];
            const tags = (Array.isArray(rawTags) ? rawTags : [rawTags])
              .map((t: any) => String(t).trim().toLowerCase())
              .filter((t: string) => t.length > 0);

            if (tags.length > 0) {
              const relPath = path.relative(docsDir, fullPath);
              const urlPath = relPath.replace(/\.md$/, '.html').replace(/\\/g, '/');
              tagsMapping.push({
                item: {
                  title: fmData.title || path.basename(file, '.md'),
                  url: urlPath,
                },
                tags,
              });
            }
          }
        } catch (e: any) {
          console.warn(`Failed to read tags from ${file}: ${e.message}`);
        }
      }
    }
  }

  walk(docsDir);
  return tagsMapping;
}
