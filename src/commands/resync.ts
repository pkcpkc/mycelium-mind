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
import { checkPlugin } from './check-plugin.js';
import { initWiki } from './init.js';



// Parses properties table from schema markdown
function parseSchemaProperties(markdown: string): string {
  const lines = markdown.split('\n');
  const specLines: string[] = [];

  for (const line of lines) {
    const trimmed = line.trim();
    if (trimmed.startsWith('|')) {
      if (trimmed.includes('---')) continue;
      if (trimmed.toLowerCase().includes('key') && trimmed.toLowerCase().includes('type')) {
        continue;
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
 * Recreates the wiki by re-summarizing and re-compiling from existing assets.
 */
export async function resyncWiki(wikiPath: string, options?: { commit?: boolean; branch?: boolean; pr?: boolean; verbose?: boolean }): Promise<void> {
  enableGitCommits(!!(options?.commit || options?.branch || options?.pr));
  const absolutePath = path.resolve(wikiPath);

  // Implicitly create folders/files for the wiki if missing
  await initWiki(absolutePath, { overwrite: false });

  // Run check-plugin implicitly on all plugins before resync
  const pluginsCollectionsDir = path.join(absolutePath, 'plugins', 'collections');
  if (fs.existsSync(pluginsCollectionsDir)) {
    const folders = fs.readdirSync(pluginsCollectionsDir).filter(f => fs.statSync(path.join(pluginsCollectionsDir, f)).isDirectory());
    for (const folder of folders) {
      await checkPlugin(path.join(pluginsCollectionsDir, folder));
    }
  }

  const wikiDir = path.join(absolutePath, 'wiki');
  const assetsDirParent = path.join(wikiDir, 'assets');

  let branchName = '';
  if (options?.branch) {
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
  const summaryBaseSchema = fs.readFileSync(path.join(absolutePath, 'config', 'summary', 'schema.md'), 'utf8');

  // Load plugin schemas
  const schemasDir = path.join(absolutePath, 'plugins', 'collections');
  const schemaInstructions: string[] = [];
  const schemaKeys: string[] = [];
  const activeSchemas = fs.existsSync(schemasDir)
    ? fs.readdirSync(schemasDir).filter(f => fs.statSync(path.join(schemasDir, f)).isDirectory())
    : [];

  for (const folder of activeSchemas) {
    const frontmatterPath = path.join(schemasDir, folder, 'schema.md');
    if (fs.existsSync(frontmatterPath)) {
      const fmContent = fs.readFileSync(frontmatterPath, 'utf8');
      const propertiesSpec = parseSchemaProperties(fmContent);
      schemaInstructions.push(propertiesSpec);
      schemaKeys.push(folder);
    }
  }

  const baseProperties = parseSchemaProperties(summaryBaseSchema);
  const dynamicFrontmatter = [baseProperties, ...schemaInstructions].filter(Boolean).join('\n');
  const summaryPrompt = summaryPromptTemplate.replace('$SCHEMA', dynamicFrontmatter);

  // 3. For each date folder, discover original sources and text transcriptions
  for (const dateFolder of dateFolders) {
    const processedPath = path.join(assetsDirParent, dateFolder, 'processed');
    const sourcesPath = path.join(assetsDirParent, dateFolder, 'sources');

    if (!fs.existsSync(processedPath)) continue;

    const sourcesFiles = fs.readdirSync(processedPath).filter(f => !f.startsWith('.'));
    const binaryFiles = sourcesFiles.filter(f => !f.endsWith('.md') && !f.endsWith('.txt'));

    for (const file of sourcesFiles) {
      const ext = path.extname(file).toLowerCase();
      const baseName = path.basename(file, ext);

      // Skip companion metadata processed as part of a binary file
      const isMd = ext === '.md';
      const hasBinaryCompanion = binaryFiles.some(bf => path.basename(bf, path.extname(bf)) === baseName);
      if (isMd && hasBinaryCompanion) {
        continue;
      }

      console.log(`Re-ingesting asset: ${file} from date ${dateFolder}`);
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
      } catch (e: any) {
        console.error(`LLM synthesis failed for ${file} during resync:`, e.message);
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
  }

  // 4. Progressively Compile Entities
  console.log('Compiling entity pages from new summaries...');
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

        const prompt = promptTemplate
          .replace(/\$SCHEMA/g, schemaProperties)
          .replace(/\$VALUE/g, entityName)
          .replace(/\$TIMESTAMP/g, new Date().toISOString().replace(/\.\d{3}Z$/, 'Z'))
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
        } catch (e: any) {
          console.error(`Failed to compile entity ${entityName} during resync:`, e.message);
          continue;
        }

        fs.writeFileSync(entityPath, compiledText, 'utf8');
        gitCommit(entityPath, `Updated ${schemaName} entity card: ${entityName}`);
      }
    }
  }

  // 5. Run Overviews
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

  // 6. Rebuild Indexes
  console.log('Rebuilding indexes...');
  await rebuildFolderIndex(wikiDir, 'summaries', 'Summaries');
  await rebuildFolderIndex(wikiDir, 'overviews', 'Overviews');

  for (const schemaName of activeSchemas) {
    const headerName = schemaName.charAt(0).toUpperCase() + (schemaName.endsWith('s') ? schemaName.slice(1) : schemaName.slice(1) + 's');
    await rebuildFolderIndex(wikiDir, `collections/${schemaName}`, headerName);
  }

  await rebuildWikiRootIndex(wikiDir);
  rebuildTagsPage(wikiDir);

  console.log('Resync complete.');

  if (options?.pr && branchName) {
    gitCreatePR(absolutePath, branchName);
  }
}
