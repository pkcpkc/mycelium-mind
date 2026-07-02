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
  cleanContentBody
} from '../utils/fs-utils.js';
import { gitCommit, gitCreateBranch, gitCreatePR, enableGitCommits } from '../utils/git.js';
import { buildSessionGraph, runOverviewScript } from '../utils/overview-runner.js';
import { checkPlugin } from './check-plugin.js';
import { initWiki } from './init.js';



// Parses properties table from schema markdown
function parseSchemaProperties(markdown: string): string {
  const lines = markdown.split('\n');
  const specLines: string[] = [];
  let inTable = false;

  for (const line of lines) {
    const trimmed = line.trim();
    if (trimmed.startsWith('|')) {
      if (trimmed.includes('---')) continue; // Skip separator line
      if (trimmed.toLowerCase().includes('key') && trimmed.toLowerCase().includes('type')) {
        continue; // Skip header line
      }
      const cols = trimmed.split('|').map(c => c.trim()).filter((_, idx, arr) => idx > 0 && idx < arr.length - 1);
      if (cols.length >= 3) {
        specLines.push(`- '${cols[0]}' (${cols[2]}, ${cols[1]}): ${cols[3] || ''}`);
      }
    }
  }

  return specLines.join('\n');
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
  if (config.apiKey && config.apiKey !== 'dummy-key') {
    headers['Authorization'] = `Bearer ${config.apiKey}`;
  }

  const payload = {
    model: config.ocrModelName || config.agenticModelName,
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

  const response = await fetch(config.apiUrl, {
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
export async function syncWiki(wikiPath: string, options?: { commit?: boolean; branch?: boolean; pr?: boolean; verbose?: boolean }): Promise<void> {
  enableGitCommits(!!(options?.commit || options?.branch || options?.pr));
  const absolutePath = path.resolve(wikiPath);

  // Implicitly create folders/files for the wiki if missing
  await initWiki(absolutePath, { overwrite: false });

  // Run check-plugin implicitly on all plugins before sync
  const pluginsCollectionsDir = path.join(absolutePath, 'plugins', 'collections');
  if (fs.existsSync(pluginsCollectionsDir)) {
    const folders = fs.readdirSync(pluginsCollectionsDir).filter(f => fs.statSync(path.join(pluginsCollectionsDir, f)).isDirectory());
    for (const folder of folders) {
      await checkPlugin(path.join(pluginsCollectionsDir, folder));
    }
  }

  const inboxDir = path.join(absolutePath, 'inbox');
  const wikiDir = path.join(absolutePath, 'wiki');

  let branchName = '';
  if (options?.branch) {
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

  const dateToday = new Date().toISOString().split('T')[0];
  const assetsDateDir = path.join(wikiDir, 'assets', dateToday);
  const processedDir = path.join(assetsDateDir, 'processed');
  const sourcesDir = path.join(assetsDateDir, 'sources');

  fs.mkdirSync(processedDir, { recursive: true });
  fs.mkdirSync(sourcesDir, { recursive: true });

  // Separate companion md files and group them by base filename
  const mdFiles = inboxFiles.filter(f => f.endsWith('.md'));
  const binaryFiles = inboxFiles.filter(f => !f.endsWith('.md'));

  const processedSummaries: { summaryPath: string; frontmatter: any }[] = [];

  // 1. Process inbox files
  for (const file of inboxFiles) {
    // If it's an md file, check if it's companion metadata or a standalone document
    const ext = path.extname(file).toLowerCase();
    const isMd = ext === '.md';
    const baseName = path.basename(file, ext);
    
    // Check if there is a binary with the same name (making this file companion metadata)
    const hasBinaryCompanion = binaryFiles.some(bf => path.basename(bf, path.extname(bf)) === baseName);

    if (isMd && hasBinaryCompanion) {
      // Companion metadata is processed together with the binary, skip standalone processing
      continue;
    }

    const filePath = path.join(inboxDir, file);
    console.log(`Processing file from inbox: ${file}`);

    let originalSourcePath = '';
    let extractedTextPath = '';
    let rawTextContent = '';
    let companionMetadataContent = '';
    const referencedAssets: string[] = [];

    if (isMd || ext === '.txt') {
      // Direct text input
      rawTextContent = fs.readFileSync(filePath, 'utf8');
      
      // Copy to processed/
      const destProcessed = path.join(processedDir, file);
      fs.copyFileSync(filePath, destProcessed);
      originalSourcePath = destProcessed;
      referencedAssets.push(`wiki/assets/${dateToday}/processed/${file}`);

      // If it is md, copy to sources/ as well (per "Original md files should live in both folders")
      if (isMd) {
        const destSource = path.join(sourcesDir, file);
        fs.copyFileSync(filePath, destSource);
        referencedAssets.push(`wiki/assets/${dateToday}/sources/${file}`);
      }
    } else {
      // Binary input (Audio, Image, PDF)
      const destProcessed = path.join(processedDir, file);
      fs.copyFileSync(filePath, destProcessed);
      originalSourcePath = destProcessed;
      referencedAssets.push(`wiki/assets/${dateToday}/processed/${file}`);

      // Extract text content
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
        // Audio or unsupported binaries
        extractedText = `[Audio/Binary transcription placeholder for ${file}]`;
      }

      // Write text transcription to sources/
      const txtFilename = `${baseName}_transcription.txt`;
      const destSource = path.join(sourcesDir, txtFilename);
      fs.writeFileSync(destSource, extractedText, 'utf8');
      extractedTextPath = destSource;
      rawTextContent = extractedText;
      referencedAssets.push(`wiki/assets/${dateToday}/sources/${txtFilename}`);

      // Check for companion metadata file
      const companionMd = mdFiles.find(mf => path.basename(mf, '.md') === baseName);
      if (companionMd) {
        const companionPath = path.join(inboxDir, companionMd);
        companionMetadataContent = fs.readFileSync(companionPath, 'utf8');

        // Copy companion md to both processed/ and sources/
        const companionDestProcessed = path.join(processedDir, companionMd);
        const companionDestSource = path.join(sourcesDir, companionMd);
        fs.copyFileSync(companionPath, companionDestProcessed);
        fs.copyFileSync(companionPath, companionDestSource);
        referencedAssets.push(`wiki/assets/${dateToday}/processed/${companionMd}`);
        referencedAssets.push(`wiki/assets/${dateToday}/sources/${companionMd}`);

        // Delete companion md from inbox
        fs.unlinkSync(companionPath);
      }
    }

    // 2. Generate OKF Summary
    console.log(`Generating summary for: ${file}`);
    
    // Load summary templates
    const summaryPromptTemplate = fs.readFileSync(path.join(absolutePath, 'config', 'summary', 'prompt.md'), 'utf8');
    const summaryBaseSchema = fs.readFileSync(path.join(absolutePath, 'config', 'summary', 'schema.md'), 'utf8');

    // Load plugin schemas
    const schemasDir = path.join(absolutePath, 'plugins', 'collections');
    const schemaInstructions: string[] = [];
    const schemaKeys: string[] = [];

    if (fs.existsSync(schemasDir)) {
      const folders = fs.readdirSync(schemasDir).filter(f => fs.statSync(path.join(schemasDir, f)).isDirectory());
      for (const folder of folders) {
        const frontmatterPath = path.join(schemasDir, folder, 'schema.md');
        if (fs.existsSync(frontmatterPath)) {
          const fmContent = fs.readFileSync(frontmatterPath, 'utf8');
          const propertiesSpec = parseSchemaProperties(fmContent);
          schemaInstructions.push(propertiesSpec);
          schemaKeys.push(folder);
        }
      }
    }

    // Build the dynamic frontmatter block
    const baseProperties = parseSchemaProperties(summaryBaseSchema);
    const dynamicFrontmatter = [baseProperties, ...schemaInstructions].filter(Boolean).join('\n');
    
    const summaryPrompt = summaryPromptTemplate.replace('$SCHEMA', dynamicFrontmatter);

    let summaryText = '';
    const combinedInput = companionMetadataContent 
      ? `Companion Metadata Context:\n${companionMetadataContent}\n\nSource Content:\n${rawTextContent}`
      : rawTextContent;

    if (options?.verbose) {
      console.log(`[VERBOSE] Summary prompt for ${file}:`);
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
    } catch (e: any) {
      console.error(`LLM synthesis failed for ${file}:`, e.message);
      continue;
    }

    // Parse output summary frontmatter
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
        console.error('Failed to parse generated summary frontmatter:', e.message);
        console.error('Raw frontmatter string was:\n', frontmatterStr);
        console.error('Cleaned frontmatter string was:\n', cleanFmStr);
      }
    }

    // Standardize frontmatter
    frontmatter.type = 'Summary';
    frontmatter.title = frontmatter.title || baseName;
    frontmatter.timestamp = new Date().toISOString().replace(/\.\d{3}Z$/, 'Z');
    frontmatter.assets = referencedAssets;

    // Save summary page
    const summaryFilename = toSafeFilename(frontmatter.title);
    const summaryPath = path.join(wikiDir, 'summaries', summaryFilename);
    const finalSummaryContent = `---\n${YAML.stringify(frontmatter)}---\n${bodyContent}`;

    fs.writeFileSync(summaryPath, finalSummaryContent, 'utf8');
    gitCommit(summaryPath, `Added summary for ${frontmatter.title}`);

    // Remove file from inbox
    fs.unlinkSync(filePath);

    processedSummaries.push({
      summaryPath,
      frontmatter
    });
  }

  // 2. Incremental Entity Compilation
  console.log('Compiling entity pages from new summaries...');
  const schemasDir = path.join(absolutePath, 'plugins', 'collections');
  const activeSchemas = fs.existsSync(schemasDir) 
    ? fs.readdirSync(schemasDir).filter(f => fs.statSync(path.join(schemasDir, f)).isDirectory())
    : [];

  for (const item of processedSummaries) {
    const summaryContent = fs.readFileSync(item.summaryPath, 'utf8');
    const entities = item.frontmatter;

    for (const schemaName of activeSchemas) {
      // Support both singular and plural forms (e.g. concepts/concept, persons/person)
      const singular = schemaName.replace(/s$/, '');
      const summaryKeys = [schemaName, singular].filter(k => entities[k] !== undefined);
      if (summaryKeys.length === 0) continue;

      let entityList = entities[summaryKeys[0]];

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

        console.log(`Compiling ${schemaName} page: ${entityName}`);
        
        const entityFilename = toSafeFilename(entityName);
        const collectionFolder = path.join(wikiDir, 'collections', schemaName);
        fs.mkdirSync(collectionFolder, { recursive: true });
        const entityPath = path.join(collectionFolder, entityFilename);

        let existingContent = '';
        if (fs.existsSync(entityPath)) {
          existingContent = fs.readFileSync(entityPath, 'utf8');
        }

        // Load schema configuration
        const schemaPromptPath = path.join(schemasDir, schemaName, 'prompt.md');
        const schemaPropertiesPath = path.join(schemasDir, schemaName, 'schema.md');
        if (!fs.existsSync(schemaPromptPath) || !fs.existsSync(schemaPropertiesPath)) continue;

        const promptTemplate = fs.readFileSync(schemaPromptPath, 'utf8');
        let schemaProperties = fs.readFileSync(schemaPropertiesPath, 'utf8');

        // Automatically inject timestamp and tags descriptions if not present in the schema table
        const autoRows: { key: string; row: string }[] = [
          { key: 'timestamp', row: '| `timestamp` | String | Required | ISO-8601 date of synthesis. Auto-set by the system. |' },
          { key: 'tags', row: '| `tags` | Array | Optional | Categorization tags. |' },
        ];
        for (const { key, row } of autoRows) {
          if (!new RegExp(key, 'i').test(schemaProperties)) {
            const lines = schemaProperties.split('\n');
            let lastTableLineIdx = -1;
            for (let i = lines.length - 1; i >= 0; i--) {
              if (lines[i].trim().startsWith('|') || lines[i].trim().endsWith('|')) {
                lastTableLineIdx = i;
                break;
              }
            }
            if (lastTableLineIdx !== -1) {
              lines.splice(lastTableLineIdx + 1, 0, row);
              schemaProperties = lines.join('\n');
            } else {
              schemaProperties += '\n\n' + row + '\n';
            }
          }
        }

        // Compile prompt with replacements
        const prompt = promptTemplate
          .replace(/\$SCHEMA/g, schemaProperties)
          .replace(/\$VALUE/g, entityName)
          .replace(/\$TIMESTAMP/g, new Date().toISOString().replace(/\.\d{3}Z$/, 'Z'))
          .replace(/\$EXISTING_CONTENT/g, existingContent || '(empty)')
          .replace(/\$SUMMARY_CONTENT/g, summaryContent);

        if (options?.verbose) {
          console.log(`[VERBOSE] Entity prompt for ${entityName} (${schemaName}):`);
          console.log('--------------------------------------------------');
          console.log(prompt);
          console.log('==================================================');
        }

        let compiledText = '';
        try {
          compiledText = await callAgenticModel([{ role: 'user', content: prompt }]);
          compiledText = cleanMarkdownResponse(compiledText);
        } catch (e: any) {
          console.error(`Failed to compile entity ${entityName}:`, e.message);
          continue;
        }

        fs.writeFileSync(entityPath, compiledText, 'utf8');
        gitCommit(entityPath, `Updated ${schemaName} entity card: ${entityName}`);
      }
    }
  }

  // 3. Compile Overviews
  console.log('Generating overviews...');
  const sessionGraph = await buildSessionGraph(wikiDir);
  const overviewsPluginDir = path.join(absolutePath, 'plugins', 'overviews');
  if (fs.existsSync(overviewsPluginDir)) {
    const scripts = fs.readdirSync(overviewsPluginDir).filter(f => f.endsWith('.js'));
    for (const script of scripts) {
      const scriptPath = path.join(overviewsPluginDir, script);
      console.log(`Running overview script: ${script}`);
      try {
        await runOverviewScript(scriptPath, wikiDir, sessionGraph);
      } catch (e: any) {
        console.error(`Overview script ${script} failed:`, e.message);
      }
    }
  }

  // 4. Rebuild Indexes
  console.log('Rebuilding indexes...');
  await rebuildFolderIndex(wikiDir, 'summaries', 'Summaries');
  await rebuildFolderIndex(wikiDir, 'overviews', 'Overviews');
  
  for (const schemaName of activeSchemas) {
    const headerName = schemaName.charAt(0).toUpperCase() + (schemaName.endsWith('s') ? schemaName.slice(1) : schemaName.slice(1) + 's');
    await rebuildFolderIndex(wikiDir, `collections/${schemaName}`, headerName);
  }

  await rebuildWikiRootIndex(wikiDir);
  rebuildTagsPage(wikiDir);

  console.log('Sync pipeline complete.');

  if (options?.pr && branchName) {
    gitCreatePR(absolutePath, branchName);
  }
}
