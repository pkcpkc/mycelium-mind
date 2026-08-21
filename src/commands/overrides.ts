import * as fs from 'fs';
import * as path from 'path';
import { execSync } from 'child_process';
import YAML from 'yaml';
import { callAgenticModel } from '../utils/openai-api.js';
import {
  getFormattedDateTime,
  parseFrontmatterFromString,
  cleanMarkdownResponse
} from '../utils/fs-utils.js';
import { gitCommit, gitCreateBranch, gitCreatePR, enableGitCommits } from '../utils/git.js';
import { validateAllPlugins } from './check-plugins.js';
import { initWiki } from './init.js';
import {
  loadCollectionSchemaTemplates,
  compileEntityCard,
  extractEntityTasksForSummary
} from '../core/compiler-engine.js';
import { SummaryFrontmatter } from '../core/types.js';

/**
 * Helper to update concerned collection entities for a modified file.
 */
export async function updateCollectionEntitiesForFile(
  absolutePath: string,
  file: string,
  newFm: SummaryFrontmatter | Record<string, unknown>,
  summaryContent: string,
  verbose?: boolean
): Promise<void> {
  const schemasDir = path.join(absolutePath, 'plugins', 'collections');
  if (!fs.existsSync(schemasDir)) return;

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
    try {
      const { entityPath } = await compileEntityCard({
        absoluteWikiRoot: absolutePath,
        schemaName,
        entityName,
        summaryContent,
        template,
        verbose,
      });
      gitCommit(entityPath, `Updated ${schemaName} entity card: ${entityName}`);
    } catch (e: any) {
      console.error(`Failed to compile entity ${entityName}:`, e.message);
    }
  }
}

/**
 * Identifies manual edits in the wiki directory, saves them as overrides,
 * recreates the edited documents, and standardly updates collection entity cards.
 */
export async function overridesWiki(
  wikiPath: string,
  options?: { pr?: boolean; verbose?: boolean }
): Promise<void> {
  enableGitCommits(!!options?.pr);
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
  let diffOutput = '';
  try {
    diffOutput = execSync('git diff HEAD --name-only -- wiki', { cwd: absolutePath }).toString();
  } catch (err: any) {
    console.error('Failed to run git diff:', err.message);
    return;
  }

  const modifiedFiles = diffOutput
    .split('\n')
    .map(line => line.trim())
    .filter(line => line.endsWith('.md') && line.startsWith('wiki/'));

  if (modifiedFiles.length === 0) {
    console.log('No modified markdown files found in the wiki folder.');
    try {
      const untrackedOutput = execSync('git status --porcelain -- wiki', { cwd: absolutePath }).toString();
      const hasUntracked = untrackedOutput.split('\n').some(line => line.startsWith('?? ') && line.endsWith('.md'));
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

  for (const file of modifiedFiles) {
    let originalContent = '';
    try {
      originalContent = execSync(`git show HEAD:"${file}"`, { cwd: absolutePath, stdio: ['pipe', 'pipe', 'ignore'] }).toString();
    } catch {
      console.warn(`Warning: Could not get HEAD content for ${file}. Assuming empty.`);
    }

    const fileDiff = execSync(`git diff HEAD -- "${file}"`, { cwd: absolutePath }).toString();
    if (!fileDiff.trim()) continue;

    overridesList.push({
      file,
      diff: fileDiff,
    });

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
      continue;
    }

    // Write recreated content back to disk
    const fullFilePath = path.join(absolutePath, file);
    fs.writeFileSync(fullFilePath, recreatedContent, 'utf8');

    // 3.1 Check if frontmatter is changed and update concerned collection entities
    const originalFm = parseFrontmatterFromString(originalContent);
    const newFm = parseFrontmatterFromString(recreatedContent);
    const isFmChanged = JSON.stringify(originalFm) !== JSON.stringify(newFm);

    if (isFmChanged) {
      console.log(`Frontmatter changed for ${file}. Updating concerned collection entities...`);
      await updateCollectionEntitiesForFile(absolutePath, file, newFm, recreatedContent, options?.verbose);
    }

    gitCommit(fullFilePath, `Recreated manual override for ${path.basename(file)}`);
  }

  if (overridesList.length > 0) {
    fs.mkdirSync(overridesDir, { recursive: true });
    const overridesJsonPath = path.join(overridesDir, 'overrides.json');
    fs.writeFileSync(overridesJsonPath, JSON.stringify(overridesList, null, 2), 'utf8');
    gitCommit(overridesJsonPath, `Saved overrides diff json at ${timestamp}`);
  }

  // Create PR if requested
  if (options?.pr && branchName) {
    gitCreatePR(absolutePath, branchName);
  }
}
