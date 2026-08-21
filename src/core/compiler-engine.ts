import * as fs from 'fs';
import * as path from 'path';
import YAML from 'yaml';
import { config } from '../utils/config.js';
import { callAgenticModel } from '../utils/openai-api.js';
import {
  toSafeFilename,
  cleanMarkdownResponse
} from '../utils/fs-utils.js';
import { parseSchema, loadAndInjectSchemaProperties } from '../utils/schema-parser.js';
import { asyncPool } from '../utils/async-pool.js';
import { CompilerStats, SummaryFrontmatter } from './types.js';

export interface SchemaTemplateInfo {
  promptTemplate: string;
  schemaProperties: string;
  fields?: string[];
}

export interface SummarySynthesisResult {
  frontmatter: SummaryFrontmatter;
  bodyContent: string;
  fullMarkdown: string;
  summaryPath: string;
}

/**
 * Parses clean properties YAML block from schema YAML (stripping $meta).
 */
export function parseSchemaProperties(yamlContent: string): string {
  try {
    const parsed = parseSchema(yamlContent);
    return parsed.cleanSchemaYaml;
  } catch (e: any) {
    console.error('Failed to parse schema YAML:', e.message);
    return '';
  }
}

/**
 * Assembles dynamic summary prompt template with schema extensions from active collection plugins.
 */
export function loadSummaryPromptTemplate(absoluteWikiRoot: string): {
  summaryPrompt: string;
  activeSchemas: string[];
} {
  const summaryPromptTemplate = fs.readFileSync(path.join(absoluteWikiRoot, 'config', 'summary', 'prompt.md'), 'utf8');
  const summaryBaseSchema = fs.readFileSync(path.join(absoluteWikiRoot, 'config', 'summary', 'schema.yml'), 'utf8');

  const schemasDir = path.join(absoluteWikiRoot, 'plugins', 'collections');
  const schemaInstructions: string[] = [];
  const activeSchemas = fs.existsSync(schemasDir)
    ? fs.readdirSync(schemasDir).filter(f => fs.statSync(path.join(schemasDir, f)).isDirectory())
    : [];

  for (const folder of activeSchemas) {
    const extensionPath = path.join(schemasDir, folder, 'summary-schema-extension.yml');
    if (fs.existsSync(extensionPath)) {
      const fmContent = fs.readFileSync(extensionPath, 'utf8');
      schemaInstructions.push(parseSchemaProperties(fmContent));
    }
  }

  const baseProperties = parseSchemaProperties(summaryBaseSchema);
  const dynamicFrontmatter = [baseProperties, ...schemaInstructions].filter(Boolean).join('\n');
  const summaryPrompt = summaryPromptTemplate.replace('$SCHEMA', dynamicFrontmatter);

  return { summaryPrompt, activeSchemas };
}

/**
 * Synthesizes a summary from raw content + companion metadata using LLM.
 */
export async function synthesizeSummary(
  rawText: string,
  companionMetadata: string | undefined,
  baseName: string,
  summaryPrompt: string,
  referencedAssets: string[]
): Promise<{ frontmatter: SummaryFrontmatter; bodyContent: string; fullMarkdown: string }> {
  const combinedInput = companionMetadata
    ? `Companion Metadata Context:\n${companionMetadata}\n\nSource Content:\n${rawText}`
    : rawText;

  const rawLlmResponse = await callAgenticModel([
    { role: 'system', content: summaryPrompt },
    { role: 'user', content: combinedInput },
  ]);

  const summaryText = cleanMarkdownResponse(rawLlmResponse);

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
    const cleanFmStr = frontmatterStr
      .split('\n')
      .filter(line => !line.trim().startsWith('```'))
      .join('\n')
      .trim();
    try {
      frontmatter = YAML.parse(cleanFmStr) || {};
    } catch (e: any) {
      console.error('Failed to parse frontmatter:', e.message);
    }
  }

  const modelName = config.baseModelName || 'mycelium-mind-compiler';
  const timestamp = new Date().toISOString().replace(/\.\d{3}Z$/, 'Z');

  frontmatter.type = 'Summary';
  frontmatter.title = frontmatter.title || baseName;
  frontmatter.generated = {
    by: `agentic/${modelName}`,
    at: timestamp,
  };
  frontmatter.status = 'stable';
  frontmatter.sources = referencedAssets.map(asset => ({
    resource: `/${asset.startsWith('wiki/') ? asset.slice(5) : asset}`,
    title: path.basename(asset),
  }));
  frontmatter.assets = referencedAssets;

  const fullMarkdown = `---\n${YAML.stringify(frontmatter)}---\n${bodyContent}`;

  return {
    frontmatter: frontmatter as SummaryFrontmatter,
    bodyContent,
    fullMarkdown,
  };
}

/**
 * Pre-loads prompt & properties templates for active collection schemas.
 */
export function loadCollectionSchemaTemplates(
  absoluteWikiRoot: string,
  activeSchemas: string[]
): Record<string, SchemaTemplateInfo | null> {
  const schemasDir = path.join(absoluteWikiRoot, 'plugins', 'collections');
  const templates: Record<string, SchemaTemplateInfo | null> = {};

  for (const schemaName of activeSchemas) {
    templates[schemaName] = null;
    const schemaPromptPath = path.join(schemasDir, schemaName, 'prompt.md');
    const schemaPropertiesPath = path.join(schemasDir, schemaName, 'schema.yml');

    if (!fs.existsSync(schemaPromptPath) || !fs.existsSync(schemaPropertiesPath)) {
      continue;
    }

    const promptContentRaw = fs.readFileSync(schemaPromptPath, 'utf8');
    let promptTemplate = promptContentRaw;
    let targetFields: string[] | undefined;

    const frontmatterMatch = promptContentRaw.match(/^---\r?\n([\s\S]*?)\r?\n---(?:\r?\n|$)/);
    if (frontmatterMatch) {
      try {
        const promptConfig = YAML.parse(frontmatterMatch[1]) || {};
        promptTemplate = promptContentRaw.slice(frontmatterMatch[0].length);
        if (promptConfig.fields) {
          targetFields = Array.isArray(promptConfig.fields) ? promptConfig.fields : [promptConfig.fields];
        }
      } catch (e: any) {
        console.error(`Failed to parse prompt frontmatter for plugin ${schemaName}:`, e.message);
      }
    }

    const rawSchemaContent = fs.readFileSync(schemaPropertiesPath, 'utf8');
    const schemaProperties = loadAndInjectSchemaProperties(rawSchemaContent, schemaName);

    templates[schemaName] = {
      promptTemplate,
      schemaProperties,
      fields: targetFields,
    };
  }

  return templates;
}

export interface EntityCompileTask {
  schemaName: string;
  entityName: string;
  summaryContent: string;
  summaryPath: string;
}

/**
 * Extracts entity compile tasks from a summary frontmatter and collection schemas.
 */
export function extractEntityTasksForSummary(
  summary: { summaryPath: string; frontmatter: any },
  activeSchemas: string[],
  schemaTemplates: Record<string, SchemaTemplateInfo | null>
): EntityCompileTask[] {
  const tasks: EntityCompileTask[] = [];
  const summaryContent = fs.readFileSync(summary.summaryPath, 'utf8');
  const entities = summary.frontmatter;

  for (const schemaName of activeSchemas) {
    const template = schemaTemplates[schemaName];
    if (!template) continue;

    // Use explicitly defined target fields, defaulting to schemaName and singular form
    const targetFields: string[] = (template.fields && template.fields.length > 0)
      ? template.fields
      : [schemaName, schemaName.replace(/s$/, '')];

    const summaryKeys = targetFields.filter(k => entities[k] !== undefined);
    if (summaryKeys.length === 0) continue;

    for (const key of summaryKeys) {
      const entityList = entities[key];
      if (!Array.isArray(entityList)) continue;

      for (const entityVal of entityList) {
        let entityName = '';
        if (typeof entityVal === 'string') {
          entityName = entityVal.trim();
        } else if (typeof entityVal === 'object' && entityVal !== null) {
          entityName = String(entityVal.name || entityVal.title || '').trim();
        }

        if (entityName) {
          tasks.push({
            schemaName,
            entityName,
            summaryContent,
            summaryPath: summary.summaryPath,
          });
        }
      }
    }
  }

  return tasks;
}

export interface SummarySourceContext {
  summaryTitle: string;
  summaryPath: string;
  summaryContent: string;
}

export interface GroupedEntityTask {
  schemaName: string;
  entityName: string;
  sources: SummarySourceContext[];
}

/**
 * Deduplicates and groups entity compile tasks across summaries by unique entity.
 */
export function deduplicateEntityTasks(
  tasks: EntityCompileTask[]
): GroupedEntityTask[] {
  const groups = new Map<string, { schemaName: string; entityName: string; sources: SummarySourceContext[] }>();

  for (const task of tasks) {
    const key = `${task.schemaName}::${task.entityName.toLowerCase().trim()}`;
    let group = groups.get(key);
    if (!group) {
      group = {
        schemaName: task.schemaName,
        entityName: task.entityName.trim(),
        sources: [],
      };
      groups.set(key, group);
    }
    // Prevent duplicate summaries from the exact same file path in the same group
    if (!group.sources.some(s => s.summaryPath === task.summaryPath)) {
      const summaryTitle = path.basename(task.summaryPath, path.extname(task.summaryPath));
      group.sources.push({
        summaryTitle,
        summaryPath: task.summaryPath,
        summaryContent: task.summaryContent,
      });
    }
  }

  return Array.from(groups.values());
}

/**
 * Compiles or updates a collection entity card via LLM.
 */
export async function compileEntityCard(options: {
  absoluteWikiRoot: string;
  schemaName: string;
  entityName: string;
  summaryContent?: string;
  sources?: SummarySourceContext[];
  maxSummariesPerBatch?: number;
  template: SchemaTemplateInfo;
  verbose?: boolean;
}): Promise<{ entityPath: string; compiledText: string }> {
  const { absoluteWikiRoot, schemaName, entityName, summaryContent, sources, maxSummariesPerBatch = 5, template, verbose } = options;
  const wikiDir = path.join(absoluteWikiRoot, 'wiki');
  const collectionFolder = path.join(wikiDir, 'collections', schemaName);
  fs.mkdirSync(collectionFolder, { recursive: true });

  const entityFilename = toSafeFilename(entityName);
  const entityPath = path.join(collectionFolder, entityFilename);

  // If sources array is provided and exceeds maxSummariesPerBatch, partition into sub-batches to process sequentially
  const sourceBatches: SummarySourceContext[][] = [];
  if (sources && sources.length > 0) {
    const batchSize = Math.max(1, maxSummariesPerBatch);
    for (let i = 0; i < sources.length; i += batchSize) {
      sourceBatches.push(sources.slice(i, i + batchSize));
    }
  } else {
    sourceBatches.push([]);
  }

  let finalCompiledText = '';

  for (const batch of sourceBatches) {
    let existingContent = '';
    if (fs.existsSync(entityPath)) {
      existingContent = fs.readFileSync(entityPath, 'utf8');
    }

    let formattedSummaryContent = '';
    if (batch.length > 0) {
      if (batch.length === 1) {
        formattedSummaryContent = `### Source: ${batch[0].summaryTitle}\n\n${batch[0].summaryContent}`;
      } else {
        formattedSummaryContent = batch.map((s, idx) => {
          return `### Source ${idx + 1}: ${s.summaryTitle}\n\n${s.summaryContent}`;
        }).join('\n\n---\n\n');
      }
    } else {
      formattedSummaryContent = summaryContent || '';
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
      .replace(/\$SUMMARY_CONTENT/g, formattedSummaryContent);

    if (verbose) {
      console.log(`[VERBOSE] Entity prompt for ${entityName} (${schemaName}):`);
      console.log('--------------------------------------------------');
      console.log(prompt);
      console.log('==================================================');
    }

    const systemInstructions = `You are an expert knowledge extraction agent specialized in compiling and updating ${schemaName} entity cards.
Adhere strictly to the schema specification, link normalization rules, and target markdown structure.`;

    const rawResponse = await callAgenticModel([
      { role: 'system', content: systemInstructions },
      { role: 'user', content: prompt }
    ]);
    finalCompiledText = cleanMarkdownResponse(rawResponse);
    fs.writeFileSync(entityPath, finalCompiledText, 'utf8');
  }

  return { entityPath, compiledText: finalCompiledText };
}

/**
 * Filters and groups a list of inbox/asset filenames, pairing companion markdown files with binary assets.
 */
export function filterCompanionFiles(fileList: string[]): {
  filesToProcess: string[];
  mdFiles: string[];
  binaryFiles: string[];
} {
  const mdFiles = fileList.filter(f => f.endsWith('.md'));
  const binaryFiles = fileList.filter(f => !f.endsWith('.md') && !f.endsWith('.txt'));

  const filesToProcess = fileList.filter(file => {
    const ext = path.extname(file).toLowerCase();
    const isMd = ext === '.md';
    const baseName = path.basename(file, ext);
    const hasBinaryCompanion = binaryFiles.some(bf => path.basename(bf, path.extname(bf)) === baseName);
    return !(isMd && hasBinaryCompanion);
  });

  return { filesToProcess, mdFiles, binaryFiles };
}

export interface BatchCompileEntitiesOptions {
  summaries: { summaryPath: string; frontmatter: any }[];
  activeSchemas: string[];
  schemaTemplates: Record<string, SchemaTemplateInfo | null>;
  concurrency: number;
  maxSummariesPerBatch: number;
  absoluteWikiRoot: string;
  stats: CompilerStats;
  commitPrefix?: string;
  queuedGitCommit: (filePath: string, message: string) => Promise<void>;
  verbose?: boolean;
  onEntityCompiled?: (schemaName: string, entityName: string, sourcesCount: number, durationSec: string, taskIdx: number, totalTasksForSchema: number) => void;
}

/**
 * Extracts, deduplicates, and compiles entity cards from a batch of summaries with bounded concurrency.
 */
export async function compileEntitiesFromSummaries(options: BatchCompileEntitiesOptions): Promise<void> {
  const {
    summaries,
    activeSchemas,
    schemaTemplates,
    concurrency,
    maxSummariesPerBatch,
    absoluteWikiRoot,
    stats,
    commitPrefix = 'Updated',
    queuedGitCommit,
    verbose,
    onEntityCompiled
  } = options;

  const entityTasks: EntityCompileTask[] = [];
  for (const item of summaries) {
    entityTasks.push(...extractEntityTasksForSummary(item, activeSchemas, schemaTemplates));
  }

  const groupedTasks = deduplicateEntityTasks(entityTasks);
  if (groupedTasks.length === 0) return;

  const schemaTotalTasks: Record<string, number> = {};
  const schemaTaskCounts: Record<string, number> = {};
  for (const t of groupedTasks) {
    schemaTotalTasks[t.schemaName] = (schemaTotalTasks[t.schemaName] || 0) + 1;
    schemaTaskCounts[t.schemaName] = 0;
  }

  await asyncPool(concurrency, groupedTasks, async (groupedTask) => {
    const { schemaName, entityName, sources } = groupedTask;
    const entityStartTime = Date.now();
    const template = schemaTemplates[schemaName];

    if (!template) {
      stats.entitiesFailed[schemaName]++;
      return;
    }

    try {
      const { entityPath } = await compileEntityCard({
        absoluteWikiRoot,
        schemaName,
        entityName,
        sources,
        maxSummariesPerBatch,
        template,
        verbose,
      });

      await queuedGitCommit(entityPath, `${commitPrefix} ${schemaName} entity card: ${entityName}`);
      stats.entitiesSuccess[schemaName]++;
      const taskIdx = ++schemaTaskCounts[schemaName];
      const duration = ((Date.now() - entityStartTime) / 1000).toFixed(1);
      if (onEntityCompiled) {
        onEntityCompiled(schemaName, entityName, sources.length, duration, taskIdx, schemaTotalTasks[schemaName]);
      }
    } catch (e: any) {
      console.error(`Failed to compile entity ${entityName}:`, e.message);
      stats.entitiesFailed[schemaName]++;
    }
  });
}

/**
 * Prints the formatted summary stats after sync or resync completes.
 */
export function printCompilerStats(
  stats: CompilerStats,
  activeSchemas: string[],
  totalSummaries: number,
  mode: 'Sync' | 'Resync'
): void {
  console.log(`\n${mode === 'Sync' ? 'Sync pipeline' : 'Resync'} complete.`);
  console.log(`- Summaries generated: ${stats.summariesSuccess}/${totalSummaries} (${stats.summariesFailed} failed)`);
  for (const schemaName of activeSchemas) {
    const totalSchemaTasks = stats.entitiesSuccess[schemaName] + stats.entitiesFailed[schemaName];
    const label = schemaName.charAt(0).toUpperCase() + schemaName.slice(1);
    if (mode === 'Sync') {
      console.log(`- ${label} compiled: ${stats.entitiesSuccess[schemaName]}/${totalSchemaTasks} (${stats.entitiesFailed[schemaName]} failed)`);
    } else {
      console.log(`- ${label} compiled: ${stats.entitiesSuccess[schemaName]} (${stats.entitiesFailed[schemaName]} failed)`);
    }
  }
  console.log();
}

