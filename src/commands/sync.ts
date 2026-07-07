import * as fs from 'fs';
import * as path from 'path';
import { execSync } from 'child_process';
import YAML from 'yaml';
import { config, projectRootDir } from '../utils/config.js';
import { callAgenticModel } from '../utils/openai-api.js';
import {
  getVaultDir,
  getVaultWikiDir,
  readFrontmatter,
  toSafeFilename,
  cleanMarkdownResponse,
  rebuildFolderIndex,
  rebuildWikiRootIndex,
  rebuildTagsPage,
  cleanContentBody,
  getFormattedDateTime
} from '../utils/fs-utils.js';
import { gitCommit, gitCreateBranch, gitCreatePR, enableGitCommits } from '../utils/git.js';
import { buildSessionGraph, runOverviewScript } from '../utils/overview-runner.js';
import { checkPlugins } from './check-plugins.js';
import { initWiki } from './init.js';
import { overviewsWiki } from './overviews.js';
import { parseSchema, loadAndInjectSchemaProperties } from '../utils/schema-parser.js';

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
 * Runs OCR on an image file using the configured multimodal LLM.
 */
async function ocrImage(imgPath: string): Promise<string> {
  const ext = path.extname(imgPath).toLowerCase();
  const format = ext === '.jpg' ? 'jpeg' : ext.slice(1);
  const base64Img = fs.readFileSync(imgPath).toString('base64');

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };
  if (config.ocrModelApiKey && config.ocrModelApiKey !== 'dummy-key') {
    headers['Authorization'] = `Bearer ${config.ocrModelApiKey}`;
  }

  const payload = {
    model: config.ocrModelName,
    messages: [
      {
        role: 'user',
        content: [
          {
            type: 'text',
            text: 'Perform OCR on this image and return the text. Do not include markdown code block wraps.',
          },
          {
            type: 'image_url',
            image_url: {
              url: `data:image/${format};base64,${base64Img}`,
            },
          },
        ],
      },
    ],
  };

  const response = await fetch(config.ocrModelApiUrl, {
    method: 'POST',
    headers: headers,
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    throw new Error(`HTTP error! status: ${response.status}`);
  }

  const data = (await response.json()) as any;
  const content = data?.choices?.[0]?.message?.content;
  if (!content) {
    throw new Error('Empty OCR response content');
  }
  return content.trim();
}

/**
 * Processes PDF files using pdftoppm and ocrImage.
 */
async function processPdf(pdfPath: string, tempDir: string): Promise<string> {
  try {
    fs.mkdirSync(tempDir, { recursive: true });
    execSync(`pdftoppm -png -r 150 "${pdfPath}" "${path.join(tempDir, 'page')}"`, { stdio: 'ignore' });
    const pageFiles = fs.readdirSync(tempDir)
      .filter(f => f.startsWith('page-') && f.endsWith('.png'))
      .sort();

    let combinedText = '';
    for (const pageFile of pageFiles) {
      const pagePath = path.join(tempDir, pageFile);
      console.log(`OCRing PDF page: ${pageFile}`);
      const pageText = await ocrImage(pagePath);
      combinedText += pageText + '\n\n';
    }
    return combinedText.trim();
  } catch (e: any) {
    console.warn(`pdftoppm PDF extraction failed or not available for ${pdfPath}. Using fallback placeholder. Error:`, e.message);
    return `[PDF Content Placeholder for ${path.basename(pdfPath)}]`;
  } finally {
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
}

/**
 * Syncs the inbox folder with the wiki database.
 */
export async function syncWiki(wikiPath: string, options?: { pr?: boolean; verbose?: boolean }): Promise<void> {
  enableGitCommits(!!options?.pr);
  const absolutePath = path.resolve(wikiPath);

  // Implicitly create folders/files for the wiki if missing
  await initWiki(absolutePath, { overwrite: false });

  // Run check-plugin implicitly on all plugins before sync
  const pluginsCollectionsDir = path.join(absolutePath, 'plugins', 'collections');
  if (fs.existsSync(pluginsCollectionsDir)) {
    const folders = fs.readdirSync(pluginsCollectionsDir).filter(f => fs.statSync(path.join(pluginsCollectionsDir, f)).isDirectory());
    for (const folder of folders) {
      await checkPlugins(path.join(pluginsCollectionsDir, folder));
    }
  }

  const inboxDir = path.join(absolutePath, 'inbox');
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

  const wikiDir = path.join(absolutePath, 'wiki');

  let branchName = '';
  if (options?.pr) {
    const timestamp = new Date().toISOString()
      .replace(/[-:]/g, '')
      .replace('T', '-')
      .split('.')[0];
    branchName = `sync-${timestamp}`;
    gitCreateBranch(absolutePath, branchName);
  }

  if (!fs.existsSync(inboxDir)) {
    console.log('Inbox directory does not exist. Skipping sync.');
    return;
  }

  const inboxFiles = fs.readdirSync(inboxDir).filter(file => {
    return !file.startsWith('.') && fs.statSync(path.join(inboxDir, file)).isFile();
  });

  if (inboxFiles.length === 0) {
    console.log('Inbox is empty. Nothing to sync.');
    return;
  }

  const dateToday = getFormattedDateTime();
  const assetsDateDir = path.join(wikiDir, 'assets', dateToday);
  const processedDir = path.join(assetsDateDir, 'processed');
  const sourcesDir = path.join(assetsDateDir, 'sources');

  fs.mkdirSync(processedDir, { recursive: true });
  fs.mkdirSync(sourcesDir, { recursive: true });

  // Separate companion md files and group them by base filename
  const mdFiles = inboxFiles.filter(f => f.endsWith('.md'));
  const binaryFiles = inboxFiles.filter(f => !f.endsWith('.md'));

  const filesToProcess = inboxFiles.filter(file => {
    const ext = path.extname(file).toLowerCase();
    const isMd = ext === '.md';
    const baseName = path.basename(file, ext);
    const hasBinaryCompanion = binaryFiles.some(bf => path.basename(bf, path.extname(bf)) === baseName);
    return !(isMd && hasBinaryCompanion);
  });

  const totalSummaries = filesToProcess.length;
  if (totalSummaries === 0) {
    console.log('No inbox files to process. Skipping sync.');
    return;
  }

  const processedSummaries: { summaryPath: string; frontmatter: any }[] = [];

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

  // 1. Process inbox files
  if (parallelPromptExecution) {
    console.log(`Executing summary prompts in parallel...`);
    let finishedSummaries = 0;
    const summaryPromises = filesToProcess.map(async (file, index) => {
      const summaryIdx = index + 1;
      const ext = path.extname(file).toLowerCase();
      const isMd = ext === '.md';
      const baseName = path.basename(file, ext);
      const filePath = path.join(inboxDir, file);

      const summaryStartTime = Date.now();
      let rawTextContent = '';
      let companionMetadataContent = '';
      const referencedAssets: string[] = [];

      if (isMd || ext === '.txt') {
        rawTextContent = fs.readFileSync(filePath, 'utf8');
        const destProcessed = path.join(processedDir, file);
        fs.copyFileSync(filePath, destProcessed);
        referencedAssets.push(`wiki/assets/${dateToday}/processed/${file}`);

        if (isMd) {
          const destSource = path.join(sourcesDir, file);
          fs.copyFileSync(filePath, destSource);
          referencedAssets.push(`wiki/assets/${dateToday}/sources/${file}`);
        }
      } else {
        const destProcessed = path.join(processedDir, file);
        fs.copyFileSync(filePath, destProcessed);
        referencedAssets.push(`wiki/assets/${dateToday}/processed/${file}`);

        let extractedText = '';
        if (['.png', '.jpg', '.jpeg'].includes(ext)) {
          try {
            extractedText = await ocrImage(filePath);
          } catch (e: any) {
            console.error(`OCR failed for image ${file}:`, e.message);
            extractedText = `[OCR failed for image ${file}]`;
          }
        } else if (ext === '.pdf') {
          const tempPdfDir = path.join(absolutePath, 'inbox', `temp-pdf-${baseName}`);
          extractedText = await processPdf(filePath, tempPdfDir);
        } else {
          extractedText = `[Audio/Binary transcription placeholder for ${file}]`;
        }

        const txtFilename = `${baseName}_transcription.txt`;
        const destSource = path.join(sourcesDir, txtFilename);
        fs.writeFileSync(destSource, extractedText, 'utf8');
        rawTextContent = extractedText;
        referencedAssets.push(`wiki/assets/${dateToday}/sources/${txtFilename}`);

        const companionMd = mdFiles.find(mf => path.basename(mf, '.md') === baseName);
        if (companionMd) {
          const companionPath = path.join(inboxDir, companionMd);
          companionMetadataContent = fs.readFileSync(companionPath, 'utf8');
          const companionDestProcessed = path.join(processedDir, companionMd);
          const companionDestSource = path.join(sourcesDir, companionMd);
          fs.copyFileSync(companionPath, companionDestProcessed);
          fs.copyFileSync(companionPath, companionDestSource);
          referencedAssets.push(`wiki/assets/${dateToday}/processed/${companionMd}`);
          referencedAssets.push(`wiki/assets/${dateToday}/sources/${companionMd}`);
          fs.unlinkSync(companionPath);
        }
      }

      const summaryPromptTemplate = fs.readFileSync(path.join(absolutePath, 'config', 'summary', 'prompt.md'), 'utf8');
      const summaryBaseSchema = fs.readFileSync(path.join(absolutePath, 'config', 'summary', 'schema.yml'), 'utf8');

      const schemasDir = path.join(absolutePath, 'plugins', 'collections');
      const schemaInstructions: string[] = [];

      if (fs.existsSync(schemasDir)) {
        const folders = fs.readdirSync(schemasDir).filter(f => fs.statSync(path.join(schemasDir, f)).isDirectory());
        for (const folder of folders) {
          const extensionPath = path.join(schemasDir, folder, 'summary-schema-extension.yml');
          if (fs.existsSync(extensionPath)) {
            const fmContent = fs.readFileSync(extensionPath, 'utf8');
            schemaInstructions.push(parseSchemaProperties(fmContent));
          }
        }
      }

      const baseProperties = parseSchemaProperties(summaryBaseSchema);
      const dynamicFrontmatter = [baseProperties, ...schemaInstructions].filter(Boolean).join('\n');
      const summaryPrompt = summaryPromptTemplate.replace('$SCHEMA', dynamicFrontmatter);

      const combinedInput = companionMetadataContent 
        ? `Companion Metadata Context:\n${companionMetadataContent}\n\nSource Content:\n${rawTextContent}`
        : rawTextContent;

      let summaryText = '';
      try {
        summaryText = await callAgenticModel([
          { role: 'system', content: summaryPrompt },
          { role: 'user', content: combinedInput }
        ]);
        summaryText = cleanMarkdownResponse(summaryText);
        stats.summariesSuccess++;
        const currentStep = ++finishedSummaries;
        console.log(`[Step ${currentStep}] [Summaries ${currentStep}/${totalSummaries}] Done in ${((Date.now() - summaryStartTime) / 1000).toFixed(1)}s`);
      } catch (e: any) {
        console.error(`LLM synthesis failed for ${file}:`, e.message);
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
      } else if (summaryText.startsWith('---')) {
        const parts = summaryText.split('---');
        if (parts.length >= 3) {
          frontmatterStr = parts[1].trim();
          bodyContent = parts.slice(2).join('---').trim();
        }
      }

      if (frontmatterStr.startsWith('---')) frontmatterStr = frontmatterStr.slice(3).trim();
      if (frontmatterStr.endsWith('---')) frontmatterStr = frontmatterStr.slice(0, -3).trim();

      if (frontmatterStr) {
        const cleanFmStr = frontmatterStr.split('\n').filter(line => !line.trim().startsWith('```')).join('\n').trim();
        try { frontmatter = YAML.parse(cleanFmStr) || {}; } catch (e: any) { console.error('Failed to parse frontmatter:', e.message); }
      }

      frontmatter.type = 'Summary';
      frontmatter.title = frontmatter.title || baseName;
      frontmatter.timestamp = new Date().toISOString().replace(/\.\d{3}Z$/, 'Z');
      frontmatter.assets = referencedAssets;

      const summaryFilename = toSafeFilename(frontmatter.title);
      const summaryPath = path.join(wikiDir, 'summaries', summaryFilename);
      fs.writeFileSync(summaryPath, `---\n${YAML.stringify(frontmatter)}---\n${bodyContent}`, 'utf8');
      await queuedGitCommit(summaryPath, `Added summary for ${frontmatter.title}`);
      fs.unlinkSync(filePath);

      processedSummaries.push({ summaryPath, frontmatter });
    });
    await Promise.all(summaryPromises);
    globalStepIndex = totalSummaries;
  } else {
    for (const file of filesToProcess) {
      summaryIdx++;
      globalStepIndex++;

      const ext = path.extname(file).toLowerCase();
      const isMd = ext === '.md';
      const baseName = path.basename(file, ext);
      const filePath = path.join(inboxDir, file);

      console.log(`[Step ${globalStepIndex}] [Summaries ${summaryIdx}/${totalSummaries}] Processing file from inbox: ${file}`);
      console.log(`[Step ${globalStepIndex}] [Summaries ${summaryIdx}/${totalSummaries}] Generating summary for: ${file}`);
      const summaryStartTime = Date.now();

      let rawTextContent = '';
      let companionMetadataContent = '';
      const referencedAssets: string[] = [];

      if (isMd || ext === '.txt') {
        rawTextContent = fs.readFileSync(filePath, 'utf8');
        const destProcessed = path.join(processedDir, file);
        fs.copyFileSync(filePath, destProcessed);
        referencedAssets.push(`wiki/assets/${dateToday}/processed/${file}`);

        if (isMd) {
          const destSource = path.join(sourcesDir, file);
          fs.copyFileSync(filePath, destSource);
          referencedAssets.push(`wiki/assets/${dateToday}/sources/${file}`);
        }
      } else {
        const destProcessed = path.join(processedDir, file);
        fs.copyFileSync(filePath, destProcessed);
        referencedAssets.push(`wiki/assets/${dateToday}/processed/${file}`);

        let extractedText = '';
        if (['.png', '.jpg', '.jpeg'].includes(ext)) {
          try {
            extractedText = await ocrImage(filePath);
          } catch (e: any) {
            console.error(`OCR failed for image ${file}:`, e.message);
            extractedText = `[OCR failed for image ${file}]`;
          }
        } else if (ext === '.pdf') {
          const tempPdfDir = path.join(absolutePath, 'inbox', `temp-pdf-${baseName}`);
          extractedText = await processPdf(filePath, tempPdfDir);
        } else {
          extractedText = `[Audio/Binary transcription placeholder for ${file}]`;
        }

        const txtFilename = `${baseName}_transcription.txt`;
        const destSource = path.join(sourcesDir, txtFilename);
        fs.writeFileSync(destSource, extractedText, 'utf8');
        rawTextContent = extractedText;
        referencedAssets.push(`wiki/assets/${dateToday}/sources/${txtFilename}`);

        const companionMd = mdFiles.find(mf => path.basename(mf, '.md') === baseName);
        if (companionMd) {
          const companionPath = path.join(inboxDir, companionMd);
          companionMetadataContent = fs.readFileSync(companionPath, 'utf8');
          const companionDestProcessed = path.join(processedDir, companionMd);
          const companionDestSource = path.join(sourcesDir, companionMd);
          fs.copyFileSync(companionPath, companionDestProcessed);
          fs.copyFileSync(companionPath, companionDestSource);
          referencedAssets.push(`wiki/assets/${dateToday}/processed/${companionMd}`);
          referencedAssets.push(`wiki/assets/${dateToday}/sources/${companionMd}`);
          fs.unlinkSync(companionPath);
        }
      }

      const summaryPromptTemplate = fs.readFileSync(path.join(absolutePath, 'config', 'summary', 'prompt.md'), 'utf8');
      const summaryBaseSchema = fs.readFileSync(path.join(absolutePath, 'config', 'summary', 'schema.yml'), 'utf8');

      const schemasDir = path.join(absolutePath, 'plugins', 'collections');
      const schemaInstructions: string[] = [];

      if (fs.existsSync(schemasDir)) {
        const folders = fs.readdirSync(schemasDir).filter(f => fs.statSync(path.join(schemasDir, f)).isDirectory());
        for (const folder of folders) {
          const extensionPath = path.join(schemasDir, folder, 'summary-schema-extension.yml');
          if (fs.existsSync(extensionPath)) {
            const fmContent = fs.readFileSync(extensionPath, 'utf8');
            schemaInstructions.push(parseSchemaProperties(fmContent));
          }
        }
      }

      const baseProperties = parseSchemaProperties(summaryBaseSchema);
      const dynamicFrontmatter = [baseProperties, ...schemaInstructions].filter(Boolean).join('\n');
      const summaryPrompt = summaryPromptTemplate.replace('$SCHEMA', dynamicFrontmatter);

      const combinedInput = companionMetadataContent 
        ? `Companion Metadata Context:\n${companionMetadataContent}\n\nSource Content:\n${rawTextContent}`
        : rawTextContent;

      let summaryText = '';
      try {
        summaryText = await callAgenticModel([
          { role: 'system', content: summaryPrompt },
          { role: 'user', content: combinedInput }
        ]);
        summaryText = cleanMarkdownResponse(summaryText);
        stats.summariesSuccess++;
        console.log(`[Step ${globalStepIndex}] [Summaries ${summaryIdx}/${totalSummaries}] Done in ${((Date.now() - summaryStartTime) / 1000).toFixed(1)}s`);
      } catch (e: any) {
        console.error(`LLM synthesis failed for ${file}:`, e.message);
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
      } else if (summaryText.startsWith('---')) {
        const parts = summaryText.split('---');
        if (parts.length >= 3) {
          frontmatterStr = parts[1].trim();
          bodyContent = parts.slice(2).join('---').trim();
        }
      }

      if (frontmatterStr.startsWith('---')) frontmatterStr = frontmatterStr.slice(3).trim();
      if (frontmatterStr.endsWith('---')) frontmatterStr = frontmatterStr.slice(0, -3).trim();

      if (frontmatterStr) {
        const cleanFmStr = frontmatterStr.split('\n').filter(line => !line.trim().startsWith('```')).join('\n').trim();
        try { frontmatter = YAML.parse(cleanFmStr) || {}; } catch (e: any) { console.error('Failed to parse frontmatter:', e.message); }
      }

      frontmatter.type = 'Summary';
      frontmatter.title = frontmatter.title || baseName;
      frontmatter.timestamp = new Date().toISOString().replace(/\.\d{3}Z$/, 'Z');
      frontmatter.assets = referencedAssets;

      const summaryFilename = toSafeFilename(frontmatter.title);
      const summaryPath = path.join(wikiDir, 'summaries', summaryFilename);
      fs.writeFileSync(summaryPath, `---\n${YAML.stringify(frontmatter)}---\n${bodyContent}`, 'utf8');
      gitCommit(summaryPath, `Added summary for ${frontmatter.title}`);
      fs.unlinkSync(filePath);

      processedSummaries.push({ summaryPath, frontmatter });
    }
  }

  // 2. Pre-collect and compile entity pages
  console.log('Compiling entity pages from new summaries...');
  const schemasDir = path.join(absolutePath, 'plugins', 'collections');
  const activeSchemas = fs.existsSync(schemasDir) 
    ? fs.readdirSync(schemasDir).filter(f => fs.statSync(path.join(schemasDir, f)).isDirectory())
    : [];

  const schemaTotalTasks: Record<string, number> = {};
  const schemaTaskCounts: Record<string, number> = {};
  for (const schemaName of activeSchemas) {
    schemaTotalTasks[schemaName] = 0;
    schemaTaskCounts[schemaName] = 0;
    stats.entitiesSuccess[schemaName] = 0;
    stats.entitiesFailed[schemaName] = 0;
  }

  // Pre-calculate total entities per schema
  for (const item of processedSummaries) {
    const entities = item.frontmatter;
    for (const schemaName of activeSchemas) {
      const singular = schemaName.replace(/s$/, '');
      const summaryKeys = [schemaName, singular].filter(k => entities[k] !== undefined);
      if (summaryKeys.length === 0) continue;

      let entityList = entities[summaryKeys[0]];
      if (entityList && typeof entityList === 'object' && !Array.isArray(entityList)) {
        const nestedKey = Object.keys(entityList).find(k => k.toLowerCase().startsWith(schemaName.toLowerCase()));
        if (nestedKey) entityList = (entityList as any)[nestedKey];
      }

      if (!Array.isArray(entityList)) continue;

      for (const entityVal of entityList) {
        let entityName = '';
        if (typeof entityVal === 'string') entityName = entityVal.trim();
        else if (typeof entityVal === 'object' && entityVal !== null) entityName = String(entityVal.name || entityVal.title || '').trim();

        if (entityName) {
          schemaTotalTasks[schemaName]++;
        }
      }
    }
  }

  const totalEntities = Object.values(schemaTotalTasks).reduce((acc, count) => acc + count, 0);
  const overviewsPluginDir = path.join(absolutePath, 'plugins', 'overviews');
  const overviewScripts = fs.existsSync(overviewsPluginDir) ? fs.readdirSync(overviewsPluginDir).filter(f => f.endsWith('.js')) : [];
  const totalOverviews = overviewScripts.length;
  const totalIndexes = activeSchemas.length + 4;
  const totalSteps = totalSummaries + totalEntities + totalOverviews + totalIndexes;

  // Process entities summary-by-summary
  for (const item of processedSummaries) {
    const summaryContent = fs.readFileSync(item.summaryPath, 'utf8');
    const entities = item.frontmatter;

    const summaryTasks: { schemaName: string; entityName: string; summaryContent: string; summaryPath: string }[] = [];
    for (const schemaName of activeSchemas) {
      const singular = schemaName.replace(/s$/, '');
      const summaryKeys = [schemaName, singular].filter(k => entities[k] !== undefined);
      if (summaryKeys.length === 0) continue;

      let entityList = entities[summaryKeys[0]];
      if (entityList && typeof entityList === 'object' && !Array.isArray(entityList)) {
        const nestedKey = Object.keys(entityList).find(k => k.toLowerCase().startsWith(schemaName.toLowerCase()));
        if (nestedKey) entityList = (entityList as any)[nestedKey];
      }

      if (!Array.isArray(entityList)) continue;

      for (const entityVal of entityList) {
        let entityName = '';
        if (typeof entityVal === 'string') entityName = entityVal.trim();
        else if (typeof entityVal === 'object' && entityVal !== null) entityName = String(entityVal.name || entityVal.title || '').trim();

        if (entityName) {
          summaryTasks.push({ schemaName, entityName, summaryContent, summaryPath: item.summaryPath });
        }
      }
    }

    if (summaryTasks.length === 0) continue;

    if (parallelPromptExecution) {
      console.log(`Executing collection prompts for summary in parallel: ${path.basename(item.summaryPath)}`);
      let finishedEntities = 0;
      const tasksWithIdx = summaryTasks.map(task => {
        schemaTaskCounts[task.schemaName]++;
        return {
          ...task,
          taskIdx: schemaTaskCounts[task.schemaName]
        };
      });

      const entityPromises = tasksWithIdx.map(async (task) => {
        const { schemaName, entityName, summaryContent, taskIdx } = task;
        const entityStartTime = Date.now();
        
        const entityFilename = toSafeFilename(entityName);
        const collectionFolder = path.join(wikiDir, 'collections', schemaName);
        fs.mkdirSync(collectionFolder, { recursive: true });
        const entityPath = path.join(collectionFolder, entityFilename);

        let existingContent = fs.existsSync(entityPath) ? fs.readFileSync(entityPath, 'utf8') : '';
        const schemaPromptPath = path.join(schemasDir, schemaName, 'prompt.md');
        const schemaPropertiesPath = path.join(schemasDir, schemaName, 'schema.yml');
        
        if (!fs.existsSync(schemaPromptPath) || !fs.existsSync(schemaPropertiesPath)) {
          stats.entitiesFailed[schemaName]++;
          return;
        }

        const promptTemplate = fs.readFileSync(schemaPromptPath, 'utf8');
        const rawSchemaContent = fs.readFileSync(schemaPropertiesPath, 'utf8');
        const schemaProperties = loadAndInjectSchemaProperties(rawSchemaContent, schemaName);

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

        try {
          const compiledText = cleanMarkdownResponse(await callAgenticModel([{ role: 'user', content: prompt }]));
          fs.writeFileSync(entityPath, compiledText, 'utf8');
          await queuedGitCommit(entityPath, `Updated ${schemaName} entity card: ${entityName}`);
          stats.entitiesSuccess[schemaName]++;
          const currentFinished = ++finishedEntities;
          console.log(`[Step ${globalStepIndex + currentFinished}/${totalSteps}] [${schemaName} ${taskIdx}/${schemaTotalTasks[schemaName]}] Done in ${((Date.now() - entityStartTime) / 1000).toFixed(1)}s`);
        } catch (e: any) {
          console.error(`Failed to compile entity ${entityName}:`, e.message);
          stats.entitiesFailed[schemaName]++;
        }
      });

      await Promise.all(entityPromises);
      globalStepIndex += summaryTasks.length;
    } else {
      for (const task of summaryTasks) {
        globalStepIndex++;
        const { schemaName, entityName, summaryContent } = task;
        schemaTaskCounts[schemaName]++;
        const taskIdx = schemaTaskCounts[schemaName];
        console.log(`[Step ${globalStepIndex}/${totalSteps}] [${schemaName} ${taskIdx}/${schemaTotalTasks[schemaName]}] Compiling: ${entityName}`);
        const entityStartTime = Date.now();
        
        const entityFilename = toSafeFilename(entityName);
        const collectionFolder = path.join(wikiDir, 'collections', schemaName);
        fs.mkdirSync(collectionFolder, { recursive: true });
        const entityPath = path.join(collectionFolder, entityFilename);

        let existingContent = fs.existsSync(entityPath) ? fs.readFileSync(entityPath, 'utf8') : '';
        const schemaPromptPath = path.join(schemasDir, schemaName, 'prompt.md');
        const schemaPropertiesPath = path.join(schemasDir, schemaName, 'schema.yml');
        
        if (!fs.existsSync(schemaPromptPath) || !fs.existsSync(schemaPropertiesPath)) {
          stats.entitiesFailed[schemaName]++;
          continue;
        }

        const promptTemplate = fs.readFileSync(schemaPromptPath, 'utf8');
        const rawSchemaContent = fs.readFileSync(schemaPropertiesPath, 'utf8');
        const schemaProperties = loadAndInjectSchemaProperties(rawSchemaContent, schemaName);

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

        try {
          const compiledText = cleanMarkdownResponse(await callAgenticModel([{ role: 'user', content: prompt }]));
          fs.writeFileSync(entityPath, compiledText, 'utf8');
          gitCommit(entityPath, `Updated ${schemaName} entity card: ${entityName}`);
          stats.entitiesSuccess[schemaName]++;
          console.log(`[Step ${globalStepIndex}/${totalSteps}] [${schemaName} ${taskIdx}/${schemaTotalTasks[schemaName]}] Done in ${((Date.now() - entityStartTime) / 1000).toFixed(1)}s`);
        } catch (e: any) {
          console.error(`Failed to compile entity ${entityName}:`, e.message);
          stats.entitiesFailed[schemaName]++;
        }
      }
    }
  }

  // Await any remaining git commits
  await gitCommitQueue;

  // 3. Compile Overviews and Rebuild Indexes
  await overviewsWiki(absolutePath, undefined, { verbose: options?.verbose });
  enableGitCommits(!!options?.pr);

  console.log('\nSync pipeline complete.');
  console.log(`- Summaries generated: ${stats.summariesSuccess}/${totalSummaries} (${stats.summariesFailed} failed)`);
  for (const schemaName of activeSchemas) {
    const totalSchemaTasks = schemaTotalTasks[schemaName];
    console.log(`- ${schemaName.charAt(0).toUpperCase() + schemaName.slice(1)} compiled: ${stats.entitiesSuccess[schemaName]}/${totalSchemaTasks} (${stats.entitiesFailed[schemaName]} failed)`);
  }
  console.log();

  if (options?.pr && branchName) {
    gitCreatePR(absolutePath, branchName);
  }
}
