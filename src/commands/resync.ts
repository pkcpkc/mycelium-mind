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
  rebuildTagsPage
} from '../utils/fs-utils.js';
import { gitCommit, gitCreateBranch, gitCreatePR, enableGitCommits } from '../utils/git.js';
import { buildSessionGraph, runOverviewScript } from '../utils/overview-runner.js';
import { checkPlugins } from './check-plugins.js';
import { initWiki } from './init.js';
import { overviewsWiki } from './overviews.js';



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
export async function resyncWiki(wikiPath: string, options?: { pr?: boolean; verbose?: boolean }): Promise<void> {
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

  // 1. Clear generated folders
  console.log('Cleaning generated folders...');
  const summariesDir = path.join(wikiDir, 'summaries');
  if (fs.existsSync(summariesDir)) {
    fs.rmSync(summariesDir, { recursive: true, force: true });
  }
  fs.mkdirSync(summariesDir, { recursive: true });

  const collectionsDir = path.join(wikiDir, 'collections');
  if (fs.existsSync(collectionsDir)) {
    fs.rmSync(collectionsDir, { recursive: true, force: true });
  }
  fs.mkdirSync(collectionsDir, { recursive: true });

  const overviewsDir = path.join(wikiDir, 'overviews');
  if (fs.existsSync(overviewsDir)) {
    fs.rmSync(overviewsDir, { recursive: true, force: true });
  }
  fs.mkdirSync(overviewsDir, { recursive: true });

  // 2. Discover date folders
  const dateFolders = fs.readdirSync(assetsDirParent).filter(f => {
    return fs.statSync(path.join(assetsDirParent, f)).isDirectory() && /^\d{4}-\d{2}-\d{2}$/.test(f);
  }).sort();

  const processedSummaries: { summaryPath: string; frontmatter: any }[] = [];

  // Load summary templates
  const summaryPromptTemplate = fs.readFileSync(path.join(absolutePath, 'config', 'summary', 'prompt.md'), 'utf8');
  const summaryBaseSchema = fs.readFileSync(path.join(absolutePath, 'config', 'summary', 'schema.yml'), 'utf8');

  // Load plugin schemas
  const schemasDir = path.join(absolutePath, 'plugins', 'collections');
  const schemaInstructions: string[] = [];
  const schemaKeys: string[] = [];
  const activeSchemas = fs.existsSync(schemasDir)
    ? fs.readdirSync(schemasDir).filter(f => fs.statSync(path.join(schemasDir, f)).isDirectory())
    : [];

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

  // Pre-collect all files to process to determine S
  const filesToProcess: { dateFolder: string; file: string }[] = [];
  for (const dateFolder of dateFolders) {
    const processedPath = path.join(assetsDirParent, dateFolder, 'processed');
    if (!fs.existsSync(processedPath)) continue;

    const sourcesFiles = fs.readdirSync(processedPath).filter(f => !f.startsWith('.'));
    const binaryFiles = sourcesFiles.filter(f => !f.endsWith('.md') && !f.endsWith('.txt'));

    for (const file of sourcesFiles) {
      const ext = path.extname(file).toLowerCase();
      const baseName = path.basename(file, ext);
      const isMd = ext === '.md';
      const hasBinaryCompanion = binaryFiles.some(bf => path.basename(bf, path.extname(bf)) === baseName);
      if (isMd && hasBinaryCompanion) {
        continue;
      }
      filesToProcess.push({ dateFolder, file });
    }
  }

  const totalSummaries = filesToProcess.length;
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

  let globalStepIndex = 0;
  let summaryIdx = 0;

  // 3. For each date folder, discover original sources and text transcriptions
  for (const item of filesToProcess) {
    summaryIdx++;
    globalStepIndex++;
    const { dateFolder, file } = item;

    console.log(`[Step ${globalStepIndex}] [Summaries ${summaryIdx}/${totalSummaries}] Re-ingesting asset: ${file} from date ${dateFolder}`);
    console.log(`[Step ${globalStepIndex}] [Summaries ${summaryIdx}/${totalSummaries}] Generating summary for: ${file}`);
    const summaryStartTime = Date.now();

    const processedPath = path.join(assetsDirParent, dateFolder, 'processed');
    const sourcesPath = path.join(assetsDirParent, dateFolder, 'sources');
    const ext = path.extname(file).toLowerCase();
    const baseName = path.basename(file, ext);
    const isMd = ext === '.md';

    let rawTextContent = '';
    let companionMetadataContent = '';
    const referencedAssets: string[] = [];

    if (isMd || ext === '.txt') {
      // Direct text file
      const sourceFilePath = path.join(processedPath, file);
      rawTextContent = fs.readFileSync(sourceFilePath, 'utf8');
      referencedAssets.push(`wiki/assets/${dateFolder}/processed/${file}`);
      if (isMd && fs.existsSync(path.join(sourcesPath, file))) {
        referencedAssets.push(`wiki/assets/${dateFolder}/sources/${file}`);
      }
    } else {
      // Binary file (find transcription and metadata in sources/)
      referencedAssets.push(`wiki/assets/${dateFolder}/processed/${file}`);

      // Find transcription file in sources
      const transcriptionFilename = `${baseName}_transcription.txt`;
      const transcriptionPath = path.join(sourcesPath, transcriptionFilename);
      if (fs.existsSync(transcriptionPath)) {
        rawTextContent = fs.readFileSync(transcriptionPath, 'utf8');
        referencedAssets.push(`wiki/assets/${dateFolder}/sources/${transcriptionFilename}`);
      } else {
        console.warn(`Warning: Transcription file not found at ${transcriptionPath}`);
        rawTextContent = `[Missing transcription for ${file}]`;
      }

      // Find companion metadata in sources
      const companionMd = `${baseName}.md`;
      const companionPath = path.join(sourcesPath, companionMd);
      if (fs.existsSync(companionPath)) {
        companionMetadataContent = fs.readFileSync(companionPath, 'utf8');
        referencedAssets.push(`wiki/assets/${dateFolder}/processed/${companionMd}`);
        referencedAssets.push(`wiki/assets/${dateFolder}/sources/${companionMd}`);
      }
    }

    // Generate summary
    let summaryText = '';
    const combinedInput = companionMetadataContent
      ? `Companion Metadata Context:\n${companionMetadataContent}\n\nSource Content:\n${rawTextContent}`
      : rawTextContent;

    if (options?.verbose) {
      console.log(`[VERBOSE] Summary prompt for ${file} during resync:`);
      console.log('--------------------------------------------------');
      console.log(summaryPrompt);
      console.log('==================================================');
    }

    try {
      summaryText = await callAgenticModel([
        { role: 'system', content: summaryPrompt },
        { role: 'user', content: combinedInput }
      ]);
      summaryText = cleanMarkdownResponse(summaryText);
      stats.summariesSuccess++;
      console.log(`[Step ${globalStepIndex}] [Summaries ${summaryIdx}/${totalSummaries}] Done in ${((Date.now() - summaryStartTime) / 1000).toFixed(1)}s`);
    } catch (e: any) {
      console.error(`LLM synthesis failed for ${file} during resync:`, e.message);
      stats.summariesFailed++;
      continue;
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
    gitCommit(summaryPath, `Added summary for ${frontmatter.title}`);

    processedSummaries.push({
      summaryPath,
      frontmatter
    });
  }

  // Pre-load prompt & properties templates for active schemas
  const schemaTemplates: Record<string, { promptTemplate: string; schemaProperties: string } | null> = {};
  for (const schemaName of activeSchemas) {
    stats.entitiesSuccess[schemaName] = 0;
    stats.entitiesFailed[schemaName] = 0;

    const schemaPromptPath = path.join(schemasDir, schemaName, 'prompt.md');
    const schemaPropertiesPath = path.join(schemasDir, schemaName, 'schema.yml');
    if (!fs.existsSync(schemaPromptPath) || !fs.existsSync(schemaPropertiesPath)) {
      schemaTemplates[schemaName] = null;
      continue;
    }

    const promptContentRaw = fs.readFileSync(schemaPromptPath, 'utf8');
    let promptTemplate = promptContentRaw;
    let promptConfig: any = {};
    const frontmatterMatch = promptContentRaw.match(/^---\r?\n([\s\S]*?)\r?\n---(?:\r?\n|$)/);
    if (frontmatterMatch) {
      try {
        promptConfig = YAML.parse(frontmatterMatch[1]) || {};
        promptTemplate = promptContentRaw.slice(frontmatterMatch[0].length);
      } catch (e: any) {
        console.error(`Failed to parse 'prompt.md' frontmatter for plugin ${schemaName} during resync:`, e.message);
      }
    }

    const rawSchemaContent = fs.readFileSync(schemaPropertiesPath, 'utf8');
    let schemaProperties = rawSchemaContent;
    try {
      const doc = YAML.parseDocument(rawSchemaContent);
      if (doc && doc.contents && YAML.isMap(doc.contents)) {
        // Remove $meta
        const metaIndex = doc.contents.items.findIndex(item => item.key && (item.key as any).value === '$meta');
        if (metaIndex !== -1) {
          doc.contents.items.splice(metaIndex, 1);
        }
        // Auto-inject missing system keys
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

    schemaTemplates[schemaName] = {
      promptTemplate,
      schemaProperties
    };
  }

  // 4. Progressively Compile Entities
  console.log('Compiling entity pages from new summaries...');
  const entityTasksBySchema: Record<string, { entityName: string; summaryContent: string; summaryPath: string }[]> = {};
  for (const schemaName of activeSchemas) {
    entityTasksBySchema[schemaName] = [];
  }

  for (const item of processedSummaries) {
    const summaryContent = fs.readFileSync(item.summaryPath, 'utf8');
    const entities = item.frontmatter;

    for (const schemaName of activeSchemas) {
      const template = schemaTemplates[schemaName];
      if (!template) continue;

      const schemaPromptPath = path.join(schemasDir, schemaName, 'prompt.md');
      const promptContentRaw = fs.readFileSync(schemaPromptPath, 'utf8');
      let promptConfig: any = {};
      const frontmatterMatch = promptContentRaw.match(/^---\r?\n([\s\S]*?)\r?\n---(?:\r?\n|$)/);
      if (frontmatterMatch) {
        try {
          promptConfig = YAML.parse(frontmatterMatch[1]) || {};
        } catch {}
      }

      let targetFields: string[] = [];
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
            entityName = String(entityVal.name || entityVal.title || entityVal.event || '').trim();
          }

          if (!entityName) continue;
          entityTasksBySchema[schemaName].push({
            entityName,
            summaryContent,
            summaryPath: item.summaryPath
          });
        }
      }
    }
  }

  const totalEntities = Object.values(entityTasksBySchema).reduce((acc, tasks) => acc + tasks.length, 0);

  const overviewsPluginDir = path.join(absolutePath, 'plugins', 'overviews');
  const overviewScripts = fs.existsSync(overviewsPluginDir) ? fs.readdirSync(overviewsPluginDir).filter(f => f.endsWith('.js')) : [];
  const totalOverviews = overviewScripts.length;
  const totalIndexes = activeSchemas.length + 4;
  const totalSteps = totalSummaries + totalEntities + totalOverviews + totalIndexes;

  // Execute entity compilations
  for (const schemaName of activeSchemas) {
    const tasks = entityTasksBySchema[schemaName];
    const totalSchemaTasks = tasks.length;
    let schemaTaskIdx = 0;

    const template = schemaTemplates[schemaName];
    if (!template) continue;

    for (const task of tasks) {
      schemaTaskIdx++;
      globalStepIndex++;

      const { entityName, summaryContent } = task;
      console.log(`[Step ${globalStepIndex}/${totalSteps}] [${schemaName} ${schemaTaskIdx}/${totalSchemaTasks}] Compiling: ${entityName}`);
      const entityStartTime = Date.now();
      const entityFilename = toSafeFilename(entityName);
      const collectionFolder = path.join(wikiDir, 'collections', schemaName);
      fs.mkdirSync(collectionFolder, { recursive: true });
      const entityPath = path.join(collectionFolder, entityFilename);

      let existingContent = '';
      if (fs.existsSync(entityPath)) {
        existingContent = fs.readFileSync(entityPath, 'utf8');
      }

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
        console.log(`[VERBOSE] Entity prompt for ${entityName} (${schemaName}) during resync:`);
        console.log('--------------------------------------------------');
        console.log(prompt);
        console.log('==================================================');
      }

      let compiledText = '';
      try {
        compiledText = await callAgenticModel([{ role: 'user', content: prompt }]);
        compiledText = cleanMarkdownResponse(compiledText);
        fs.writeFileSync(entityPath, compiledText, 'utf8');
        gitCommit(entityPath, `Updated ${schemaName} entity card: ${entityName}`);
        stats.entitiesSuccess[schemaName]++;
        console.log(`[Step ${globalStepIndex}/${totalSteps}] [${schemaName} ${schemaTaskIdx}/${totalSchemaTasks}] Done in ${((Date.now() - entityStartTime) / 1000).toFixed(1)}s`);
      } catch (e: any) {
        console.error(`Failed to compile entity ${entityName} during resync:`, e.message);
        stats.entitiesFailed[schemaName]++;
      }
    }
  }

  // 5. Compile Overviews and Rebuild Indexes
  await overviewsWiki(absolutePath, undefined, { verbose: options?.verbose });
  enableGitCommits(!!options?.pr);

  // Print final summary stats
  console.log('\nResync complete.');
  console.log(`- Summaries generated: ${stats.summariesSuccess}/${totalSummaries} (${stats.summariesFailed} failed)`);
  for (const schemaName of activeSchemas) {
    const totalSchemaTasks = entityTasksBySchema[schemaName].length;
    console.log(`- ${schemaName.charAt(0).toUpperCase() + schemaName.slice(1)} compiled: ${stats.entitiesSuccess[schemaName]}/${totalSchemaTasks} (${stats.entitiesFailed[schemaName]} failed)`);
  }
  console.log();

  if (options?.pr && branchName) {
    gitCreatePR(absolutePath, branchName);
  }
}
