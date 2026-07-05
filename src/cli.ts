#!/usr/bin/env node
import { argv, exit } from 'process';
import { initWiki } from './commands/init.js';
import { syncWiki } from './commands/sync.js';
import { publishWiki } from './commands/publish.js';
import { resyncWiki } from './commands/resync.js';
import { checkPlugins } from './commands/check-plugins.js';
import { serveWiki } from './commands/serve.js';
import { overviewsWiki } from './commands/overviews.js';
import { overridesWiki } from './commands/overrides.js';
import { contradictionsWiki } from './commands/contradictions.js';

async function main() {
  const args = argv.slice(2);
  const flags = {
    pr: false,
    verbose: false,
    force: false,
    from: undefined as string | undefined,
    transport: undefined as string | undefined,
    port: undefined as number | undefined,
    host: undefined as string | undefined,
    rateLimit: undefined as number | undefined,
    prometheusPort: undefined as number | undefined,
    chromadbWal: false,
  };

  const positional: string[] = [];
  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg === '--pr') {
      flags.pr = true;
    } else if (arg === '--verbose' || arg === '-v') {
      flags.verbose = true;
    } else if (arg === '--force' || arg === '--overwrite' || arg === '-f') {
      flags.force = true;
    } else if (arg === '--from') {
      flags.from = args[++i];
    } else if (arg === '--transport') {
      flags.transport = args[++i];
    } else if (arg === '--port') {
      flags.port = parseInt(args[++i], 10);
    } else if (arg === '--host') {
      flags.host = args[++i];
    } else if (arg === '--rate-limit') {
      flags.rateLimit = parseInt(args[++i], 10);
    } else if (arg === '--prometheus-port') {
      flags.prometheusPort = parseInt(args[++i], 10);
    } else if (arg === '--chromadb-wal') {
      flags.chromadbWal = true;
    } else if (arg.startsWith('--')) {
      // Ignore or log unknown options
    } else {
      positional.push(arg);
    }
  }

  const command = positional[0];
  const wikiPath = positional[1] || '.';

  if (!command) {
    console.error('Usage: mm <command> [args] [options]');
    console.error('Commands:');
    console.error('  init [wiki-path]                      - Initialize folder layout & templates (default: .)');
    console.error('  collection [name] [wiki-path]         - List available collections or install one (default wiki-path: .)');
    console.error('  overview [name] [wiki-path]           - List available overviews or install one (default wiki-path: .)');
    console.error('  sync [wiki-path] [options]            - Process inbox files into the wiki (default: .)');
    console.error('  publish [wiki-path] [target-dir]      - Compile static MkDocs site (default: .)');
    console.error('  overviews [wiki-path] [target-html-path] - Re-create overview markdown pages and indexes (default: .)');
    console.error('  serve [wiki-path|publish-path]        - Spawn minimal HTTP server serving the wiki (default: .)');
    console.error('  resync [wiki-path] [options]          - Rebuild summaries & collections from assets (default: .)');
    console.error('  overrides [wiki-path] [options]       - Save manual edits to overrides and recreate documents (default: .)');
    console.error('  contradictions [wiki-path]            - Scan the wiki pages for contradictions (default: .)');
    console.error('  check-plugins [plugin-path]           - Verify plugin schema and prompt configurations (default: .)');
    console.error('  rag [wiki-path] [options]             - Start knowledge-rag MCP server (default: .)');
    console.error('Options:');
    console.error('  --pr                                  - Create a branch, commit changes, push, and open a pull request');
    console.error('  -v, --verbose                         - Show assembled final LLM prompts in the console');
    console.error('  -f, --force, --overwrite              - Overwrite existing files when installing templates');
    console.error('  --from <path>                         - Use custom library path instead of the built-in library');
    console.error('  --transport <stdio|sse>               - MCP transport mode: stdio | sse (default: sse)');
    console.error('  --port <number>                       - Port for SSE transport (default: 8179)');
    console.error('  --host <string>                       - Host for SSE transport (default: 127.0.0.1)');
    console.error('  --rate-limit <rpm>                    - Enable rate limiting with specified RPM');
    console.error('  --prometheus-port <port>              - Enable Prometheus scraping on specified port');
    console.error('  --chromadb-wal                        - Enable ChromaDB Write-Ahead Logging (WAL) mode');
    exit(1);
  }

  try {
    switch (command) {
      case 'init':
        await initWiki(wikiPath);
        break;
      case 'collection': {
        const name = positional[1];
        const targetPath = positional[2] || '.';
        const { manageCollection } = await import('./commands/library.js');
        await manageCollection(targetPath, name, { force: flags.force, from: flags.from });
        break;
      }
      case 'overview': {
        const name = positional[1];
        const targetPath = positional[2] || '.';
        const { manageOverview } = await import('./commands/library.js');
        await manageOverview(targetPath, name, { force: flags.force, from: flags.from });
        break;
      }
      case 'sync':
        await syncWiki(wikiPath, flags);
        break;
      case 'publish':
        const targetDir = positional[2];
        await publishWiki(wikiPath, targetDir);
        break;
      case 'overviews':
        const targetHtmlPath = positional[2];
        await overviewsWiki(wikiPath, targetHtmlPath, flags);
        break;
      case 'resync':
        await resyncWiki(wikiPath, flags);
        break;
      case 'overrides':
        await overridesWiki(wikiPath, flags);
        break;
      case 'contradictions':
        await contradictionsWiki(wikiPath);
        break;
      case 'check-plugins':
        await checkPlugins(wikiPath);
        break;
      case 'serve':
        await serveWiki(wikiPath);
        break;
      case 'rag': {
        const { ragWiki } = await import('./commands/rag.js');
        await ragWiki(wikiPath, flags);
        break;
      }
      default:
        console.error(`Unknown command: ${command}`);
        exit(1);
    }
  } catch (e: any) {
    console.error(`Command '${command}' failed critically:`, e.stack || e.message);
    exit(1);
  }
}

main();
