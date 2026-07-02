import { argv, exit } from 'process';
import { initWiki } from './commands/init.js';
import { syncWiki } from './commands/sync.js';
import { publishWiki } from './commands/publish.js';
import { resyncWiki } from './commands/resync.js';
import { checkPlugin } from './commands/check-plugin.js';
import { serveWiki } from './commands/serve.js';

async function main() {
  const args = argv.slice(2);
  const flags = {
    commit: false,
    branch: false,
    pr: false,
    verbose: false,
  };

  const positional: string[] = [];
  for (const arg of args) {
    if (arg === '--commit') {
      flags.commit = true;
    } else if (arg === '--branch') {
      flags.branch = true;
    } else if (arg === '--pr') {
      flags.pr = true;
    } else if (arg === '--verbose' || arg === '-v') {
      flags.verbose = true;
    } else if (arg.startsWith('--')) {
      // Ignore or log unknown options
    } else {
      positional.push(arg);
    }
  }

  // Handle flag dependencies: pr implies branch, branch implies commit
  if (flags.pr) {
    flags.branch = true;
  }
  if (flags.branch) {
    flags.commit = true;
  }

  const command = positional[0];
  const wikiPath = positional[1];

  if (!command || !wikiPath) {
    console.error('Usage: mycelium-mind <command> <wiki-path|plugin-path> [args] [options]');
    console.error('Commands:');
    console.error('  init <wiki-path>                      - Initialize folder layout & templates');
    console.error('  sync <wiki-path> [options]            - Process inbox files into the wiki');
    console.error('  publish <wiki-path> [target-dir]      - Compile static MkDocs site');
    console.error('  serve <wiki-path|publish-path>        - Spawn minimal HTTP server serving the wiki');
    console.error('  resync <wiki-path> [options]          - Rebuild summaries & collections from assets');
    console.error('  check-plugin <plugin-path>            - Verify plugin schema and prompt configurations');
    console.error('Options:');
    console.error('  --commit                              - Commit changes to Git after each step');
    console.error('  --branch                              - Create/checkout a new branch before changing anything (implies --commit)');
    console.error('  --pr                                  - Automatically push and create a pull request at the end (implies --branch and --commit)');
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
      case 'resync':
        await resyncWiki(wikiPath, flags);
        break;
      case 'check-plugin':
        await checkPlugin(wikiPath);
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
