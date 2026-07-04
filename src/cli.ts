#!/usr/bin/env node
import { argv, exit } from 'process';
import { initWiki } from './commands/init.js';
import { syncWiki } from './commands/sync.js';
import { publishWiki } from './commands/publish.js';
import { resyncWiki } from './commands/resync.js';
import { checkPlugins } from './commands/check-plugins.js';
import { serveWiki } from './commands/serve.js';
import { overviewsWiki } from './commands/overviews.js';

async function main() {
  const args = argv.slice(2);
  const flags = {
    pr: false,
    verbose: false,
  };

  const positional: string[] = [];
  for (const arg of args) {
    if (arg === '--pr') {
      flags.pr = true;
    } else if (arg === '--verbose' || arg === '-v') {
      flags.verbose = true;
    } else if (arg.startsWith('--')) {
      // Ignore or log unknown options
    } else {
      positional.push(arg);
    }
  }

  const command = positional[0];
  const wikiPath = positional[1] || '.';

  if (!command) {
    console.error('Usage: mm <command> [wiki-path|plugin-path] [args] [options]');
    console.error('Commands:');
    console.error('  init [wiki-path]                      - Initialize folder layout & templates (default: .)');
    console.error('  sync [wiki-path] [options]            - Process inbox files into the wiki (default: .)');
    console.error('  publish [wiki-path] [target-dir]      - Compile static MkDocs site (default: .)');
    console.error('  overviews [wiki-path] [target-html-path] - Re-create overview markdown pages and indexes (default: .)');
    console.error('  serve [wiki-path|publish-path]        - Spawn minimal HTTP server serving the wiki (default: .)');
    console.error('  resync [wiki-path] [options]          - Rebuild summaries & collections from assets (default: .)');
    console.error('  check-plugins [plugin-path]           - Verify plugin schema and prompt configurations (default: .)');
    console.error('Options:');
    console.error('  --pr                                  - Create a branch, commit changes, push, and open a pull request');
    console.error('  -v, --verbose                         - Show assembled final LLM prompts in the console');
    exit(1);
  }

  try {
    switch (command) {
      case 'init':
        await initWiki(wikiPath);
        break;
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
      case 'check-plugins':
        await checkPlugins(wikiPath);
        break;
      case 'serve':
        await serveWiki(wikiPath);
        break;
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
