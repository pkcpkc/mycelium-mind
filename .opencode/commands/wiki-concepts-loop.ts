import { argv, exit } from 'process';
import * as fs from 'fs';
import * as path from 'path';
import { execSync } from 'child_process';
import { updateStatus, cleanStatus } from './status-helper.ts';

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

const configPath = path.resolve(process.cwd(), 'mycelium-mind.json');
let conceptBatchSize = 5;
if (fs.existsSync(configPath)) {
  try {
    const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
    if (config.batchSizes && typeof config.batchSizes.concepts === 'number') {
      conceptBatchSize = config.batchSizes.concepts;
    }
  } catch (e: any) {
    console.warn("[wiki-concepts] Warning: Could not parse mycelium-mind.json, using default batch size of 5.");
  }
}

console.log(`[wiki-concepts] Processing ${newEntities.length} new/changed concepts in batches of ${conceptBatchSize}...`);

let idx = 0;
let batch: string[] = [];
for (const entity of newEntities) {
  batch.push(entity);
  if (batch.length >= conceptBatchSize) {
    idx += batch.length;
    updateStatus(`[wiki-concepts] Processing concepts batch`, `${idx}/${newEntities.length}`);
    const argsStr = batch.map(e => `"${e}"`).join(' ');
    console.log(`[wiki-concepts] Processing batch: ${batch.join(', ')}`);
    execSync(`opencode run --command "wiki-concept-batch" "${vaultName}" ${argsStr}`, { stdio: 'inherit' });
    batch = [];
  }
}

if (batch.length > 0) {
  idx += batch.length;
  updateStatus(`[wiki-concepts] Processing final concepts batch`, `${idx}/${newEntities.length}`);
  const argsStr = batch.map(e => `"${e}"`).join(' ');
  console.log(`[wiki-concepts] Processing final batch: ${batch.join(', ')}`);
  execSync(`opencode run --command "wiki-concept-batch" "${vaultName}" ${argsStr}`, { stdio: 'inherit' });
}

cleanStatus();
console.log("[wiki-concepts] Finished processing all concepts.");
