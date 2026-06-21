import { argv, exit } from 'process';
import * as fs from 'fs';
import * as path from 'path';
import YAML from 'yaml';

function parseFrontmatter(filepath: string): { frontmatter: any, content: string } | null {
  try {
    const content = fs.readFileSync(filepath, 'utf8');
    if (!content.startsWith('---')) return null;
    const parts = content.split('---');
    if (parts.length < 3) return null;
    const frontmatter = YAML.parse(parts[1]);
    return { frontmatter, content: parts.slice(2).join('---') };
  } catch (e) {
    return null;
  }
}

function generateIndices(wikiDir: string) {
  if (!fs.existsSync(wikiDir) || !fs.statSync(wikiDir).isDirectory()) {
    console.log(`Directory ${wikiDir} does not exist.`);
    return;
  }

  const excludeDirs = new Set(['assets', 'schemas']);

  const entries = fs.readdirSync(wikiDir);
  for (const entry of entries) {
    const subdirPath = path.join(wikiDir, entry);
    if (!fs.statSync(subdirPath).isDirectory() || excludeDirs.has(entry) || entry.startsWith('.')) {
      continue;
    }

    console.log(`Generating index.md for ${subdirPath}...`);

    const items: [string, string, string][] = [];
    const files = fs.readdirSync(subdirPath).sort();

    for (const filename of files) {
      if (!filename.endsWith('.md') || filename === 'index.md') {
        continue;
      }

      const filepath = path.join(subdirPath, filename);
      const parsed = parseFrontmatter(filepath);
      const filenameNoExt = path.basename(filename, '.md');
      const cleanName = filenameNoExt.replace(/_/g, ' ');

      let title = cleanName;
      let description = '';

      if (parsed && parsed.frontmatter && typeof parsed.frontmatter === 'object') {
        title = parsed.frontmatter.title || cleanName;
        description = parsed.frontmatter.description || '';
      }

      items.push([filenameNoExt, title, description]);
    }

    const indexPath = path.join(subdirPath, 'index.md');
    if (items.length === 0) {
      if (fs.existsSync(indexPath)) {
        try {
          fs.unlinkSync(indexPath);
          console.log(`Removed empty index.md at ${indexPath}`);
        } catch (e: any) {
          console.error(`Failed to remove ${indexPath}:`, e.message);
        }
      }
      continue;
    }

    const sectionTitle = entry.charAt(0).toUpperCase() + entry.slice(1);
    const lines = [
      `# ${sectionTitle}\n`
    ];

    for (const [nameNoExt, title, desc] of items) {
      const linkName = nameNoExt.replace(/_/g, ' ');
      let linkPart = '';
      if (title === linkName) {
        linkPart = `[[${linkName}]]`;
      } else {
        linkPart = `[[${linkName}|${title}]]`;
      }

      if (desc) {
        lines.push(`* ${linkPart} - ${desc.trim()}`);
      } else {
        lines.push(`* ${linkPart}`);
      }
    }

    lines.push(''); // Ending newline

    try {
      fs.writeFileSync(indexPath, lines.join('\n'), 'utf8');
      console.log(`Successfully wrote ${indexPath}`);
    } catch (e: any) {
      console.error(`Failed to write index.md at ${indexPath}:`, e.message);
    }
  }
}

const wikiDir = argv[2];
if (!wikiDir) {
  console.error("Usage: node --experimental-strip-types generate-indices.ts <wiki_dir>");
  exit(1);
}

generateIndices(wikiDir);
