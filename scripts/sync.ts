import { argv, exit } from 'process';
import { execSync } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';
import { config, projectRootDir } from './src/utils/config.js';

const vaultName = argv[2] || config.vaultName;
if (!vaultName) {
  console.error("Usage: npx tsx scripts/sync.ts <VaultName|Path>");
  exit(1);
}

console.log(`\n========================================`);
console.log(`Starting Wiki Ingestion Pipeline for: ${vaultName}`);
console.log(`========================================`);

async function runPipeline() {
  // Step 1: Pre-processing (Sync)
  console.log('\n--- Step 1: Running Preprocessing Sync scripts ---');
  try {
    execSync(`npx tsx scripts/src/processing/ensure-folders.ts "${vaultName}"`, { stdio: 'inherit', cwd: projectRootDir });
    execSync(`npx tsx scripts/src/processing/sanitize-filenames.ts "${vaultName}"`, { stdio: 'inherit', cwd: projectRootDir });
    execSync(`npx tsx scripts/src/processing/image-to-text.ts "${vaultName}"`, { stdio: 'inherit', cwd: projectRootDir });
    execSync(`npx tsx scripts/src/processing/ocr-pdf.ts "${vaultName}"`, { stdio: 'inherit', cwd: projectRootDir });
  } catch (e: any) {
    console.error("Preprocessing sync step failed:", e.message);
    exit(1);
  }

  // Step 2: Summary Ingestion
  console.log('\n--- Step 2: Summary Ingestion ---');
  let summaryOutputRaw = '';
  try {
    // Run summaries.ts and capture stdout to parse JSON list of processed files
    const stdoutBuf = execSync(`npx tsx scripts/src/summaries/summaries.ts "${vaultName}"`, { cwd: projectRootDir });
    summaryOutputRaw = stdoutBuf.toString();
  } catch (e: any) {
    console.error("Summary ingestion execution failed:", e.message);
    exit(1);
  }

  // Parse output JSON
  let processedSummaries: any[] = [];
  try {
    const lines = summaryOutputRaw.trim().split('\n');
    const jsonLine = lines[lines.length - 1];
    const data = JSON.parse(jsonLine);
    processedSummaries = data.processed || [];
  } catch (e: any) {
    console.error("Failed to parse summary ingestion results JSON:", e.message);
    console.log("Raw output was:", summaryOutputRaw);
  }

  if (processedSummaries.length === 0) {
    console.log("No new summaries processed. Skipping downstream entity updates.");
  } else {
    console.log(`Ingested ${processedSummaries.length} new summaries. Updating downstream concepts & persons...`);

    for (const item of processedSummaries) {
      const summaryPath = item.summaryPath;
      const entities = item.frontmatter?.entities || {};

      // Downstream Concept Cards
      const concepts = entities.concepts || [];
      for (const conceptName of concepts) {
        if (!conceptName || typeof conceptName !== 'string') continue;
        console.log(`\nProcessing concept entity: ${conceptName}`);
        try {
          execSync(`npx tsx scripts/src/concepts/concepts.ts "${vaultName}" "${conceptName}" "${summaryPath}"`, {
            stdio: 'inherit',
            cwd: projectRootDir
          });
        } catch (e: any) {
          console.error(`Failed to execute concepts worker for '${conceptName}':`, e.message);
        }
      }

      // Downstream Person Biographies
      const persons = entities.persons || [];
      for (const personName of persons) {
        if (!personName || typeof personName !== 'string') continue;
        console.log(`\nProcessing person entity: ${personName}`);
        try {
          execSync(`npx tsx scripts/src/persons/persons.ts "${vaultName}" "${personName}" "${summaryPath}"`, {
            stdio: 'inherit',
            cwd: projectRootDir
          });
        } catch (e: any) {
          console.error(`Failed to execute persons worker for '${personName}':`, e.message);
        }
      }
    }
  }

  // Step 3: Timeline & Social Graph Generation
  console.log('\n--- Step 3: Compiling timeline and social graph ---');
  try {
    execSync(`npx tsx scripts/src/timeline/timeline.ts "${vaultName}"`, { stdio: 'inherit', cwd: projectRootDir });
    execSync(`npx tsx scripts/src/social-graph/social-graph.ts "${vaultName}"`, { stdio: 'inherit', cwd: projectRootDir });
  } catch (e: any) {
    console.error("Timeline/Social Graph compilation failed:", e.message);
  }

  // Step 4: Ensure wiki index.md exists
  console.log('\n--- Step 4: Ensuring wiki index ---');
  try {
    const { getVaultDir } = await import('./src/utils/utils.js');
    const vaultRoot = getVaultDir(vaultName);
    const vaultNameResolved = path.basename(vaultRoot);
    const wikiDir = path.join(vaultRoot, 'wiki');
    const indexPath = path.join(wikiDir, 'index.md');

    if (!fs.existsSync(indexPath)) {
      const indexContent = `---
type: "Overview"
title: "${vaultNameResolved} Wiki"
description: "Home page for the ${vaultNameResolved} wiki."
timestamp: "${new Date().toISOString()}"
---
# ${vaultNameResolved} Wiki

Welcome to the wiki. Browse the available pages:

- [[timeline]]
- [[social-graph]]
- [[summaries]]
- [[concepts]]
- [[persons]]
`;
      fs.mkdirSync(path.dirname(indexPath), { recursive: true });
      fs.writeFileSync(indexPath, indexContent, 'utf8');
      console.log(`Created wiki index at ${indexPath}`);
    } else {
      console.log(`Wiki index already exists at ${indexPath}`);
    }
  } catch (e: any) {
    console.error("Failed to create wiki index:", e.message);
  }

  console.log(`\n========================================`);
  console.log(`Wiki Ingestion Pipeline Sync Complete!`);
  console.log(`========================================\n`);
}

runPipeline().catch((err) => {
  console.error("Pipeline run failed critically:", err);
  exit(1);
});
