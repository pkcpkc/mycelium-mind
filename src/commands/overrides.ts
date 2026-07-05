import * as fs from 'fs';
import * as path from 'path';
import { execSync } from 'child_process';
import YAML from 'yaml';
import { callAgenticModel } from '../utils/openai-api.js';
import {
  getFormattedDateTime,
  parseFrontmatterFromString,
  toSafeFilename,
  cleanMarkdownResponse
} from '../utils/fs-utils.js';
import { gitCommit, gitCreateBranch, gitCreatePR, enableGitCommits } from '../utils/git.js';
import { checkPlugins } from './check-plugins.js';
import { initWiki } from './init.js';

/**
 * Standardly compiles or updates a collection entity card.
 */
async function compileEntityCard(
  absolutePath: string,
  schemaName: string,
  entityName: string,
  summaryContent: string,
  verbose?: boolean
): Promise<void> {
  const wikiDir = path.join(absolutePath, 'wiki');
  const schemasDir = path.join(absolutePath, 'plugins', 'collections');
  const collectionFolder = path.join(wikiDir, 'collections', schemaName);
  fs.mkdirSync(collectionFolder, { recursive: true });

  const entityFilename = toSafeFilename(entityName);
  const entityPath = path.join(collectionFolder, entityFilename);

  const existingContent = fs.existsSync(entityPath) ? fs.readFileSync(entityPath, 'utf8') : '';
  const schemaPromptPath = path.join(schemasDir, schemaName, 'prompt.md');
  const schemaPropertiesPath = path.join(schemasDir, schemaName, 'schema.yml');

  if (!fs.existsSync(schemaPromptPath) || !fs.existsSync(schemaPropertiesPath)) {
    console.warn(`Warning: Schema prompt or schema properties missing for ${schemaName}. Skipping ${entityName}.`);
    return;
  }

  const promptTemplate = fs.readFileSync(schemaPromptPath, 'utf8');
  const rawSchemaContent = fs.readFileSync(schemaPropertiesPath, 'utf8');
  let schemaProperties = rawSchemaContent;

  try {
    const doc = YAML.parseDocument(rawSchemaContent);
    if (doc && doc.contents && YAML.isMap(doc.contents)) {
      const metaIndex = doc.contents.items.findIndex(item => item.key && (item.key as any).value === '$meta');
      if (metaIndex !== -1) {
        doc.contents.items.splice(metaIndex, 1);
      }
      const keys = doc.contents.items.map(item => item.key && (item.key as any).value);
      if (!keys.includes('timestamp')) {
        const node = doc.createNode('$TIMESTAMP');
        node.comment = ' String | Required | ISO-8601 date of synthesis. Auto-set by the system.';
        doc.set('timestamp', node);
      }
      if (!keys.includes('tags')) {
        const node = doc.createNode(['string'], { flow: true });
        node.comment = ' Array | Optional | Categorization tags.';
        doc.set('tags', node);
      }
      schemaProperties = doc.toString().trim();
    }
  } catch (err: any) {
    console.error(`Failed to process schema properties for ${schemaName}:`, err.message);
  }

  const timestamp = new Date().toISOString().replace(/\.\d{3}Z$/, 'Z');
  const evaluatedSchema = schemaProperties
    .replace(/\$VALUE/g, entityName)
    .replace(/\$TIMESTAMP/g, timestamp);

  const prompt = promptTemplate
    .replace(/\$SCHEMA/g, evaluatedSchema)
    .replace(/\$VALUE/g, entityName)
    .replace(/\$TIMESTAMP/g, timestamp)
    .replace(/\$EXISTING_CONTENT/g, existingContent || '(empty)')
    .replace(/\$SUMMARY_CONTENT/g, summaryContent);

  if (verbose) {
    console.log(`[VERBOSE] Entity prompt for ${entityName} (${schemaName}):`);
    console.log('--------------------------------------------------');
    console.log(prompt);
    console.log('==================================================');
  }

  try {
    const compiledText = cleanMarkdownResponse(await callAgenticModel([{ role: 'user', content: prompt }]));
    fs.writeFileSync(entityPath, compiledText, 'utf8');
    gitCommit(entityPath, `Updated ${schemaName} entity card: ${entityName}`);
  } catch (e: any) {
    console.error(`Failed to compile entity ${entityName}:`, e.message);
  }
}

/**
 * Helper to update concerned collection entities for a modified file.
 */
export async function updateCollectionEntitiesForFile(
  absolutePath: string,
  file: string,
  newFm: any,
  summaryContent: string,
  verbose?: boolean
): Promise<void> {
  const schemasDir = path.join(absolutePath, 'plugins', 'collections');
  if (!fs.existsSync(schemasDir)) return;

  const activeSchemas = fs.readdirSync(schemasDir).filter(f => fs.statSync(path.join(schemasDir, f)).isDirectory());

  for (const schemaName of activeSchemas) {
    const schemaPromptPath = path.join(schemasDir, schemaName, 'prompt.md');
    if (!fs.existsSync(schemaPromptPath)) continue;

    let targetFields: string[] = [];
    const promptContentRaw = fs.readFileSync(schemaPromptPath, 'utf8');
    let promptConfig: any = {};
    const frontmatterMatch = promptContentRaw.match(/^---\r?\n([\s\S]*?)\r?\n---(?:\r?\n|$)/);
    if (frontmatterMatch) {
      try {
        promptConfig = YAML.parse(frontmatterMatch[1]) || {};
      } catch {}
    }

    if (promptConfig.fields) {
      if (Array.isArray(promptConfig.fields)) {
        targetFields = promptConfig.fields;
      } else if (typeof promptConfig.fields === 'string') {
        targetFields = [promptConfig.fields];
      }
    } else {
      const singular = schemaName.replace(/s$/, '');
      targetFields = [schemaName, singular];
    }

    const summaryKeys = targetFields.filter(k => newFm[k] !== undefined);
    if (summaryKeys.length === 0) continue;

    for (const key of summaryKeys) {
      let entityList = newFm[key];
      if (entityList && typeof entityList === 'object' && !Array.isArray(entityList)) {
        const nestedKey = Object.keys(entityList).find(k => k.toLowerCase().startsWith(schemaName.toLowerCase()));
        if (nestedKey) {
          entityList = (entityList as any)[nestedKey];
        }
      }

      if (!Array.isArray(entityList)) continue;

      for (const entityVal of entityList) {
        let entityName = '';
        if (typeof entityVal === 'string') {
          entityName = entityVal.trim();
        } else if (typeof entityVal === 'object' && entityVal !== null) {
          entityName = String(entityVal.name || entityVal.title || '').trim();
        }

        if (entityName) {
          console.log(`Compiling entity card standard-way: ${entityName} (${schemaName})`);
          await compileEntityCard(absolutePath, schemaName, entityName, summaryContent, verbose);
        }
      }
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
  const pluginsCollectionsDir = path.join(absolutePath, 'plugins', 'collections');
  if (fs.existsSync(pluginsCollectionsDir)) {
    const folders = fs.readdirSync(pluginsCollectionsDir).filter(f => fs.statSync(path.join(pluginsCollectionsDir, f)).isDirectory());
    for (const folder of folders) {
      await checkPlugins(path.join(pluginsCollectionsDir, folder));
    }
  }

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
      diff: fileDiff
    });

    // 3. Re-create the edited document using the LLM with logical-apply prompt
    console.log(`Re-creating manually edited document via LLM: ${file}`);
    const systemPrompt = `You are a precision text-rewriting agent. Your task is to take an original markdown document and logically apply a git diff to it.
Ensure you return the full updated markdown document. Do not include any explanation or markdown code block wraps.`;
    const userPrompt = `Here is the original markdown document:
<<<<ORIGINAL_DOCUMENT>>>>
${originalContent}
<<<<END_ORIGINAL_DOCUMENT>>>>

Here is the git diff containing the edits:
<<<<GIT_DIFF>>>>
${fileDiff}
<<<<END_GIT_DIFF>>>>

Please logically apply the changes from the git diff to the original markdown document and return the complete updated document.`;

    let recreatedContent = '';
    try {
      const response = await callAgenticModel([
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt }
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
