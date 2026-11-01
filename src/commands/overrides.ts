import * as fs from 'fs';
import * as path from 'path';
import { callAgenticModel } from '../utils/openai-api.js';
import {
  getFormattedDateTime,
  parseFrontmatterFromString,
  cleanMarkdownResponse
} from '../utils/fs-utils.js';
import {
  gitCommit,
  gitCreateBranch,
  gitCreatePR,
  enableGitCommits,
  gitRead,
  gitListModifiedMarkdown
} from '../utils/git.js';
import { validateAllPlugins } from './check-plugins.js';
import { initWiki } from './init.js';
import {
  loadCollectionSchemaTemplates,
  compileEntityCard,
  extractEntityTasksForSummary,
  emitEntityEvent
} from '../core/compiler-engine.js';
import { SummaryFrontmatter } from '../core/types.js';
import { withRun, emitEvent, toVaultPath, RunHandle } from '../core/hooks.js';

export interface AffectedEntity {
  collection: string;
  name: string;
  path: string;
}

/**
 * Counts added and removed lines in a unified diff (ignoring file headers).
 */
export function diffStats(diff: string): { additions: number; deletions: number } {
  let additions = 0;
  let deletions = 0;
  for (const line of diff.split('\n')) {
    if (line.startsWith('+') && !line.startsWith('+++')) additions++;
    else if (line.startsWith('-') && !line.startsWith('---')) deletions++;
  }
  return { additions, deletions };
}

/**
 * Helper to update concerned collection entities for a modified file.
 */
export async function updateCollectionEntitiesForFile(
  absolutePath: string,
  file: string,
  newFm: SummaryFrontmatter | Record<string, unknown>,
  summaryContent: string,
  verbose?: boolean
): Promise<AffectedEntity[]> {
  const affected: AffectedEntity[] = [];
  const schemasDir = path.join(absolutePath, 'plugins', 'collections');
  if (!fs.existsSync(schemasDir)) return affected;

  const activeSchemas = fs.readdirSync(schemasDir).filter(f => fs.statSync(path.join(schemasDir, f)).isDirectory());
  const schemaTemplates = loadCollectionSchemaTemplates(absolutePath, activeSchemas);
  const targetPath = path.join(absolutePath, file);

  const summaryItem = { summaryPath: targetPath, frontmatter: newFm };
  const tasks = extractEntityTasksForSummary(summaryItem, activeSchemas, schemaTemplates);

  for (const task of tasks) {
    const { schemaName, entityName } = task;
    const template = schemaTemplates[schemaName];
    if (!template) continue;

    console.log(`Compiling entity card standard-way: ${entityName} (${schemaName})`);
    const startTime = Date.now();
    try {
      const result = await compileEntityCard({
        absoluteWikiRoot: absolutePath,
        schemaName,
        entityName,
        summaryContent,
        template,
        verbose,
      });
      gitCommit(result.entityPath, `Updated ${schemaName} entity card: ${entityName}`);
      emitEntityEvent({ schemaName, entityName, result, sourceSummaries: [targetPath], durationMs: Date.now() - startTime });
      affected.push({ collection: schemaName, name: entityName, path: toVaultPath(result.entityPath) });
    } catch (e: any) {
      console.error(`Failed to compile entity ${entityName}:`, e.message);
      emitEvent('entity.failed', { collection: schemaName, name: entityName, error: e.message });
    }
  }
  return affected;
}

/**
 * Identifies manual edits in the wiki directory, saves them as overrides,
 * recreates the edited documents, and standardly updates collection entity cards.
 */
export async function overridesWiki(
  wikiPath: string,
  options?: { pr?: boolean; verbose?: boolean; commit?: boolean }
): Promise<void> {
  const absolutePath = path.resolve(wikiPath);
  return withRun(
    absolutePath,
    'overrides',
    { pr: !!options?.pr, commit: !!options?.commit, verbose: !!options?.verbose },
    (run) => runOverrides(absolutePath, run, options)
  );
}

async function runOverrides(
  wikiPath: string,
  run: RunHandle,
  options?: { pr?: boolean; verbose?: boolean; commit?: boolean }
): Promise<void> {
  // `commit` keeps git commits on the current branch without opening a PR (used by watch mode)
  enableGitCommits(!!options?.pr || !!options?.commit);
  const absolutePath = path.resolve(wikiPath);

  // Ensure wiki is initialized
  await initWiki(absolutePath, { overwrite: false });

  // Run check-plugin implicitly on all plugins before overrides
  await validateAllPlugins(absolutePath);

  // Create branch if requested
  let branchName = '';
  if (options?.pr) {
    const timestampStr = new Date().toISOString()
      .replace(/[-:]/g, '')
      .replace('T', '-')
      .split('.')[0];
    branchName = `override-${timestampStr}`;
    gitCreateBranch(absolutePath, branchName);
  }

  // 1. Identify modified .md files in the wiki folder only using git diff HEAD
  let modifiedFiles: string[] = [];
  try {
    modifiedFiles = gitListModifiedMarkdown(absolutePath, 'wiki').filter(file => file.startsWith('wiki/'));
  } catch (err: any) {
    console.error('Failed to run git diff:', err.message);
    run.skip('git_unavailable');
    return;
  }

  if (modifiedFiles.length === 0) {
    console.log('No modified markdown files found in the wiki folder.');
    run.skip('no_modified_files');
    try {
      const untrackedOutput = gitRead(absolutePath, ['ls-files', '--others', '--exclude-standard', '-z', '--', 'wiki']);
      const hasUntracked = untrackedOutput.split('\0').some(file => file.endsWith('.md'));
      if (hasUntracked) {
        console.log('\nNotice: You have untracked markdown files in the wiki directory.');
        console.log('If you want to include them in overrides, please stage them first using:');
        console.log('  git add wiki/');
      }
    } catch {}
    return;
  }

  // 2. Build list of overrides
  const overridesList: { file: string; diff: string }[] = [];
  const timestamp = getFormattedDateTime();
  const overridesDir = path.join(absolutePath, 'wiki', 'assets', 'overrides', timestamp);
  const snapshotPath = toVaultPath(path.join(overridesDir, 'overrides.json'));
  const skipped = (file: string, reason: string) => emitEvent('override.skipped', { path: file, reason });

  emitEvent('override.detected', { files: modifiedFiles });
  run.setStage('overrides');

  for (const file of modifiedFiles) {
    const fullFilePath = path.join(absolutePath, file);
    let originalContent = '';
    try {
      originalContent = gitRead(absolutePath, ['show', `HEAD:${file}`]);
    } catch {
      console.warn(`Warning: Could not get HEAD content for ${file}. Assuming empty.`);
    }

    // Snapshot the edited file alongside its diff, to detect edits made while the LLM runs
    const editedContent = fs.existsSync(fullFilePath) ? fs.readFileSync(fullFilePath, 'utf8') : null;
    const fileDiff = gitRead(absolutePath, ['diff', 'HEAD', '--', file]);
    if (!fileDiff.trim()) {
      skipped(file, 'empty_diff');
      continue;
    }

    // 3. Re-create the edited document using the LLM with logical-apply prompt
    console.log(`Re-creating manually edited document via LLM: ${file}`);
    const systemPrompt = `You are a precision text-rewriting agent. Your task is to take an original markdown document and logically apply a git diff to it.\nEnsure you return the full updated markdown document. Do not include any explanation or markdown code block wraps.`;
    const userPrompt = `Here is the original markdown document:\n<<<<ORIGINAL_DOCUMENT>>>>\n${originalContent}\n<<<<END_ORIGINAL_DOCUMENT>>>>\n\nHere is the git diff containing the edits:\n<<<<GIT_DIFF>>>>\n${fileDiff}\n<<<<END_GIT_DIFF>>>>\n\nPlease logically apply the changes from the git diff to the original markdown document and return the complete updated document.`;

    let recreatedContent = '';
    try {
      const response = await callAgenticModel([
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ]);
      recreatedContent = cleanMarkdownResponse(response);
    } catch (e: any) {
      console.error(`LLM logical-apply failed for ${file}:`, e.message);
      skipped(file, 'llm_failed');
      continue;
    }

    // Never clobber edits made after the diff was taken; the newer edit is picked up next run
    const currentContent = fs.existsSync(fullFilePath) ? fs.readFileSync(fullFilePath, 'utf8') : null;
    if (currentContent !== editedContent) {
      console.warn(`Skipping ${file}: it changed while being re-created. It will be processed on the next run.`);
      skipped(file, 'changed_during_recreate');
      continue;
    }

    // Write recreated content back to disk
    fs.writeFileSync(fullFilePath, recreatedContent, 'utf8');
    // Record only applied overrides, so failed or skipped attempts don't create snapshots
    overridesList.push({
      file,
      diff: fileDiff,
    });

    // 3.1 Check if frontmatter is changed and update concerned collection entities
    const originalFm = parseFrontmatterFromString(originalContent);
    const newFm = parseFrontmatterFromString(recreatedContent);
    const isFmChanged = JSON.stringify(originalFm) !== JSON.stringify(newFm);

    let affectedEntities: AffectedEntity[] = [];
    if (isFmChanged) {
      console.log(`Frontmatter changed for ${file}. Updating concerned collection entities...`);
      affectedEntities = await updateCollectionEntitiesForFile(absolutePath, file, newFm, recreatedContent, options?.verbose);
    }

    gitCommit(fullFilePath, `Recreated manual override for ${path.basename(file)}`);
    emitEvent('override.applied', {
      path: file,
      ...diffStats(fileDiff),
      frontmatter_changed: isFmChanged,
      affected_entities: affectedEntities,
      snapshot: snapshotPath,
      replay: false,
    });
  }

  if (overridesList.length > 0) {
    fs.mkdirSync(overridesDir, { recursive: true });
    const overridesJsonPath = path.join(overridesDir, 'overrides.json');
    fs.writeFileSync(overridesJsonPath, JSON.stringify(overridesList, null, 2), 'utf8');
    gitCommit(overridesJsonPath, `Saved overrides diff json at ${timestamp}`);
  }

  run.setResult({ applied: overridesList.length, skipped: modifiedFiles.length - overridesList.length });

  // Create PR if requested
  run.setStage('git');
  if (options?.pr && branchName) {
    gitCreatePR(absolutePath, branchName);
  }
}
