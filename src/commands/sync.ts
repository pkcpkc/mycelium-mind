import * as fs from 'fs';
import * as path from 'path';
import {
  toSafeFilename,
  getFormattedDateTime
} from '../utils/fs-utils.js';
import { gitCreatePR, gitCreateBranch, gitCommitTracked, clearEngineWrites, enableGitCommits, createGitCommitQueue, gitGetCurrentBranch, gitRollbackBranch } from '../utils/git.js';
import { validateAllPlugins } from './check-plugins.js';
import { initWiki } from './init.js';
import { overviewsWiki } from './overviews.js';
import { extractAsset } from '../core/asset-extractor.js';
import {
  loadSummaryPromptTemplate,
  synthesizeSummary,
  loadCollectionSchemaTemplates,
  filterCompanionFiles,
  compileEntitiesFromSummaries,
  printCompilerStats,
  emitSummaryEvent
} from '../core/compiler-engine.js';
import { withRun, emitEvent, pageExisted, toVaultPath, RunHandle } from '../core/hooks.js';
import { CompilerStats, SummaryFrontmatter } from '../core/types.js';
import { asyncPool } from '../utils/async-pool.js';
import { loadIngestionSettings } from '../utils/config.js';
import { isNonRecoverableError, preflightModelCheck } from '../utils/openai-api.js';

type SyncOptions = { pr?: boolean; verbose?: boolean; commit?: boolean };

/**
 * Syncs the inbox folder with the wiki database.
 */
export async function syncWiki(wikiPath: string, options?: SyncOptions): Promise<void> {
  const absolutePath = path.resolve(wikiPath);
  const inboxDir = path.join(absolutePath, 'inbox');
  return withRun(
    absolutePath,
    'sync',
    { pr: options?.pr !== false, commit: !!options?.commit, verbose: !!options?.verbose },
    (run) => runSync(absolutePath, run, options),
    { startData: () => ({ inbox_files: listInboxFiles(inboxDir).map(f => toVaultPath(path.join(inboxDir, f))) }) }
  );
}

function listInboxFiles(inboxDir: string): string[] {
  if (!fs.existsSync(inboxDir)) return [];
  return fs.readdirSync(inboxDir).filter(file => {
    return !file.startsWith('.') && fs.statSync(path.join(inboxDir, file)).isFile();
  });
}

async function runSync(wikiPath: string, run: RunHandle, options?: SyncOptions): Promise<void> {
  const pr = options?.pr !== false;
  // `commit` keeps git commits on the current branch without opening a PR (used by watch mode)
  const commits = pr || !!options?.commit;
  enableGitCommits(commits);
  clearEngineWrites();
  const absolutePath = path.resolve(wikiPath);

  // Implicitly create folders/files for the wiki if missing
  await initWiki(absolutePath, { overwrite: false });

  // Run check-plugin implicitly on all plugins before sync
  await validateAllPlugins(absolutePath);

  const inboxDir = path.join(absolutePath, 'inbox');
  if (!fs.existsSync(inboxDir)) {
    console.log('Inbox directory does not exist. Skipping sync.');
    run.skip('inbox_missing');
    return;
  }

  const inboxFiles = listInboxFiles(inboxDir);

  if (inboxFiles.length === 0) {
    console.log('Inbox is empty. Nothing to sync.');
    run.skip('inbox_empty');
    return;
  }

  // Preflight check model endpoint before touching git branches or files
  run.setStage('preflight');
  await preflightModelCheck();

  const { concurrency, inboxChunkSize, maxSummariesPerEntity } = loadIngestionSettings(absolutePath);
  const { queuedGitCommit, awaitGitCommits } = createGitCommitQueue();

  const wikiDir = path.join(absolutePath, 'wiki');

  const initialBranch = gitGetCurrentBranch(absolutePath);
  let branchName = '';
  if (pr) {
    const timestamp = new Date().toISOString()
      .replace(/[-:]/g, '')
      .replace('T', '-')
      .split('.')[0];
    branchName = `sync-${timestamp}`;
    gitCreateBranch(absolutePath, branchName);
  }

  try {
    const dateToday = getFormattedDateTime();
  const assetsDateDir = path.join(wikiDir, 'assets', dateToday);
  const processedDir = path.join(assetsDateDir, 'processed');
  const sourcesDir = path.join(assetsDateDir, 'sources');

  fs.mkdirSync(processedDir, { recursive: true });
  fs.mkdirSync(sourcesDir, { recursive: true });

  const { filesToProcess, mdFiles } = filterCompanionFiles(inboxFiles);

  const totalSummaries = filesToProcess.length;
  if (totalSummaries === 0) {
    console.log('No inbox files to process. Skipping sync.');
    run.skip('inbox_empty');
    return;
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
  run.setResult({ stats });

  const { summaryPrompt, activeSchemas } = loadSummaryPromptTemplate(absolutePath);
  const schemaTemplates = loadCollectionSchemaTemplates(absolutePath, activeSchemas);

  for (const schemaName of activeSchemas) {
    stats.entitiesSuccess[schemaName] = 0;
    stats.entitiesFailed[schemaName] = 0;
  }

  // Partition inbox files into macro-chunks (e.g. 10 files per chunk)
  const inboxChunks: string[][] = [];
  for (let i = 0; i < filesToProcess.length; i += inboxChunkSize) {
    inboxChunks.push(filesToProcess.slice(i, i + inboxChunkSize));
  }

  let completedSummariesCount = 0;
  let completedEntitiesCount = 0;

  for (let chunkIdx = 0; chunkIdx < inboxChunks.length; chunkIdx++) {
    const chunkFiles = inboxChunks[chunkIdx];
    if (inboxChunks.length > 1) {
      console.log(`\nProcessing inbox chunk ${chunkIdx + 1}/${inboxChunks.length} (${chunkFiles.length} files, concurrency=${concurrency})...`);
    }

    const chunkProcessedSummaries: {
      summaryPath: string;
      frontmatter: SummaryFrontmatter;
      originalInboxFile: string;
      companionInboxFile?: string;
    }[] = [];

    // 1. Synthesize summaries for the chunk with bounded concurrency
    run.setStage('summaries');
    await asyncPool(concurrency, chunkFiles, async (file) => {
      const ext = path.extname(file).toLowerCase();
      const baseName = path.basename(file, ext);
      const filePath = path.join(inboxDir, file);
      const summaryStartTime = Date.now();

      const companionMd = !file.endsWith('.md')
        ? mdFiles.find(mf => path.basename(mf, '.md') === baseName)
        : undefined;
      const companionMdPath = companionMd ? path.join(inboxDir, companionMd) : undefined;

      const extracted = await extractAsset(
        filePath,
        { processedDir, sourcesDir, dateToday, absoluteWikiRoot: absolutePath },
        companionMdPath
      );

      try {
        const { frontmatter, fullMarkdown, frontmatterRepaired } = await synthesizeSummary(
          extracted.rawText,
          extracted.companionMetadata,
          baseName,
          summaryPrompt,
          extracted.referencedAssets
        );

        const summaryFilename = toSafeFilename(frontmatter.title);
        const summaryPath = path.join(wikiDir, 'summaries', summaryFilename);
        const existed = pageExisted(summaryPath);
        fs.writeFileSync(summaryPath, fullMarkdown, 'utf8');
        await queuedGitCommit(summaryPath, `Added summary for ${frontmatter.title}`);

        stats.summariesSuccess++;
        emitSummaryEvent({
          summaryPath,
          frontmatter,
          existed,
          activeSchemas,
          schemaTemplates,
          frontmatterRepaired,
          durationMs: Date.now() - summaryStartTime,
        });
        const currentStep = ++completedSummariesCount;
        const duration = ((Date.now() - summaryStartTime) / 1000).toFixed(1);
        console.log(`[Step ${currentStep}] [Summaries ${currentStep}/${totalSummaries}] ${frontmatter.title} done in ${duration}s`);
        chunkProcessedSummaries.push({
          summaryPath,
          frontmatter,
          originalInboxFile: filePath,
          companionInboxFile: companionMdPath,
        });
      } catch (e: any) {
        if (isNonRecoverableError(e)) {
          throw e;
        }
        console.error(`LLM synthesis failed for ${file}:`, e.message);
        stats.summariesFailed++;
        emitEvent('summary.failed', { inbox_file: toVaultPath(filePath), error: e.message });
      }
    });

    // 2. Extract, deduplicate, and compile entity pages for this chunk
    if (chunkProcessedSummaries.length > 0) {
      run.setStage('entities');
      await compileEntitiesFromSummaries({
        summaries: chunkProcessedSummaries,
        activeSchemas,
        schemaTemplates,
        concurrency,
        maxSummariesPerBatch: maxSummariesPerEntity,
        absoluteWikiRoot: absolutePath,
        stats,
        commitPrefix: 'Updated',
        queuedGitCommit,
        verbose: options?.verbose,
        onEntityCompiled: (schemaName, entityName, sourcesCount, duration, taskIdx, totalTasksForSchema) => {
          const currentFinished = ++completedEntitiesCount;
          console.log(`[Step ${totalSummaries + currentFinished}] [${schemaName} ${taskIdx}/${totalTasksForSchema}] ${entityName} (${sourcesCount} source${sourcesCount > 1 ? 's' : ''}) done in ${duration}s`);
        }
      });

      // Transactional cleanup: only unlink inbox files after both summary AND entity compilations for the chunk have finished
      const consumed: string[] = [];
      for (const item of chunkProcessedSummaries) {
        if (fs.existsSync(item.originalInboxFile)) {
          fs.unlinkSync(item.originalInboxFile);
          consumed.push(toVaultPath(item.originalInboxFile));
        }
        if (item.companionInboxFile && fs.existsSync(item.companionInboxFile)) {
          fs.unlinkSync(item.companionInboxFile);
          consumed.push(toVaultPath(item.companionInboxFile));
        }
      }
      emitEvent('inbox.consumed', { files: consumed });
    }

    // Await any remaining git commits for this chunk
    await awaitGitCommits();
  }

  if (totalSummaries > 0 && stats.summariesSuccess === 0) {
    throw new Error(`Sync failed: 0 of ${totalSummaries} summaries could be generated.`);
  }

  // 3. Compile Overviews and Rebuild Indexes
  run.setStage('overviews');
  await overviewsWiki(absolutePath, undefined, { verbose: options?.verbose });
  enableGitCommits(commits);

  printCompilerStats(stats, activeSchemas, totalSummaries, 'Sync');

  run.setStage('git');
  if (commits) {
    // Stage only what this run wrote (plus engine-owned assets), so manual
    // edits made while sync was running stay dirty for `overrides` to pick up.
    gitCommitTracked(absolutePath, ['wiki/assets'], 'Sync: updated overviews and indexes');
  }
  if (pr && branchName) {
    gitCreatePR(absolutePath, branchName);
  }
} catch (err: any) {
  if (branchName) {
    gitRollbackBranch(absolutePath, initialBranch, branchName);
  }
  throw err;
}
}


