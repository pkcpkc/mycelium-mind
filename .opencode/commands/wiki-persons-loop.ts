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
const personsDir = path.resolve(process.cwd(), 'Vaults', vaultName, 'wiki', 'persons');

if (!fs.existsSync(summariesDir) || fs.readdirSync(summariesDir).filter(f => f.endsWith('.md')).length === 0) {
  console.log("[wiki-persons] No summaries found. Run /wiki-summaries first.");
  exit(0);
}

fs.mkdirSync(personsDir, { recursive: true });

// Run extract-entities.ts
const extractEntitiesScript = path.resolve(process.cwd(), '.opencode', 'commands', 'extract-entities.ts');
let entitiesRaw = '';
try {
  entitiesRaw = execSync(`node --experimental-strip-types "${extractEntitiesScript}" "${summariesDir}" persons`, { encoding: 'utf8' });
} catch (e: any) {
  console.error("Failed to extract entities:", e.message);
  exit(1);
}

const entities = entitiesRaw.split('\n').map(e => e.trim()).filter(Boolean);

if (entities.length === 0) {
  console.log("[wiki-persons] No person entities found in summaries.");
  exit(0);
}

console.log("[wiki-persons] Extracted person entities:");
console.log(entities.join('\n'));

// Filter unchanged persons
const newEntities: string[] = [];
for (const entity of entities) {
  const safeName = entity.replace(/ /g, '_');
  const personFileUnderscore = path.join(personsDir, `${safeName}.md`);
  const personFileSpace = path.join(personsDir, `${entity}.md`);

  let personFile = '';
  if (fs.existsSync(personFileUnderscore)) {
    personFile = personFileUnderscore;
  } else if (fs.existsSync(personFileSpace)) {
    personFile = personFileSpace;
  }

  if (personFile) {
    const personMTime = fs.statSync(personFile).mtimeMs;
    const summaryFiles = fs.readdirSync(summariesDir).filter(f => f.endsWith('.md'));
    let hasNewerSummary = false;
    for (const summaryFile of summaryFiles) {
      const summaryPath = path.join(summariesDir, summaryFile);
      if (fs.statSync(summaryPath).mtimeMs > personMTime) {
        hasNewerSummary = true;
        break;
      }
    }
    if (!hasNewerSummary) {
      console.log(`[wiki-persons] Skipping unchanged: ${entity}`);
      continue;
    }
  }
  newEntities.push(entity);
}

if (newEntities.length === 0) {
  console.log("[wiki-persons] All persons are up to date.");
  exit(0);
}

const configPath = path.resolve(process.cwd(), 'mycelium-mind.json');
let personBatchSize = 5;
if (fs.existsSync(configPath)) {
  try {
    const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
    if (config.batchSizes && typeof config.batchSizes.persons === 'number') {
      personBatchSize = config.batchSizes.persons;
    }
  } catch (e: any) {
    console.warn("[wiki-persons] Warning: Could not parse mycelium-mind.json, using default batch size of 5.");
  }
}

console.log(`[wiki-persons] Processing ${newEntities.length} new/changed persons in batches of ${personBatchSize}...`);

let idx = 0;
let batch: string[] = [];
for (const entity of newEntities) {
  batch.push(entity);
  if (batch.length >= personBatchSize) {
    idx += batch.length;

    const argsStr = batch.map(e => `"${e}"`).join(' ');
    console.log(`[wiki-persons] Processing batch: ${batch.join(', ')}`);
    execSync(`opencode run --command "wiki-person-batch" "${vaultName}" ${argsStr}`, { stdio: 'inherit' });
    batch = [];
  }
}

if (batch.length > 0) {
  idx += batch.length;

  const argsStr = batch.map(e => `"${e}"`).join(' ');
  console.log(`[wiki-persons] Processing final batch: ${batch.join(', ')}`);
  execSync(`opencode run --command "wiki-person-batch" "${vaultName}" ${argsStr}`, { stdio: 'inherit' });
}


console.log("[wiki-persons] Finished processing all persons.");
