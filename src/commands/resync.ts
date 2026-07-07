import * as fs from 'fs';
import * as path from 'path';
import YAML from 'yaml';
import { callAgenticModel } from '../utils/openai-api.js';
import {
  getVaultDir,
  getVaultWikiDir,
  toSafeFilename,
  cleanMarkdownResponse,
  rebuildFolderIndex,
  rebuildWikiRootIndex,
  rebuildTagsPage,
  parseFrontmatterFromString
} from '../utils/fs-utils.js';
import { gitCommit, gitCreateBranch, gitCreatePR, enableGitCommits } from '../utils/git.js';
import { buildSessionGraph, runOverviewScript } from '../utils/overview-runner.js';
import { checkPlugins } from './check-plugins.js';
import { initWiki } from './init.js';
import { overviewsWiki } from './overviews.js';
import { updateCollectionEntitiesForFile } from './overrides.js';
import { loadAndInjectSchemaProperties } from '../utils/schema-parser.js';



import { parseSchema } from '../utils/schema-parser.js';

// Parses properties table from schema YAML
function parseSchemaProperties(yamlContent: string): string {
  try {
    const parsed = parseSchema(yamlContent);
    return parsed.cleanSchemaYaml;
  } catch (e: any) {
    console.error('Failed to parse schema YAML:', e.message);
    return '';
  }
}

/**
 * Recreates the wiki by re-summarizing and re-compiling from existing assets.
 */
export async function resyncWiki(wikiPath: string, options?: { pr?: boolean; verbose?: boolean; collection?: string }): Promise<void> {
  enableGitCommits(!!options?.pr);
  const absolutePath = path.resolve(wikiPath);

  // Implicitly create folders/files for the wiki if missing
  await initWiki(absolutePath, { overwrite: false });

  // Run check-plugin implicitly on all plugins before resync
  const pluginsCollectionsDir = path.join(absolutePath, 'plugins', 'collections');
  if (fs.existsSync(pluginsCollectionsDir)) {
    const folders = fs.readdirSync(pluginsCollectionsDir).filter(f => fs.statSync(path.join(pluginsCollectionsDir, f)).isDirectory());
    for (const folder of folders) {
      await checkPlugins(path.join(pluginsCollectionsDir, folder));
    }
  }

  const wikiDir = path.join(absolutePath, 'wiki');
  let parallelPromptExecution = false;
  const configPath = path.join(absolutePath, 'config', 'config.yml');
  if (fs.existsSync(configPath)) {
    try {
      const parsed = YAML.parse(fs.readFileSync(configPath, 'utf8'));
      if (parsed && typeof parsed.parallelPromptExecution === 'boolean') {
        parallelPromptExecution = parsed.parallelPromptExecution;
      }
    } catch (e: any) {
      console.warn(`Failed to parse config.yml at ${configPath}:`, e.message);
    }
  }

  let gitCommitQueue = Promise.resolve();
  const queuedGitCommit = (filePath: string, message: string) => {
    gitCommitQueue = gitCommitQueue.then(() => {
      gitCommit(filePath, message);
    });
    return gitCommitQueue;
  };

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
  const schemaInstructions: string[] = [];
  const schemaKeys: string[] = [];
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

  // Discover Ingestion Events
  const assetEntries = fs.existsSync(assetsDirParent) ? fs.readdirSync(assetsDirParent) : [];
  for (const entry of assetEntries) {
    const fullPath = path.join(assetsDirParent, entry);
    if (fs.statSync(fullPath).isDirectory() && /^\d{8}-\d{6}$/.test(entry) && entry !== 'overrides') {
      timelineEvents.push({
        type: 'ingestion',
        timestamp: entry,
        dateFolder: entry
      });
    }
  }

  // Discover Override Events
  const overridesDir = path.join(assetsDirParent, 'overrides');
  if (fs.existsSync(overridesDir)) {
    const overrideEntries = fs.readdirSync(overridesDir);
    for (const entry of overrideEntries) {
      const fullPath = path.join(overridesDir, entry);
      if (fs.statSync(fullPath).isDirectory() && /^\d{8}-\d{6}$/.test(entry)) {
        timelineEvents.push({
          type: 'override',
          timestamp: entry,
          dirPath: fullPath
        });
      }
    }
  }

  // Sort chronologically
  timelineEvents.sort((a, b) => {
    return a.timestamp.localeCompare(b.timestamp);
  });

  // Build a map of existing summaries keyed by their processed asset paths if we are doing a targeted collection resync
  const summaryMap = new Map<string, { summaryPath: string; frontmatter: any }>();
  if (options?.collection && fs.existsSync(summariesDir)) {
    const files = fs.readdirSync(summariesDir).filter(f => f.endsWith('.md'));
    for (const file of files) {
      const summaryPath = path.join(summariesDir, file);
      try {
        const content = fs.readFileSync(summaryPath, 'utf8');
        const frontmatter = parseFrontmatterFromString(content);
        if (frontmatter && Array.isArray(frontmatter.assets)) {
          for (const asset of frontmatter.assets) {
            summaryMap.set(asset, { summaryPath, frontmatter });
          }
        }
      } catch (err: any) {
        console.warn(`[WARNING] Failed to parse existing summary at ${summaryPath}:`, err.message);
      }
    }
  }

  const processedSummaries: { summaryPath: string; frontmatter: any }[] = [];

  // Load summary templates
  const summaryPromptTemplate = fs.readFileSync(path.join(absolutePath, 'config', 'summary', 'prompt.md'), 'utf8');
  const summaryBaseSchema = fs.readFileSync(path.join(absolutePath, 'config', 'summary', 'schema.yml'), 'utf8');

  for (const folder of activeSchemas) {
    const extensionPath = path.join(schemasDir, folder, 'summary-schema-extension.yml');
    if (fs.existsSync(extensionPath)) {
      const fmContent = fs.readFileSync(extensionPath, 'utf8');
      const propertiesSpec = parseSchemaProperties(fmContent);
      schemaInstructions.push(propertiesSpec);
      schemaKeys.push(folder);
    }
  }

  const baseProperties = parseSchemaProperties(summaryBaseSchema);
  const dynamicFrontmatter = [baseProperties, ...schemaInstructions].filter(Boolean).join('\n');
  const summaryPrompt = summaryPromptTemplate.replace('$SCHEMA', dynamicFrontmatter);

  // Pre-load prompt & properties templates for active schemas
  const schemaTemplates: Record<string, { promptTemplate: string; schemaProperties: string } | null> = {};
  for (const schemaName of activeSchemas) {
    schemaTemplates[schemaName] = null;

    const schemaPromptPath = path.join(schemasDir, schemaName, 'prompt.md');
    const schemaPropertiesPath = path.join(schemasDir, schemaName, 'schema.yml');
    if (!fs.existsSync(schemaPromptPath) || !fs.existsSync(schemaPropertiesPath)) {
      continue;
    }

    const promptContentRaw = fs.readFileSync(schemaPromptPath, 'utf8');
    let promptTemplate = promptContentRaw;
    const frontmatterMatch = promptContentRaw.match(/^---\r?\n([\s\S]*?)\r?\n---(?:\r?\n|$)/);
    if (frontmatterMatch) {
      try {
        promptTemplate = promptContentRaw.slice(frontmatterMatch[0].length);
      } catch (e: any) {
        console.error(`Failed to parse 'prompt.md' frontmatter for plugin ${schemaName} during resync:`, e.message);
      }
    }

    const rawSchemaContent = fs.readFileSync(schemaPropertiesPath, 'utf8');
    const schemaProperties = loadAndInjectSchemaProperties(rawSchemaContent, schemaName);

    schemaTemplates[schemaName] = {
      promptTemplate,
      schemaProperties
    };
  }

  // Pre-calculate total summaries
  let totalSummaries = 0;
  for (const event of timelineEvents) {
    if (event.type === 'ingestion') {
      const processedPath = path.join(assetsDirParent, event.dateFolder, 'processed');
      if (fs.existsSync(processedPath)) {
        const sourcesFiles = fs.readdirSync(processedPath).filter(f => !f.startsWith('.'));
        const binaryFiles = sourcesFiles.filter(f => !f.endsWith('.md') && !f.endsWith('.txt'));
        const filesToProcess = sourcesFiles.filter(file => {
          const ext = path.extname(file).toLowerCase();
          const isMd = ext === '.md';
          const baseName = path.basename(file, ext);
          const hasBinaryCompanion = binaryFiles.some(bf => path.basename(bf, path.extname(bf)) === baseName);
          return !(isMd && hasBinaryCompanion);
        });
        totalSummaries += filesToProcess.length;
      }
    }
  }

  const stats = {
    summariesSuccess: 0,
    summariesFailed: 0,
    entitiesSuccess: {} as Record<string, number>,
    entitiesFailed: {} as Record<string, number>,
    overviewsSuccess: 0,
    overviewsFailed: 0,
    indexesSuccess: 0,
    indexesFailed: 0
  };

  for (const schemaName of schemasToCompile) {
    stats.entitiesSuccess[schemaName] = 0;
    stats.entitiesFailed[schemaName] = 0;
  }

  let globalStepIndex = 0;

  // Helper function to compile entities progressive way
  async function compileEntitiesForSummaries(
    wikiDir: string,
    schemasDir: string,
    activeSchemas: string[],
    schemaTemplates: Record<string, { promptTemplate: string; schemaProperties: string } | null>,
    summaries: { summaryPath: string; frontmatter: any }[]
  ) {
    for (const item of summaries) {
      const summaryContent = fs.readFileSync(item.summaryPath, 'utf8');
      const entities = item.frontmatter;

      const summaryTasks: { schemaName: string; entityName: string; summaryContent: string; summaryPath: string }[] = [];

      for (const schemaName of activeSchemas) {
        const template = schemaTemplates[schemaName];
        if (!template) continue;

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

        const summaryKeys = targetFields.filter(k => entities[k] !== undefined);
        if (summaryKeys.length === 0) continue;

        for (const key of summaryKeys) {
          let entityList = entities[key];

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

            if (!entityName) continue;
            summaryTasks.push({
              schemaName,
              entityName,
              summaryContent,
              summaryPath: item.summaryPath
            });
          }
        }
      }

      if (summaryTasks.length === 0) continue;

      const runTask = async (schemaName: string, task: any) => {
        const { entityName, summaryContent } = task;
        const entityFilename = toSafeFilename(entityName);
        const collectionFolder = path.join(wikiDir, 'collections', schemaName);
        fs.mkdirSync(collectionFolder, { recursive: true });
        const entityPath = path.join(collectionFolder, entityFilename);

        let existingContent = '';
        if (fs.existsSync(entityPath)) {
          existingContent = fs.readFileSync(entityPath, 'utf8');
        }

        const template = schemaTemplates[schemaName]!;
        const timestamp = new Date().toISOString().replace(/\.\d{3}Z$/, 'Z');
        const evaluatedSchema = template.schemaProperties
          .replace(/\$VALUE/g, entityName)
          .replace(/\$TIMESTAMP/g, timestamp);

        const prompt = template.promptTemplate
          .replace(/\$SCHEMA/g, evaluatedSchema)
          .replace(/\$VALUE/g, entityName)
          .replace(/\$TIMESTAMP/g, timestamp)
          .replace(/\$EXISTING_CONTENT/g, existingContent || '(empty)')
          .replace(/\$SUMMARY_CONTENT/g, summaryContent);

        if (options?.verbose) {
          console.log(`[VERBOSE] Entity prompt for ${entityName} (${schemaName}):`);
          console.log('--------------------------------------------------');
          console.log(prompt);
          console.log('==================================================');
        }

        try {
          let compiledText = await callAgenticModel([{ role: 'user', content: prompt }]);
          compiledText = cleanMarkdownResponse(compiledText);
          fs.writeFileSync(entityPath, compiledText, 'utf8');
          await queuedGitCommit(entityPath, `Updated ${schemaName} entity card: ${entityName}`);
          stats.entitiesSuccess[schemaName]++;
        } catch (e: any) {
          console.error(`Failed to compile entity ${entityName}:`, e.message);
          stats.entitiesFailed[schemaName]++;
        }
      };

      if (parallelPromptExecution) {
        const promises = summaryTasks.map(task => runTask(task.schemaName, task));
        await Promise.all(promises);
      } else {
        for (const task of summaryTasks) {
          await runTask(task.schemaName, task);
        }
      }
    }
  }

  // 3. Process timeline events chronologically
  for (const event of timelineEvents) {
    if (event.type === 'ingestion') {
      console.log(`Processing Ingestion Event: ${event.timestamp}`);
      const dateFolder = event.dateFolder;
      const processedPath = path.join(assetsDirParent, dateFolder, 'processed');
      if (!fs.existsSync(processedPath)) continue;

      const sourcesFiles = fs.readdirSync(processedPath).filter(f => !f.startsWith('.'));
      const binaryFiles = sourcesFiles.filter(f => !f.endsWith('.md') && !f.endsWith('.txt'));

      const filesToProcess = sourcesFiles.filter(file => {
        const ext = path.extname(file).toLowerCase();
        const isMd = ext === '.md';
        const baseName = path.basename(file, ext);
        const hasBinaryCompanion = binaryFiles.some(bf => path.basename(bf, path.extname(bf)) === baseName);
        return !(isMd && hasBinaryCompanion);
      });

      const eventSummaries: { summaryPath: string; frontmatter: any }[] = [];

      const processFile = async (file: string) => {
        globalStepIndex++;
        const summaryStartTime = Date.now();
        const ext = path.extname(file).toLowerCase();
        const baseName = path.basename(file, ext);
        const isMd = ext === '.md';

        const processedPathLocal = path.join(assetsDirParent, dateFolder, 'processed');
        const sourcesPathLocal = path.join(assetsDirParent, dateFolder, 'sources');

        let rawTextContent = '';
        let companionMetadataContent = '';
        const referencedAssets: string[] = [];

        if (isMd || ext === '.txt') {
          const sourceFilePath = path.join(processedPathLocal, file);
          rawTextContent = fs.readFileSync(sourceFilePath, 'utf8');
          referencedAssets.push(`wiki/assets/${dateFolder}/processed/${file}`);
          if (isMd && fs.existsSync(path.join(sourcesPathLocal, file))) {
            referencedAssets.push(`wiki/assets/${dateFolder}/sources/${file}`);
          }
        } else {
          referencedAssets.push(`wiki/assets/${dateFolder}/processed/${file}`);

          const transcriptionFilename = `${baseName}_transcription.txt`;
          const transcriptionPath = path.join(sourcesPathLocal, transcriptionFilename);
          if (fs.existsSync(transcriptionPath)) {
            rawTextContent = fs.readFileSync(transcriptionPath, 'utf8');
            referencedAssets.push(`wiki/assets/${dateFolder}/sources/${transcriptionFilename}`);
          } else {
            console.warn(`Warning: Transcription file not found at ${transcriptionPath}`);
            rawTextContent = `[Missing transcription for ${file}]`;
          }

          const companionMd = `${baseName}.md`;
          const companionPath = path.join(sourcesPathLocal, companionMd);
          if (fs.existsSync(companionPath)) {
            companionMetadataContent = fs.readFileSync(companionPath, 'utf8');
            referencedAssets.push(`wiki/assets/${dateFolder}/processed/${companionMd}`);
            referencedAssets.push(`wiki/assets/${dateFolder}/sources/${companionMd}`);
          }
        }

        const primaryAssetKey = referencedAssets[0];
        const cachedSummary = summaryMap.get(primaryAssetKey);

        if (options?.collection && cachedSummary) {
          stats.summariesSuccess++;
          console.log(`[Step ${globalStepIndex}] [Summaries ${globalStepIndex}/${totalSummaries}] Using cached summary for asset: ${file}`);
          eventSummaries.push(cachedSummary);
          processedSummaries.push(cachedSummary);
          return;
        }

        const combinedInput = companionMetadataContent
          ? `Companion Metadata Context:\n${companionMetadataContent}\n\nSource Content:\n${rawTextContent}`
          : rawTextContent;

        if (options?.verbose) {
          console.log(`[VERBOSE] Summary prompt for ${file} during resync:`);
          console.log('--------------------------------------------------');
          console.log(summaryPrompt);
          console.log('==================================================');
        }

        let summaryText = '';
        try {
          summaryText = await callAgenticModel([
            { role: 'system', content: summaryPrompt },
            { role: 'user', content: combinedInput }
          ]);
          summaryText = cleanMarkdownResponse(summaryText);
          stats.summariesSuccess++;
          console.log(`[Step ${globalStepIndex}] [Summaries ${globalStepIndex}/${totalSummaries}] Ingested asset: ${file} (Done in ${((Date.now() - summaryStartTime) / 1000).toFixed(1)}s)`);
        } catch (e: any) {
          console.error(`LLM synthesis failed for ${file} during resync:`, e.message);
          stats.summariesFailed++;
          return;
        }

        let frontmatter: any = {};
        let bodyContent = summaryText;
        let frontmatterStr = '';

        const bodySplitIdx = summaryText.search(/\n#[ \t]/);
        if (bodySplitIdx !== -1) {
          frontmatterStr = summaryText.slice(0, bodySplitIdx).trim();
          bodyContent = summaryText.slice(bodySplitIdx).trim();
        } else {
          if (summaryText.startsWith('---')) {
            const parts = summaryText.split('---');
            if (parts.length >= 3) {
              frontmatterStr = parts[1].trim();
              bodyContent = parts.slice(2).join('---').trim();
            }
          }
        }

        if (frontmatterStr.startsWith('---')) {
          frontmatterStr = frontmatterStr.slice(3).trim();
        }
        if (frontmatterStr.endsWith('---')) {
          frontmatterStr = frontmatterStr.slice(0, -3).trim();
        }

        if (frontmatterStr) {
          const cleanFmStr = frontmatterStr.split('\n')
            .filter(line => !line.trim().startsWith('```'))
            .join('\n')
            .trim();
          try {
            frontmatter = YAML.parse(cleanFmStr) || {};
          } catch (e: any) {
            console.error('Failed to parse frontmatter:', e.message);
          }
        }

        frontmatter.type = 'Summary';
        frontmatter.title = frontmatter.title || baseName;
        frontmatter.timestamp = new Date().toISOString().replace(/\.\d{3}Z$/, 'Z');
        frontmatter.assets = referencedAssets;

        const summaryFilename = toSafeFilename(frontmatter.title);
        const summaryPath = path.join(wikiDir, 'summaries', summaryFilename);
        const finalSummaryContent = `---\n${YAML.stringify(frontmatter)}---\n${bodyContent}`;

        fs.writeFileSync(summaryPath, finalSummaryContent, 'utf8');
        await queuedGitCommit(summaryPath, `Added summary for ${frontmatter.title}`);

        eventSummaries.push({ summaryPath, frontmatter });
        processedSummaries.push({ summaryPath, frontmatter });
      };

      if (parallelPromptExecution) {
        const promises = filesToProcess.map(file => processFile(file));
        await Promise.all(promises);
      } else {
        for (const file of filesToProcess) {
          await processFile(file);
        }
      }

      // Progressive entity compilation from the ingestion summaries
      if (eventSummaries.length > 0) {
        await compileEntitiesForSummaries(
          wikiDir,
          schemasDir,
          schemasToCompile,
          schemaTemplates,
          eventSummaries
        );
      }
    } else if (event.type === 'override') {
      console.log(`Processing Override Event: ${event.timestamp}`);
      const overridesJsonPath = path.join(event.dirPath, 'overrides.json');
      if (!fs.existsSync(overridesJsonPath)) {
        console.warn(`Warning: Overrides JSON file not found at ${overridesJsonPath}`);
        continue;
      }

      let overridesList: { file: string; diff: string }[] = [];
      try {
        overridesList = JSON.parse(fs.readFileSync(overridesJsonPath, 'utf8'));
      } catch (err: any) {
        console.error(`Failed to parse overrides file at ${overridesJsonPath}:`, err.message);
        continue;
      }

      const processOverride = async (override: { file: string; diff: string }) => {
        const normalizedFile = override.file.replace(/\\/g, '/');
        if (options?.collection) {
          const collectionPrefix = `wiki/collections/${options.collection}/`;
          if (!normalizedFile.startsWith(collectionPrefix)) {
            // Skip override for non-target collections when running targeted collection resync
            return;
          }
        }
        globalStepIndex++;
        const targetPath = path.join(absolutePath, override.file);
        if (!fs.existsSync(targetPath)) {
          console.warn(`Warning: Target override file ${targetPath} does not exist. Skipping.`);
          return;
        }

        const currentContent = fs.readFileSync(targetPath, 'utf8');
        console.log(`Re-applying override to ${override.file} via LLM`);

        const systemPrompt = `You are a precision text-rewriting agent. Your task is to take an original markdown document and logically apply a git diff to it.
Ensure you return the full updated markdown document. Do not include any explanation or markdown code block wraps.`;
        const userPrompt = `Here is the original markdown document:
<<<<ORIGINAL_DOCUMENT>>>>
${currentContent}
<<<<END_ORIGINAL_DOCUMENT>>>>

Here is the git diff containing the edits:
<<<<GIT_DIFF>>>>
${override.diff}
<<<<END_GIT_DIFF>>>>

Please logically apply the changes from the git diff to the original markdown document and return the complete updated document.`;

        let recreatedContent = '';
        try {
          const response = await callAgenticModel([
            { role: 'system', content: systemPrompt },
            { role: 'user', content: userPrompt }
          ]);
          recreatedContent = cleanMarkdownResponse(response);
          fs.writeFileSync(targetPath, recreatedContent, 'utf8');
          await queuedGitCommit(targetPath, `Applied override to ${override.file}`);
        } catch (e: any) {
          console.error(`LLM logical-apply failed for ${override.file} during resync:`, e.message);
          return;
        }

        const originalFm = parseFrontmatterFromString(currentContent);
        const newFm = parseFrontmatterFromString(recreatedContent);
        const isFmChanged = JSON.stringify(originalFm) !== JSON.stringify(newFm);

        if (isFmChanged) {
          console.log(`Frontmatter changed for ${override.file} during override replay. Updating concerned collection entities...`);
          await updateCollectionEntitiesForFile(absolutePath, override.file, newFm, recreatedContent, options?.verbose);
        }
      };

      if (parallelPromptExecution) {
        const promises = overridesList.map(item => processOverride(item));
        await Promise.all(promises);
      } else {
        for (const item of overridesList) {
          await processOverride(item);
        }
      }
    }
  }

  // Await any remaining git commits
  await gitCommitQueue;

  // 5. Compile Overviews and Rebuild Indexes
  await overviewsWiki(absolutePath, undefined, { verbose: options?.verbose });
  enableGitCommits(!!options?.pr);

  // Print final summary stats
  console.log('\nResync complete.');
  console.log(`- Summaries generated: ${stats.summariesSuccess}/${totalSummaries} (${stats.summariesFailed} failed)`);
  for (const schemaName of schemasToCompile) {
    console.log(`- ${schemaName.charAt(0).toUpperCase() + schemaName.slice(1)} compiled: ${stats.entitiesSuccess[schemaName]} (${stats.entitiesFailed[schemaName]} failed)`);
  }
  console.log();

  if (options?.pr && branchName) {
    gitCreatePR(absolutePath, branchName);
  }
}
