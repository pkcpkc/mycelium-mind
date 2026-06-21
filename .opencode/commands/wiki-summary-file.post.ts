import { argv, exit } from 'process';
import * as fs from 'fs';
import * as path from 'path';

const vaultName = argv[2];
if (!vaultName) {
  console.error("Error: Vault name not provided.");
  exit(1);
}

const targetFile = argv[3];
if (!targetFile) {
  console.error("Error: Target file name not provided.");
  exit(1);
}

console.log(`[Hook] Starting post-processing for wiki-summary-file (Vault: ${vaultName}, File: ${targetFile})...`);

const inboxDir = path.resolve(process.cwd(), 'Vaults', vaultName, 'inbox');
const assetDirParent = path.resolve(process.cwd(), 'Vaults', vaultName, 'wiki', 'assets');

const dateToday = new Date().toISOString().split('T')[0];
const assetDir = path.join(assetDirParent, dateToday);
const timestamp = new Date().toISOString().replace(/\.\d{3}Z$/, 'Z');

let filePath = '';
if (path.isAbsolute(targetFile)) {
  filePath = targetFile;
} else if (targetFile.startsWith('Vaults/') || targetFile.startsWith('./Vaults/')) {
  filePath = path.resolve(process.cwd(), targetFile);
} else {
  filePath = path.join(inboxDir, targetFile);
}

let resourcePath = '';
if (fs.existsSync(filePath) && fs.statSync(filePath).isFile()) {
  console.log(`Archiving file ${filePath} to ${assetDir}...`);
  fs.mkdirSync(assetDir, { recursive: true });
  const destPath = path.join(assetDir, path.basename(filePath));
  fs.copyFileSync(filePath, destPath);
  resourcePath = `assets/${dateToday}/${path.basename(filePath)}`;
  console.log(`Success: ${filePath} archived to ${assetDir}.`);
} else {
  console.log(`Warning: File ${filePath} not found, cannot archive. Skipping resource injection.`);
}

const summariesDir = path.resolve(process.cwd(), 'Vaults', vaultName, 'wiki', 'summaries');
if (fs.existsSync(summariesDir) && fs.statSync(summariesDir).isDirectory()) {
  const files = fs.readdirSync(summariesDir)
    .filter(f => f.endsWith('.md'))
    .map(f => path.join(summariesDir, f));

  let newestSummary = '';
  if (files.length > 0) {
    files.sort((a, b) => fs.statSync(b).mtimeMs - fs.statSync(a).mtimeMs);
    newestSummary = files[0];
  }

  if (newestSummary && fs.existsSync(newestSummary)) {
    console.log(`Injecting resource and timestamp into ${newestSummary}...`);
    let content = fs.readFileSync(newestSummary, 'utf8');

    if (content.startsWith('---')) {
      const parts = content.split('---');
      if (parts.length >= 3) {
        let frontmatterLines = parts[1].split('\n');
        
        const resourceIdx = frontmatterLines.findIndex(l => l.startsWith('resource:'));
        if (resourcePath) {
          if (resourceIdx !== -1) {
            frontmatterLines[resourceIdx] = `resource: "${resourcePath}"`;
          } else {
            const typeIdx = frontmatterLines.findIndex(l => l.startsWith('type:'));
            if (typeIdx !== -1) {
              frontmatterLines.splice(typeIdx + 1, 0, `resource: "${resourcePath}"`);
            } else {
              frontmatterLines.push(`resource: "${resourcePath}"`);
            }
          }
        }

        const timestampIdx = frontmatterLines.findIndex(l => l.startsWith('timestamp:'));
        if (timestampIdx !== -1) {
          frontmatterLines[timestampIdx] = `timestamp: "${timestamp}"`;
        } else {
          const typeIdx = frontmatterLines.findIndex(l => l.startsWith('type:'));
          if (typeIdx !== -1) {
            frontmatterLines.splice(typeIdx + 1, 0, `timestamp: "${timestamp}"`);
          } else {
            frontmatterLines.push(`timestamp: "${timestamp}"`);
          }
        }

        parts[1] = frontmatterLines.join('\n');
        const newContent = parts.join('---');
        fs.writeFileSync(newestSummary, newContent);
        console.log(`Success: Injected resource='${resourcePath}' and timestamp='${timestamp}'.`);
      }
    }
  } else {
    console.log("Warning: No summary file found to inject metadata into.");
  }
}

if (fs.existsSync(filePath) && fs.statSync(filePath).isFile()) {
  fs.unlinkSync(filePath);
  console.log(`Removed original inbox file: ${filePath}`);
}

console.log('\n[Hook] Post-processing finished.');
