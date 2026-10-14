#!/usr/bin/env node
import { Command } from 'commander';
import { createRequire } from 'module';
import { initWiki } from './commands/init.js';
import { syncWiki } from './commands/sync.js';
import { publishWiki } from './commands/publish.js';
import { resyncWiki } from './commands/resync.js';
import { checkPlugins } from './commands/check-plugins.js';
import { serveWiki } from './commands/serve.js';
import { overviewsWiki } from './commands/overviews.js';
import { overridesWiki } from './commands/overrides.js';
import { contradictionsWiki } from './commands/contradictions.js';

const require = createRequire(import.meta.url);
const { version } = require('../package.json');

const program = new Command();

program
  .name('mm')
  .description('Mycelium Mind — offline, schema-driven wiki compiler powered by local LLMs')
  .version(version);

// ─── init ────────────────────────────────────────────────────────────────────
program
  .command('init')
  .description('Initialize folder layout & templates')
  .argument('[wiki-path]', 'target directory', '.')
  .action(async (wikiPath: string) => {
    await initWiki(wikiPath);
  });

// ─── collection ──────────────────────────────────────────────────────────────
program
  .command('collection')
  .description('List available collections or install one')
  .argument('[name]', 'collection to install (omit to list all)')
  .argument('[wiki-path]', 'target wiki directory', '.')
  .option('-f, --force', 'overwrite existing files')
  .option('--from <path>', 'use custom library path instead of the built-in library')
  .action(async (name: string | undefined, wikiPath: string, opts: { force?: boolean; from?: string }) => {
    const { manageCollection } = await import('./commands/library.js');
    await manageCollection(wikiPath, name, { force: opts.force, from: opts.from });
  });

// ─── overview (install) ─────────────────────────────────────────────────────
program
  .command('overview')
  .description('List available overviews or install one')
  .argument('[name]', 'overview to install (omit to list all)')
  .argument('[wiki-path]', 'target wiki directory', '.')
  .option('-f, --force', 'overwrite existing files')
  .option('--from <path>', 'use custom library path instead of the built-in library')
  .action(async (name: string | undefined, wikiPath: string, opts: { force?: boolean; from?: string }) => {
    const { manageOverview } = await import('./commands/library.js');
    await manageOverview(wikiPath, name, { force: opts.force, from: opts.from });
  });

// ─── sync ────────────────────────────────────────────────────────────────────
program
  .command('sync')
  .description('Process inbox files into the wiki')
  .argument('[wiki-path]', 'target wiki directory', '.')
  .option('--no-pr', 'do not create a branch, commit, push, or open a pull request')
  .option('-v, --verbose', 'show assembled final LLM prompts in the console')
  .action(async (wikiPath: string, opts: { pr: boolean; verbose?: boolean }) => {
    await syncWiki(wikiPath, { pr: opts.pr, verbose: !!opts.verbose });
  });

// ─── publish ─────────────────────────────────────────────────────────────────
program
  .command('publish')
  .description('Compile static MkDocs site')
  .argument('[wiki-path]', 'source wiki directory', '.')
  .argument('[target-dir]', 'output directory for the compiled site')
  .action(async (wikiPath: string, targetDir: string | undefined) => {
    await publishWiki(wikiPath, targetDir);
  });

// ─── overviews ───────────────────────────────────────────────────────────────
program
  .command('overviews')
  .description('Re-create overview markdown pages and indexes')
  .argument('[wiki-path]', 'target wiki directory', '.')
  .argument('[target-html]', 'optional target directory to also compile MkDocs site')
  .action(async (wikiPath: string, targetHtml: string | undefined) => {
    await overviewsWiki(wikiPath, targetHtml);
  });

// ─── resync ──────────────────────────────────────────────────────────────────
program
  .command('resync')
  .description('Rebuild summaries & collections from archived assets')
  .argument('[wiki-path]', 'target wiki directory', '.')
  .option('--no-pr', 'do not create a branch, commit, push, or open a pull request')
  .option('-v, --verbose', 'show assembled final LLM prompts in the console')
  .option('--collection <name>', 'target a specific collection to rebuild')
  .action(async (wikiPath: string, opts: { pr: boolean; verbose?: boolean; collection?: string }) => {
    await resyncWiki(wikiPath, { pr: opts.pr, verbose: !!opts.verbose, collection: opts.collection });
  });

// ─── overrides ───────────────────────────────────────────────────────────────
program
  .command('overrides')
  .description('Save manual edits to overrides and recreate documents')
  .argument('[wiki-path]', 'target wiki directory', '.')
  .option('--no-pr', 'do not create a branch, commit, push, or open a pull request')
  .option('-v, --verbose', 'show assembled final LLM prompts in the console')
  .action(async (wikiPath: string, opts: { pr: boolean; verbose?: boolean }) => {
    await overridesWiki(wikiPath, { pr: opts.pr, verbose: !!opts.verbose });
  });

// ─── watch ───────────────────────────────────────────────────────────────────
program
  .command('watch')
  .description('Watch the vault: sync inbox drops, re-create manual edits, push to Open Notebook')
  .argument('[wiki-path]', 'target wiki directory', '.')
  .option('-d, --debounce <ms>', 'quiet period before processing manual edits', (v) => parseInt(v, 10), 1500)
  .option('--no-notebook-sync', 'do not push changes to Open Notebook')
  .option('--notebook <name>', 'target Open Notebook by name')
  .option('--notebook-id <id>', 'target Open Notebook by ID')
  .option('--notebook-url <url>', 'Open Notebook API base URL')
  .option('--api-key <key>', 'optional API key for Open Notebook authentication')
  .option('-v, --verbose', 'show assembled final LLM prompts in the console')
  .action(async (wikiPath: string, opts: any) => {
    const { watchWiki } = await import('./commands/watch.js');
    await watchWiki(wikiPath, opts);
  });

// ─── contradictions ──────────────────────────────────────────────────────────
program
  .command('contradictions')
  .description('Scan wiki pages for contradictions')
  .argument('[wiki-path]', 'target wiki directory', '.')
  .action(async (wikiPath: string) => {
    await contradictionsWiki(wikiPath);
  });

// ─── check-plugins ───────────────────────────────────────────────────────────
program
  .command('check-plugins')
  .description('Verify plugin schema and prompt configurations')
  .argument('[plugin-path]', 'wiki or plugin directory to scan', '.')
  .action(async (pluginPath: string) => {
    await checkPlugins(pluginPath);
  });

// ─── serve ───────────────────────────────────────────────────────────────────
program
  .command('serve')
  .description('Spawn minimal HTTP server serving the wiki')
  .argument('[path]', 'wiki or publish directory to serve', '.')
  .action(async (targetPath: string) => {
    await serveWiki(targetPath);
  });

// ─── rag ─────────────────────────────────────────────────────────────────────
program
  .command('rag')
  .description('Start knowledge-rag MCP server')
  .argument('[wiki-path]', 'target wiki directory', '.')
  .option('--transport <mode>', 'MCP transport mode: stdio | sse')
  .option('--port <number>', 'port for SSE transport', parseInt)
  .option('--host <address>', 'host for SSE transport')
  .option('--rate-limit <rpm>', 'enable rate limiting with specified RPM', parseInt)
  .option('--prometheus-port <port>', 'enable Prometheus scraping on specified port', parseInt)
  .option('--chromadb-wal', 'enable ChromaDB Write-Ahead Logging (WAL) mode')
  .action(async (wikiPath: string, opts: {
    transport?: string;
    port?: number;
    host?: string;
    rateLimit?: number;
    prometheusPort?: number;
    chromadbWal?: boolean;
  }) => {
    const { ragWiki } = await import('./commands/rag.js');
    await ragWiki(wikiPath, opts);
  });

// ─── notebook ────────────────────────────────────────────────────────────────
const notebookCmd = program
  .command('notebook')
  .description('Manage Open Notebook (push|start|stop|status|list|create|configure|colima)');

// Shared notebook options applied to all subcommands that need them
function withNotebookOpts(cmd: Command): Command {
  return cmd
    .option('--notebook <name>', 'target Open Notebook by name')
    .option('--notebook-id <id>', 'target Open Notebook by ID')
    .option('--notebook-url <url>', 'Open Notebook API base URL')
    .option('--api-key <key>', 'optional API key for Open Notebook authentication');
}

withNotebookOpts(
  notebookCmd
    .command('push', { isDefault: true })
    .description('Incrementally synchronize compiled cards and summaries into Open Notebook')
    .argument('[wiki-path]', 'target wiki directory', '.')
    .option('-f, --force', 'bypass hash verification and re-upload all documents')
    .option('--prune', 'delete remote sources that were deleted in the vault')
    .option('--dry-run', 'preview changes without writing to Open Notebook')
    .option('--filter <mode>', 'filter documents pushed: all | collections | summaries')
    .option('--concurrency <num>', 'max concurrent upload requests', parseInt)
).action(async (wikiPath: string, opts: any) => {
  const { manageNotebook } = await import('./commands/notebook.js');
  await manageNotebook(['push', wikiPath], buildNotebookFlags(opts));
});

withNotebookOpts(
  notebookCmd
    .command('start')
    .alias('up')
    .description('Start Open Notebook Docker containers')
    .argument('[wiki-path]', 'target wiki directory', '.')
    .option('--colima', 'also start/stop Colima runtime')
    .option('--no-configure', 'skip automatic model configuration upon container start')
).action(async (wikiPath: string, opts: any) => {
  const { manageNotebook } = await import('./commands/notebook.js');
  await manageNotebook(['start', wikiPath], buildNotebookFlags(opts));
});

withNotebookOpts(
  notebookCmd
    .command('stop')
    .alias('down')
    .description('Stop Open Notebook Docker containers')
    .option('--colima', 'also stop Colima runtime')
).action(async (opts: any) => {
  const { manageNotebook } = await import('./commands/notebook.js');
  await manageNotebook(['stop'], buildNotebookFlags(opts));
});

withNotebookOpts(
  notebookCmd
    .command('configure')
    .description('Re-synchronize AI provider credentials and model assignments')
    .argument('[wiki-path]', 'target wiki directory', '.')
).action(async (wikiPath: string, opts: any) => {
  const { manageNotebook } = await import('./commands/notebook.js');
  await manageNotebook(['configure', wikiPath], buildNotebookFlags(opts));
});

withNotebookOpts(
  notebookCmd
    .command('status')
    .description('Display full environment health')
    .argument('[wiki-path]', 'target wiki directory', '.')
).action(async (wikiPath: string, opts: any) => {
  const { manageNotebook } = await import('./commands/notebook.js');
  await manageNotebook(['status', wikiPath], buildNotebookFlags(opts));
});

withNotebookOpts(
  notebookCmd
    .command('list')
    .description('List all notebooks in Open Notebook')
    .argument('[wiki-path]', 'target wiki directory', '.')
).action(async (wikiPath: string, opts: any) => {
  const { manageNotebook } = await import('./commands/notebook.js');
  await manageNotebook(['list', wikiPath], buildNotebookFlags(opts));
});

withNotebookOpts(
  notebookCmd
    .command('create')
    .description('Create a new notebook in Open Notebook')
    .argument('<name>', 'notebook name')
    .argument('[wiki-path]', 'target wiki directory', '.')
).action(async (name: string, wikiPath: string, opts: any) => {
  const { manageNotebook } = await import('./commands/notebook.js');
  await manageNotebook(['create', name, wikiPath], buildNotebookFlags(opts));
});

notebookCmd
  .command('colima')
  .description('Direct controls for managing the Colima container runtime')
  .argument('<action>', 'start | stop | status')
  .action(async (action: string) => {
    const { manageNotebook } = await import('./commands/notebook.js');
    await manageNotebook(['colima', action], buildNotebookFlags({}));
  });

/**
 * Builds a CliFlags object from Commander option hashes, bridging the
 * camelCase Commander output back to the flat CliFlags shape expected
 * by manageNotebook.
 */
function buildNotebookFlags(opts: any): import('./core/types.js').CliFlags {
  return {
    pr: true,
    verbose: false,
    force: !!opts.force,
    notebook: opts.notebook,
    notebookId: opts.notebookId,
    notebookUrl: opts.notebookUrl,
    apiKey: opts.apiKey,
    prune: opts.prune,
    dryRun: opts.dryRun,
    filter: opts.filter,
    concurrency: opts.concurrency,
    colima: opts.colima,
    configure: opts.configure,
  };
}

// ─── parse & run ─────────────────────────────────────────────────────────────
program.parseAsync().catch((err: any) => {
  console.error(err.stack || err.message);
  process.exit(1);
});
