import * as fs from 'fs';
import * as path from 'path';
import {
  toSafeFilename,
  cleanMarkdownResponse,
  parseFrontmatterFromString
} from '../utils/fs-utils.js';
import { gitCreatePR, gitCreateBranch, enableGitCommits, createGitCommitQueue } from '../utils/git.js';
import { validateAllPlugins } from './check-plugins.js';
import { initWiki } from './init.js';
import { overviewsWiki } from './overviews.js';
import { updateCollectionEntitiesForFile } from './overrides.js';
import { callAgenticModel } from '../utils/openai-api.js';
import { asyncPool } from '../utils/async-pool.js';
import { loadIngestionSettings } from '../utils/config.js';
import { extractArchivedAsset } from '../core/asset-extractor.js';
import {
  loadSummaryPromptTemplate,
  synthesizeSummary,
  loadCollectionSchemaTemplates,
  filterCompanionFiles,
  compileEntitiesFromSummaries,
  printCompilerStats
} from '../core/compiler-engine.js';
import { CompilerStats, SummaryFrontmatter } from '../core/types.js';

/**
 * Recreates the wiki by re-summarizing and re-compiling from existing assets.
 */
export async function resyncWiki(
  wikiPath: string,
  options?: { pr?: boolean; verbose?: boolean; collection?: string }
): Promise<void> {
  enableGitCommits(!!options?.pr);
  const absolutePath = path.resolve(wikiPath);

  // Implicitly create folders/files for the wiki if missing
  await initWiki(absolutePath, { overwrite: false });

  // Run check-plugin implicitly on all plugins before resync
  await validateAllPlugins(absolutePath);

  const wikiDir = path.join(absolutePath, 'wiki');
  const { concurrency, maxSummariesPerEntity } = loadIngestionSettings(absolutePath);
  const { queuedGitCommit, awaitGitCommits } = createGitCommitQueue();

  const assetsDirParent = path.join(wikiDir, 'assets');

  let branchName = '';
  if (options?.pr) {
    const timestamp = new Date().toISOString()
      .replace(/[-:]/g, '')
      .replace('T', '-')
      .split('.')[0];
    branchName = `resync-${timestamp}`;
    gitCreateBranch(absolutePath, branchName);
  }

  if (!fs.existsSync(assetsDirParent)) {
    console.log('No assets folder found. Cannot resync.');
    return;
  }

  // Load plugin schemas
  const schemasDir = path.join(absolutePath, 'plugins', 'collections');
  const activeSchemas = fs.existsSync(schemasDir)
    ? fs.readdirSync(schemasDir).filter(f => fs.statSync(path.join(schemasDir, f)).isDirectory())
    : [];

  let schemasToCompile = [...activeSchemas];
  if (options?.collection) {
    if (!activeSchemas.includes(options.collection)) {
      throw new Error(`Collection '${options.collection}' not found in active plugins.`);
    }
    schemasToCompile = [options.collection];
  }

  // 1. Clear generated folders
  console.log('Cleaning generated folders...');
  const summariesDir = path.join(wikiDir, 'summaries');
  if (!options?.collection) {
    if (fs.existsSync(summariesDir)) {
      fs.rmSync(summariesDir, { recursive: true, force: true });
    }
    fs.mkdirSync(summariesDir, { recursive: true });
  } else {
    if (!fs.existsSync(summariesDir)) {
      fs.mkdirSync(summariesDir, { recursive: true });
    }
  }

  const collectionsDir = path.join(wikiDir, 'collections');
  if (options?.collection) {
    const targetCollDir = path.join(collectionsDir, options.collection);
    if (fs.existsSync(targetCollDir)) {
      fs.rmSync(targetCollDir, { recursive: true, force: true });
    }
    fs.mkdirSync(targetCollDir, { recursive: true });
  } else {
    if (fs.existsSync(collectionsDir)) {
      fs.rmSync(collectionsDir, { recursive: true, force: true });
    }
    fs.mkdirSync(collectionsDir, { recursive: true });
  }

  const overviewsDir = path.join(wikiDir, 'overviews');
  if (fs.existsSync(overviewsDir)) {
    fs.rmSync(overviewsDir, { recursive: true, force: true });
  }
  fs.mkdirSync(overviewsDir, { recursive: true });

  // 2. Discover timeline events (daily ingestions and overrides)
  const timelineEvents: (
    | { type: 'ingestion'; timestamp: string; dateFolder: string }
    | { type: 'override'; timestamp: string; dirPath: string }
  )[] = [];

  const assetEntries = fs.existsSync(assetsDirParent) ? fs.readdirSync(assetsDirParent) : [];
  for (const entry of assetEntries) {
    const fullPath = path.join(assetsDirParent, entry);
    if (fs.statSync(fullPath).isDirectory() && /^\d{8}-\d{6}$/.test(entry) && entry !== 'overrides') {
      timelineEvents.push({
        type: 'ingestion',
        timestamp: entry,
        dateFolder: entry,
      });
    }
  }

  const overridesDir = path.join(assetsDirParent, 'overrides');
  if (fs.existsSync(overridesDir)) {
    const overrideEntries = fs.readdirSync(overridesDir);
    for (const entry of overrideEntries) {
      const fullPath = path.join(overridesDir, entry);
      if (fs.statSync(fullPath).isDirectory() && /^\d{8}-\d{6}$/.test(entry)) {
        timelineEvents.push({
          type: 'override',
          timestamp: entry,
          dirPath: fullPath,
        });
      }
    }
  }

  timelineEvents.sort((a, b) => a.timestamp.localeCompare(b.timestamp));

  const summaryMap = new Map<string, { summaryPath: string; frontmatter: SummaryFrontmatter }>();
  if (options?.collection && fs.existsSync(summariesDir)) {
    const files = fs.readdirSync(summariesDir).filter(f => f.endsWith('.md'));
    for (const file of files) {
      const summaryPath = path.join(summariesDir, file);
      try {
        const content = fs.readFileSync(summaryPath, 'utf8');
        const frontmatter = parseFrontmatterFromString(content);
        if (frontmatter && Array.isArray(frontmatter.assets)) {
          for (const asset of frontmatter.assets) {
            summaryMap.set(asset, { summaryPath, frontmatter: frontmatter as SummaryFrontmatter });
          }
        }
      } catch (err: any) {
        console.warn(`[WARNING] Failed to parse existing summary at ${summaryPath}:`, err.message);
      }
    }
  }

  const { summaryPrompt } = loadSummaryPromptTemplate(absolutePath);
  const schemaTemplates = loadCollectionSchemaTemplates(absolutePath, schemasToCompile);

  // Pre-calculate total summaries
  let totalSummaries = 0;
  for (const event of timelineEvents) {
    if (event.type === 'ingestion') {
      const processedPath = path.join(assetsDirParent, event.dateFolder, 'processed');
      if (fs.existsSync(processedPath)) {
        const sourcesFiles = fs.readdirSync(processedPath).filter(f => !f.startsWith('.'));
        const { filesToProcess } = filterCompanionFiles(sourcesFiles);
        totalSummaries += filesToProcess.length;
      }
    }
  }

  const stats: CompilerStats = {
    summariesSuccess: 0,
    summariesFailed: 0,
    entitiesSuccess: {},
    entitiesFailed: {},
    overviewsSuccess: 0,
    overviewsFailed: 0,
    indexesSuccess: 0,
    indexesFailed: 0,
  };

  for (const schemaName of schemasToCompile) {
    stats.entitiesSuccess[schemaName] = 0;
    stats.entitiesFailed[schemaName] = 0;
  }

  let summaryIdx = 0;
  let globalStepIndex = 0;

  // 3. Process events chronologically
  for (const event of timelineEvents) {
    if (event.type === 'ingestion') {
      console.log(`Processing Ingestion Event: ${event.timestamp}`);
      const processedPath = path.join(assetsDirParent, event.dateFolder, 'processed');
      const sourcesPath = path.join(assetsDirParent, event.dateFolder, 'sources');

      if (!fs.existsSync(processedPath)) continue;

      const sourcesFiles = fs.readdirSync(processedPath).filter(f => !f.startsWith('.'));
      const { filesToProcess, mdFiles } = filterCompanionFiles(sourcesFiles);

      const currentSummaries: { summaryPath: string; frontmatter: SummaryFrontmatter }[] = [];

      await asyncPool(concurrency, filesToProcess, async (file) => {
        const ext = path.extname(file).toLowerCase();
        const baseName = path.basename(file, ext);
        const summaryStartTime = Date.now();

        const extracted = extractArchivedAsset(
          file,
          { processedPath, sourcesPath, dateFolder: event.dateFolder },
          mdFiles
        );

        let summaryItem: { summaryPath: string; frontmatter: SummaryFrontmatter } | null = null;
        const matchingKey = `wiki/assets/${event.dateFolder}/processed/${file}`;

        if (options?.collection && summaryMap.has(matchingKey)) {
          summaryItem = summaryMap.get(matchingKey)!;
          stats.summariesSuccess++;
        } else {
          try {
            const { frontmatter, fullMarkdown } = await synthesizeSummary(
              extracted.rawText,
              extracted.companionMetadata,
              baseName,
              summaryPrompt,
              extracted.referencedAssets
            );

            const summaryFilename = toSafeFilename(frontmatter.title);
            const summaryPath = path.join(summariesDir, summaryFilename);
            fs.writeFileSync(summaryPath, fullMarkdown, 'utf8');
            await queuedGitCommit(summaryPath, `Added summary for ${frontmatter.title}`);
            stats.summariesSuccess++;
            summaryItem = { summaryPath, frontmatter };
          } catch (e: any) {
            console.error(`LLM synthesis failed for asset ${file}:`, e.message);
            stats.summariesFailed++;
          }
        }

        if (summaryItem) {
          summaryIdx++;
          globalStepIndex++;
          console.log(`[Step ${globalStepIndex}] [Summaries ${summaryIdx}/${totalSummaries}] Ingested asset: ${path.basename(summaryItem.summaryPath)} (Done in ${((Date.now() - summaryStartTime) / 1000).toFixed(1)}s)`);
          currentSummaries.push(summaryItem);
        }
      });

      // Extract, deduplicate, and compile entity pages for this ingestion event with bounded concurrency
      if (currentSummaries.length > 0) {
        await compileEntitiesFromSummaries({
          summaries: currentSummaries,
          activeSchemas: schemasToCompile,
          schemaTemplates,
          concurrency,
          maxSummariesPerBatch: maxSummariesPerEntity,
          absoluteWikiRoot: absolutePath,
          stats,
          commitPrefix: 'Resynced',
          queuedGitCommit,
          verbose: options?.verbose,
        });
      }
    } else if (event.type === 'override') {
      console.log(`Processing Override Event: ${event.timestamp}`);
      const overridesJsonPath = path.join(event.dirPath, 'overrides.json');
      if (!fs.existsSync(overridesJsonPath)) continue;

      let overridesList: { file: string; diff: string }[] = [];
      try {
        overridesList = JSON.parse(fs.readFileSync(overridesJsonPath, 'utf8'));
      } catch (err: any) {
        console.warn(`Failed to read overrides JSON at ${overridesJsonPath}:`, err.message);
        continue;
      }

      for (const override of overridesList) {
        const fullFilePath = path.join(absolutePath, override.file);
        const originalContent = fs.existsSync(fullFilePath) ? fs.readFileSync(fullFilePath, 'utf8') : '';

        console.log(`Re-applying override to ${override.file} via LLM`);
        const systemPrompt = `You are a precision text-rewriting agent. Your task is to take an original markdown document and logically apply a git diff to it.\nEnsure you return the full updated markdown document. Do not include any explanation or markdown code block wraps.`;
        const userPrompt = `Here is the original markdown document:\n<<<<ORIGINAL_DOCUMENT>>>>\n${originalContent}\n<<<<END_ORIGINAL_DOCUMENT>>>>\n\nHere is the git diff containing the edits:\n<<<<GIT_DIFF>>>>\n${override.diff}\n<<<<END_GIT_DIFF>>>>\n\nPlease logically apply the changes from the git diff to the original markdown document and return the complete updated document.`;

        let recreatedContent = '';
        try {
          const response = await callAgenticModel([
            { role: 'system', content: systemPrompt },
            { role: 'user', content: userPrompt },
          ]);
          recreatedContent = cleanMarkdownResponse(response);
          fs.writeFileSync(fullFilePath, recreatedContent, 'utf8');
          await queuedGitCommit(fullFilePath, `Re-applied override for ${path.basename(override.file)}`);

          const originalFm = parseFrontmatterFromString(originalContent);
          const newFm = parseFrontmatterFromString(recreatedContent);
          const isFmChanged = JSON.stringify(originalFm) !== JSON.stringify(newFm);

          if (isFmChanged) {
            console.log(`Frontmatter changed for ${override.file} during override replay. Updating concerned collection entities...`);
            await updateCollectionEntitiesForFile(absolutePath, override.file, newFm, recreatedContent, options?.verbose);
          }
        } catch (e: any) {
          console.error(`Failed to replay override for ${override.file}:`, e.message);
        }
      }
    }
  }

  await awaitGitCommits();

  // 4. Overviews & Indexes
  await overviewsWiki(absolutePath, undefined, { verbose: options?.verbose });
  enableGitCommits(!!options?.pr);

  printCompilerStats(stats, schemasToCompile, totalSummaries, 'Resync');

  if (options?.pr && branchName) {
    gitCreatePR(absolutePath, branchName);
  }
}

