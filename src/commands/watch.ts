import * as fs from 'fs';
import * as path from 'path';
import * as crypto from 'crypto';
import { execFileSync } from 'child_process';
import chokidar from 'chokidar';
import { syncWiki } from './sync.js';
import { overridesWiki } from './overrides.js';
import { pushWikiToNotebook } from './notebook.js';
import { initWiki } from './init.js';
import { loadNotebookConfig } from '../core/notebook-sync.js';
import { WatchEngine } from '../core/watch-engine.js';
import { OpenNotebookClient } from '../utils/open-notebook-client.js';
import { CliFlags } from '../core/types.js';
import { gitListModifiedMarkdown } from '../utils/git.js';

const HEALTH_TIMEOUT_MS = 1500;
const INBOX_DEBOUNCE_MS = 2000;

export interface WatchOptions {
  debounce?: number;
  verbose?: boolean;
  /** false disables the Open Notebook push entirely (`--no-notebook-sync`). */
  notebookSync?: boolean;
  notebook?: string;
  notebookId?: string;
  notebookUrl?: string;
  apiKey?: string;
}

/**
 * Returns wiki markdown files that differ from git HEAD — the same set
 * `overridesWiki` treats as manual edits.
 */
export function listDirtyWikiFiles(vaultRoot: string): string[] {
  return gitListModifiedMarkdown(vaultRoot, 'wiki').map((file) => path.join(vaultRoot, file));
}

/**
 * Classifies a watched path relative to the vault root.
 */
export function classifyWatchPath(vaultRoot: string, filePath: string): 'inbox' | 'wiki' | 'ignore' {
  const rel = path.relative(vaultRoot, filePath).split(path.sep);
  if (rel.some((segment) => segment.startsWith('.')) || filePath.endsWith('.tmp')) return 'ignore';
  if (rel[0] === 'inbox' && rel.length > 1) return 'inbox';
  if (rel[0] === 'wiki' && rel[1] !== 'assets' && filePath.endsWith('.md')) return 'wiki';
  return 'ignore';
}

function isGitRepo(vaultRoot: string): boolean {
  try {
    execFileSync('git', ['rev-parse', '--verify', 'HEAD'], { cwd: vaultRoot, stdio: 'ignore' });
    return true;
  } catch {
    return false;
  }
}

function timestamp(): string {
  return new Date().toLocaleTimeString();
}

/**
 * Watches the vault and keeps it continuously processed:
 * inbox drops are synced, manual wiki edits are re-created via overrides,
 * and results are pushed to Open Notebook when it is reachable.
 */
export async function watchWiki(wikiPath: string, options: WatchOptions = {}): Promise<void> {
  const vaultRoot = path.resolve(wikiPath);
  await initWiki(vaultRoot, { overwrite: false });

  const log = (message: string) => console.log(`[watch ${timestamp()}] ${message}`);

  const gitAvailable = isGitRepo(vaultRoot);
  if (!gitAvailable) {
    console.warn(
      'Warning: vault is not a git repository with at least one commit. ' +
        'Manual-edit detection is disabled; only inbox ingestion will run.'
    );
  }

  // ── Open Notebook service discovery ──────────────────────────────────────
  const notebookEnabled = options.notebookSync !== false;
  const vaultConfig = loadNotebookConfig(vaultRoot);
  const baseUrl =
    options.notebookUrl || vaultConfig.url || process.env.OPEN_NOTEBOOK_URL || 'http://localhost:5055';
  const apiKey = options.apiKey || vaultConfig.apiKey || vaultConfig.api_key || process.env.OPEN_NOTEBOOK_API_KEY;
  const client = new OpenNotebookClient({ baseUrl, apiKey });

  if (notebookEnabled) {
    const active = await client.checkHealth(HEALTH_TIMEOUT_MS);
    log(`Open Notebook at ${baseUrl}: ${active ? 'Active' : 'Inactive (will retry before each push)'}`);
  } else {
    log('Open Notebook sync disabled');
  }

  const pushFlags: CliFlags = {
    pr: false,
    verbose: !!options.verbose,
    force: false,
    notebook: options.notebook,
    notebookId: options.notebookId,
    notebookUrl: baseUrl,
    apiKey,
  };

  const engine = new WatchEngine(
    {
      runSync: () => syncWiki(vaultRoot, { pr: false, commit: true, verbose: options.verbose }),
      runOverrides: () => overridesWiki(vaultRoot, { pr: false, commit: true, verbose: options.verbose }),
      pushToNotebook: async () => {
        if (!notebookEnabled) return;
        if (!(await client.checkHealth(HEALTH_TIMEOUT_MS))) {
          log(`Open Notebook unreachable at ${baseUrl}; skipping push`);
          return;
        }
        await pushWikiToNotebook(vaultRoot, pushFlags);
      },
      listDirtyWikiFiles: () => (gitAvailable ? listDirtyWikiFiles(vaultRoot) : []),
      listInboxFiles: () => {
        const inboxDir = path.join(vaultRoot, 'inbox');
        if (!fs.existsSync(inboxDir)) return [];
        return fs
          .readdirSync(inboxDir)
          .filter((f) => !f.startsWith('.') && fs.statSync(path.join(inboxDir, f)).isFile())
          .map((f) => path.join(inboxDir, f));
      },
      hashFile: (filePath) => {
        try {
          return crypto.createHash('sha256').update(fs.readFileSync(filePath)).digest('hex');
        } catch {
          return null;
        }
      },
      log,
    },
    { debounceMs: options.debounce ?? 1500, inboxDebounceMs: INBOX_DEBOUNCE_MS }
  );

  // ── Startup catch-up sweep ───────────────────────────────────────────────
  log('Running startup catch-up sweep...');
  await engine.start();

  // ── Active surveillance ──────────────────────────────────────────────────
  const watcher = chokidar.watch([path.join(vaultRoot, 'inbox'), path.join(vaultRoot, 'wiki')], {
    persistent: true,
    ignoreInitial: true,
    ignored: (filePath, stats) => {
      // Prune hidden and generated-asset subtrees entirely; filter other files by kind
      const rel = path.relative(vaultRoot, filePath).split(path.sep);
      if (rel.some((segment) => segment.startsWith('.')) || (rel[0] === 'wiki' && rel[1] === 'assets')) {
        return true;
      }
      return stats?.isFile() === true && classifyWatchPath(vaultRoot, filePath) === 'ignore';
    },
    awaitWriteFinish: { stabilityThreshold: 400, pollInterval: 100 },
  });

  const onFileEvent = (filePath: string) => {
    const kind = classifyWatchPath(vaultRoot, filePath);
    if (kind === 'inbox') {
      log(`Inbox: ${path.basename(filePath)}`);
      engine.onInboxEvent();
    } else if (kind === 'wiki' && gitAvailable) {
      engine.onWikiChange(filePath);
    }
  };
  watcher.on('add', onFileEvent);
  watcher.on('change', onFileEvent);
  watcher.on('error', (err) => log(`Watcher error: ${(err as Error).message}`));

  log(`Watching ${path.join(vaultRoot, 'inbox')} and ${path.join(vaultRoot, 'wiki')} (Ctrl+C to stop)`);

  await new Promise<void>((resolve) => {
    const shutdown = async () => {
      log('Stopping — waiting for the current run to finish...');
      await watcher.close();
      await engine.stop();
      resolve();
    };
    process.once('SIGINT', shutdown);
    process.once('SIGTERM', shutdown);
  });
}
