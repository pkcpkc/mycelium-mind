import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { execFileSync } from 'child_process';
import { WatchEngine, WatchEngineDeps } from '../core/watch-engine.js';
import { classifyWatchPath, listDirtyWikiFiles } from '../commands/watch.js';

/**
 * In-memory stand-in for the vault: `dirty` maps wiki files that differ from
 * HEAD to their current content; `inbox` lists dropped files.
 */
function createFakeVault() {
  const dirty = new Map<string, string>();
  const inbox: string[] = [];
  const calls: string[] = [];
  let overridesBehaviour: 'commit' | 'fail-llm' = 'commit';

  const deps: WatchEngineDeps = {
    runSync: vi.fn(async () => {
      calls.push('sync');
      inbox.length = 0;
      dirty.clear(); // sync commits all of wiki/
    }),
    runOverrides: vi.fn(async () => {
      calls.push('overrides');
      if (overridesBehaviour === 'commit') dirty.clear();
    }),
    pushToNotebook: vi.fn(async () => {
      calls.push('push');
    }),
    listDirtyWikiFiles: () => [...dirty.keys()],
    listInboxFiles: () => [...inbox],
    hashFile: (file) => dirty.get(file) ?? null,
    log: () => {},
  };

  return {
    dirty,
    inbox,
    calls,
    deps,
    failOverrides() {
      overridesBehaviour = 'fail-llm';
    },
  };
}

describe('WatchEngine', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  const options = { debounceMs: 1500, inboxDebounceMs: 2000 };

  it('startup sweep processes offline edits before inbox files, then pushes once', async () => {
    const vault = createFakeVault();
    vault.dirty.set('/v/wiki/a.md', 'edited');
    vault.inbox.push('/v/inbox/new.md');

    const engine = new WatchEngine(vault.deps, options);
    await engine.start();

    expect(vault.calls).toEqual(['overrides', 'sync', 'push']);
  });

  it('startup sweep does nothing when the vault is clean', async () => {
    const vault = createFakeVault();
    const engine = new WatchEngine(vault.deps, options);
    await engine.start();
    expect(vault.calls).toEqual([]);
  });

  it('debounces rapid edits to the same file into one overrides run', async () => {
    const vault = createFakeVault();
    const engine = new WatchEngine(vault.deps, options);
    await engine.start();

    for (let i = 0; i < 5; i++) {
      vault.dirty.set('/v/wiki/a.md', `typing ${i}`);
      engine.onWikiChange('/v/wiki/a.md');
      await vi.advanceTimersByTimeAsync(500);
    }
    expect(vault.calls).toEqual([]);

    await vi.advanceTimersByTimeAsync(1500);
    await engine.idle();
    expect(vault.calls).toEqual(['overrides', 'push']);
  });

  it('ignores change events for files that are clean against HEAD (engine echoes)', async () => {
    const vault = createFakeVault();
    const engine = new WatchEngine(vault.deps, options);
    await engine.start();

    engine.onWikiChange('/v/wiki/committed-by-engine.md');
    await vi.advanceTimersByTimeAsync(1500);
    await engine.idle();

    expect(vault.calls).toEqual([]);
  });

  it('does not retry a file overrides left dirty until its content changes', async () => {
    const vault = createFakeVault();
    vault.failOverrides();
    const engine = new WatchEngine(vault.deps, options);

    vault.dirty.set('/v/wiki/a.md', 'v1');
    engine.onWikiChange('/v/wiki/a.md');
    await vi.advanceTimersByTimeAsync(1500);
    await engine.idle();
    expect(vault.calls).toEqual(['overrides', 'push']);

    // Same content re-reported (e.g. a late echo) — must not loop
    engine.onWikiChange('/v/wiki/a.md');
    await vi.advanceTimersByTimeAsync(1500);
    await engine.idle();
    expect(vault.calls).toEqual(['overrides', 'push']);

    // A genuine new edit retries
    vault.dirty.set('/v/wiki/a.md', 'v2');
    engine.onWikiChange('/v/wiki/a.md');
    await vi.advanceTimersByTimeAsync(1500);
    await engine.idle();
    expect(vault.calls).toEqual(['overrides', 'push', 'overrides', 'push']);
  });

  it('batches multiple inbox drops into a single sync run', async () => {
    const vault = createFakeVault();
    const engine = new WatchEngine(vault.deps, options);

    vault.inbox.push('/v/inbox/a.md', '/v/inbox/b.pdf');
    engine.onInboxEvent();
    await vi.advanceTimersByTimeAsync(1000);
    engine.onInboxEvent();
    await vi.advanceTimersByTimeAsync(2000);
    await engine.idle();

    expect(vault.calls).toEqual(['sync', 'push']);
  });

  it('serializes runs: events during a run are processed after it finishes', async () => {
    const vault = createFakeVault();
    let releaseSync!: () => void;
    vault.deps.runSync = vi.fn(async () => {
      vault.calls.push('sync');
      await new Promise<void>((resolve) => (releaseSync = resolve));
    });
    const engine = new WatchEngine(vault.deps, options);

    engine.onInboxEvent();
    await vi.advanceTimersByTimeAsync(2000);
    expect(vault.calls).toEqual(['sync']);

    // Human edits while sync is busy
    vault.dirty.set('/v/wiki/a.md', 'edit');
    engine.onWikiChange('/v/wiki/a.md');
    await vi.advanceTimersByTimeAsync(1500);
    expect(vault.calls).toEqual(['sync']);

    releaseSync();
    await engine.idle();
    expect(vault.calls).toEqual(['sync', 'push', 'overrides', 'push']);
  });

  it('keeps running after a pipeline failure and skips the push for it', async () => {
    const vault = createFakeVault();
    vault.deps.runSync = vi.fn(async () => {
      throw new Error('model endpoint down');
    });
    const log = vi.fn();
    vault.deps.log = log;
    const engine = new WatchEngine(vault.deps, options);

    engine.onInboxEvent();
    await vi.advanceTimersByTimeAsync(2000);
    await engine.idle();

    expect(vault.deps.pushToNotebook).not.toHaveBeenCalled();
    expect(log).toHaveBeenCalledWith('Inbox sync failed: model endpoint down');
  });

  it('stop() cancels pending debounce timers', async () => {
    const vault = createFakeVault();
    const engine = new WatchEngine(vault.deps, options);

    vault.dirty.set('/v/wiki/a.md', 'edit');
    engine.onWikiChange('/v/wiki/a.md');
    engine.onInboxEvent();
    await engine.stop();
    await vi.advanceTimersByTimeAsync(5000);

    expect(vault.calls).toEqual([]);
  });
});

describe('listDirtyWikiFiles', () => {
  let repo: string;

  beforeEach(() => {
    repo = fs.mkdtempSync(path.join(os.tmpdir(), 'mm-watch-git-'));
    const git = (...args: string[]) =>
      execFileSync('git', ['-c', 'user.email=t@t', '-c', 'user.name=t', ...args], { cwd: repo, stdio: 'ignore' });
    git('init', '-q');
    fs.mkdirSync(path.join(repo, 'wiki', 'summaries'), { recursive: true });
    for (const name of ['Größe.md', 'plain.md', 'notes.txt']) {
      fs.writeFileSync(path.join(repo, 'wiki', 'summaries', name), 'v1\n');
    }
    git('add', '-A');
    git('commit', '-qm', 'init');
  });

  afterEach(() => {
    fs.rmSync(repo, { recursive: true, force: true });
  });

  it('reports edited markdown files with non-ASCII names', () => {
    for (const name of ['Größe.md', 'plain.md', 'notes.txt']) {
      fs.appendFileSync(path.join(repo, 'wiki', 'summaries', name), 'edit\n');
    }
    expect(listDirtyWikiFiles(repo).sort()).toEqual([
      path.join(repo, 'wiki', 'summaries', 'Größe.md'),
      path.join(repo, 'wiki', 'summaries', 'plain.md'),
    ]);
  });
});

describe('classifyWatchPath', () => {
  const root = path.resolve('/vault');
  const p = (...parts: string[]) => path.join(root, ...parts);

  it('routes inbox files of any type to the inbox pipeline', () => {
    expect(classifyWatchPath(root, p('inbox', 'article.md'))).toBe('inbox');
    expect(classifyWatchPath(root, p('inbox', 'paper.pdf'))).toBe('inbox');
  });

  it('routes wiki markdown to the edit pipeline', () => {
    expect(classifyWatchPath(root, p('wiki', 'summaries', 'note.md'))).toBe('wiki');
    expect(classifyWatchPath(root, p('wiki', 'collections', 'concepts', 'x.md'))).toBe('wiki');
  });

  it('ignores hidden files, temp files, generated assets, and non-markdown wiki files', () => {
    expect(classifyWatchPath(root, p('inbox', '.DS_Store'))).toBe('ignore');
    expect(classifyWatchPath(root, p('inbox', 'draft.md.tmp'))).toBe('ignore');
    expect(classifyWatchPath(root, p('wiki', '.obsidian', 'workspace.md'))).toBe('ignore');
    expect(classifyWatchPath(root, p('wiki', 'assets', '2026-10-14', 'processed', 'a.md'))).toBe('ignore');
    expect(classifyWatchPath(root, p('wiki', 'summaries', 'image.png'))).toBe('ignore');
    expect(classifyWatchPath(root, p('config', 'config.yml'))).toBe('ignore');
  });
});
