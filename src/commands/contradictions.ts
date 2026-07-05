import * as fs from 'fs';
import * as path from 'path';

/**
 * Finds all markdown files recursively in a directory.
 */
function findMarkdownFiles(dir: string): string[] {
  let results: string[] = [];
  if (!fs.existsSync(dir)) return results;
  const list = fs.readdirSync(dir);
  for (const file of list) {
    const filePath = path.join(dir, file);
    const stat = fs.statSync(filePath);
    if (stat && stat.isDirectory()) {
      results = results.concat(findMarkdownFiles(filePath));
    } else if (file.endsWith('.md')) {
      results.push(filePath);
    }
  }
  return results;
}

/**
 * Extracts content under any heading named "Contradictions" (case-insensitive).
 */
export function extractContradictions(content: string): string | null {
  const lines = content.split(/\r?\n/);
  let headingLevel = -1;
  let inContradictions = false;
  const contradictionsLines: string[] = [];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const headingMatch = line.match(/^(#+)\s*(.*?)\s*$/);
    
    if (headingMatch) {
      const level = headingMatch[1].length;
      const title = headingMatch[2].trim();
      
      if (inContradictions) {
        if (level <= headingLevel) {
          break;
        }
      }
      
      if (title.toLowerCase() === 'contradictions') {
        inContradictions = true;
        headingLevel = level;
        continue;
      }
    }
    
    if (inContradictions) {
      contradictionsLines.push(line);
    }
  }

  return inContradictions ? contradictionsLines.join('\n').trim() : null;
}

/**
 * CLI command contradictions: searches the wiki for contradictions, prints them,
 * and guides the user to make manual edits and preserve them with mm overrides.
 */
export async function contradictionsWiki(wikiPath: string): Promise<void> {
  const absolutePath = path.resolve(wikiPath);
  const wikiDir = path.join(absolutePath, 'wiki');

  if (!fs.existsSync(wikiDir)) {
    console.error(`Error: Wiki directory does not exist at ${wikiDir}`);
    return;
  }

  const files = findMarkdownFiles(wikiDir);
  let foundCount = 0;

  console.log(`Scanning wiki pages for contradictions...\n`);

  for (const filePath of files) {
    const content = fs.readFileSync(filePath, 'utf8');
    const contradictions = extractContradictions(content);
    if (contradictions) {
      foundCount++;
      const relativePath = path.relative(absolutePath, filePath);
      console.log(`Document: ${relativePath}`);
      console.log('--------------------------------------------------');
      console.log(contradictions);
      console.log('==================================================\n');
    }
  }

  if (foundCount === 0) {
    console.log('No contradictions found in the wiki folder.');
  } else {
    console.log(`Found ${foundCount} document(s) with contradictions.`);
    console.log(`Please make the required edits manually, and preserve your changes by running:`);
    console.log(`  mm overrides [wiki-path]`);
  }
}
