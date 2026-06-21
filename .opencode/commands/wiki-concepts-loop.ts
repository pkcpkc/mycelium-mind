import { argv, exit } from 'process';
import * as fs from 'fs';
import * as path from 'path';
import { execSync } from 'child_process';

const vaultName = argv[2];
if (!vaultName) {
  console.error("Error: Vault name not provided.");
  exit(1);
}

const summariesDir = path.resolve(process.cwd(), 'Vaults', vaultName, 'wiki', 'summaries');
const conceptsDir = path.resolve(process.cwd(), 'Vaults', vaultName, 'wiki', 'concepts');

if (!fs.existsSync(summariesDir) || fs.readdirSync(summariesDir).filter(f => f.endsWith('.md')).length === 0) {
  console.log("[wiki-concepts] No summaries found. Run /wiki-summaries first.");
  exit(0);
}

fs.mkdirSync(conceptsDir, { recursive: true });

// Run extract-entities.ts
const extractEntitiesScript = path.resolve(process.cwd(), '.opencode', 'commands', 'extract-entities.ts');
let entitiesRaw = '';
try {
  entitiesRaw = execSync(`node --experimental-strip-types "${extractEntitiesScript}" "${summariesDir}" concepts`, { encoding: 'utf8' });
} catch (e: any) {
  console.error("Failed to extract entities:", e.message);
  exit(1);
}

const entities = entitiesRaw.split('\n').map(e => e.trim()).filter(Boolean);

if (entities.length === 0) {
  console.log("[wiki-concepts] No concept entities found in summaries.");
  exit(0);
}

console.log("[wiki-concepts] Extracted concept entities:");
console.log(entities.join('\n'));

// Filter unchanged concepts
const newEntities: string[] = [];
for (const entity of entities) {
  const safeName = entity.replace(/ /g, '_');
  const conceptFile = path.join(conceptsDir, `${safeName}.md`);

  if (fs.existsSync(conceptFile)) {
    const conceptMTime = fs.statSync(conceptFile).mtimeMs;
    const summaryFiles = fs.readdirSync(summariesDir).filter(f => f.endsWith('.md'));
    let hasNewerSummary = false;
    for (const summaryFile of summaryFiles) {
      const summaryPath = path.join(summariesDir, summaryFile);
      if (fs.statSync(summaryPath).mtimeMs > conceptMTime) {
        hasNewerSummary = true;
        break;
      }
    }
    if (!hasNewerSummary) {
      console.log(`[wiki-concepts] Skipping unchanged: ${entity}`);
      continue;
    }
  }
  newEntities.push(entity);
}

if (newEntities.length === 0) {
  console.log("[wiki-concepts] All concepts are up to date.");
  exit(0);
}

console.log(`[wiki-concepts] Processing ${newEntities.length} new/changed concepts in batches of 5...`);

let batch: string[] = [];
for (const entity of newEntities) {
  batch.push(entity);
  if (batch.length >= 5) {
    const argsStr = batch.map(e => `"${e}"`).join(' ');
    console.log(`[wiki-concepts] Processing batch: ${batch.join(', ')}`);
    execSync(`opencode run --command "wiki-concept-batch" "${vaultName}" ${argsStr}`, { stdio: 'inherit' });
    batch = [];
  }
}

if (batch.length > 0) {
  const argsStr = batch.map(e => `"${e}"`).join(' ');
  console.log(`[wiki-concepts] Processing final batch: ${batch.join(', ')}`);
  execSync(`opencode run --command "wiki-concept-batch" "${vaultName}" ${argsStr}`, { stdio: 'inherit' });
}

console.log("[wiki-concepts] Finished processing all concepts.");
