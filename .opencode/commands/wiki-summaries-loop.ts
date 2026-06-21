import { argv, exit } from 'process';
import * as fs from 'fs';
import * as path from 'path';
import { execSync } from 'child_process';

const vaultName = argv[2];
if (!vaultName) {
  console.error("Error: Vault name not provided.");
  exit(1);
}

const inboxDir = path.resolve(process.cwd(), 'Vaults', vaultName, 'inbox');
if (!fs.existsSync(inboxDir) || !fs.statSync(inboxDir).isDirectory()) {
  console.log("[wiki-summaries] Inbox directory does not exist. Skipping.");
  exit(0);
}

// Find all .md and .txt files in inbox (top-level only, exclude dotfiles)
const files = fs.readdirSync(inboxDir).filter(file => {
  const ext = path.extname(file).toLowerCase();
  const isTarget = ['.md', '.txt'].includes(ext);
  const isDotFile = file.startsWith('.');
  const isFile = fs.statSync(path.join(inboxDir, file)).isFile();
  return isTarget && !isDotFile && isFile;
});

if (files.length === 0) {
  console.log("[wiki-summaries] No text files to process in inbox.");
  exit(0);
}

console.log("[wiki-summaries] Found files to process in inbox:");
console.log(files.join('\n'));

for (const file of files) {
  console.log(`[wiki-summaries] Starting new context for file: ${file}`);
  execSync(`opencode run --command "wiki-summary-file" "${vaultName}" "${file}"`, { stdio: 'inherit' });
  console.log(`[wiki-summaries] Completed processing for file: ${file}`);
}

console.log("[wiki-summaries] Finished processing all files.");
