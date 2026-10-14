/**
 * Watch-mode scheduling engine.
 *
 * Turns raw filesystem events into serialized pipeline runs:
 *  - inbox drops  → debounced `sync` run (LLM ingestion into wiki/)
 *  - wiki edits   → per-file debounced `overrides` run (re-create edited docs)
 *  - after either → incremental Open Notebook push
 *
 * Loop prevention is git-based rather than timestamp-based: every engine run
 * commits its own writes, so engine-produced files are clean against HEAD and
 * never qualify as human edits. Files an `overrides` run leaves dirty (e.g. LLM
 * failure) are remembered by content hash and only retried once their content
 * changes again, so a failing file cannot re-trigger itself.
 */

export interface WatchEngineDeps {
  /** Ingest every file currently in the inbox (wraps syncWiki). */
  runSync(): Promise<void>;
  /** Re-create every manually edited wiki document (wraps overridesWiki). */
  runOverrides(): Promise<void>;
  /** Push changed documents to Open Notebook; must degrade gracefully when offline. */
  pushToNotebook(): Promise<void>;
  /** Absolute paths of wiki markdown files that differ from git HEAD. */
  listDirtyWikiFiles(): string[];
  /** Absolute paths of files waiting in the inbox. */
  listInboxFiles(): string[];
  /** Content hash of a file, or null if it cannot be read. */
  hashFile(filePath: string): string | null;
  log(message: string): void;
}

export interface WatchEngineOptions {
  /** Quiet period after the last change to a wiki file before it is processed (ms). */
  debounceMs: number;
  /** Quiet period after the last inbox drop before a sync run starts (ms). */
  inboxDebounceMs: number;
}

export class WatchEngine {
  private readonly editTimers = new Map<string, ReturnType<typeof setTimeout>>();
  private inboxTimer: ReturnType<typeof setTimeout> | null = null;
  /** Content hashes of dirty files an overrides run already attempted. */
  private readonly attempted = new Map<string, string>();
  private syncPending = false;
  private editsPending = false;
  private running: Promise<void> | null = null;
  private stopped = false;

  constructor(private readonly deps: WatchEngineDeps, private readonly options: WatchEngineOptions) {}

  /**
   * Startup catch-up sweep: handles edits made while the watcher was offline
   * and inbox files dropped in the meantime.
   */
  start(): Promise<void> {
    this.editsPending = true;
    if (this.deps.listInboxFiles().length > 0) {
      this.syncPending = true;
    }
    return this.drain();
  }

  /** A file was added to or rewritten in the inbox. */
  onInboxEvent(): void {
    if (this.stopped) return;
    if (this.inboxTimer) clearTimeout(this.inboxTimer);
    this.inboxTimer = setTimeout(() => {
      this.inboxTimer = null;
      this.syncPending = true;
      void this.drain();
    }, this.options.inboxDebounceMs);
  }

  /** A wiki markdown file changed on disk. */
  onWikiChange(filePath: string): void {
    if (this.stopped) return;
    const existing = this.editTimers.get(filePath);
    if (existing) clearTimeout(existing);
    this.editTimers.set(
      filePath,
      setTimeout(() => {
        this.editTimers.delete(filePath);
        this.editsPending = true;
        void this.drain();
      }, this.options.debounceMs)
    );
  }

  /** Cancels pending timers and waits for the in-flight run to finish. */
  async stop(): Promise<void> {
    this.stopped = true;
    for (const timer of this.editTimers.values()) clearTimeout(timer);
    this.editTimers.clear();
    if (this.inboxTimer) clearTimeout(this.inboxTimer);
    this.inboxTimer = null;
    await this.running;
  }

  /** Resolves once all queued work has been processed. */
  idle(): Promise<void> {
    return this.running ?? Promise.resolve();
  }

  /**
   * Runs queued work serially. Events arriving mid-run only set flags, so they
   * are picked up by the loop once the current run finishes.
   */
  private drain(): Promise<void> {
    if (!this.running) {
      this.running = this.loop().finally(() => {
        this.running = null;
      });
    }
    return this.running;
  }

  private async loop(): Promise<void> {
    while (!this.stopped && (this.editsPending || this.syncPending)) {
      let changed = false;

      // Edits go first: sync commits all of wiki/, which would otherwise
      // swallow pending human edits into its own commit.
      if (this.editsPending) {
        this.editsPending = false;
        changed = (await this.processEdits()) || changed;
      }

      if (this.syncPending) {
        this.syncPending = false;
        changed = (await this.step('Inbox sync', () => this.deps.runSync())) || changed;
      }

      if (changed) {
        await this.step('Open Notebook push', () => this.deps.pushToNotebook());
      }
    }
  }

  /** Runs overrides when a dirty wiki file has content not yet attempted. */
  private async processEdits(): Promise<boolean> {
    const fresh = this.freshEdits();
    if (fresh.length === 0) return false;

    this.deps.log(`Detected manual edits: ${fresh.length} file(s)`);
    const ok = await this.step('Overrides', () => this.deps.runOverrides());

    // Whatever is still dirty was attempted and failed; park it until it changes.
    const stillDirty = new Set(this.deps.listDirtyWikiFiles());
    for (const file of [...this.attempted.keys()]) {
      if (!stillDirty.has(file)) this.attempted.delete(file);
    }
    for (const file of stillDirty) {
      const hash = this.deps.hashFile(file);
      if (hash) this.attempted.set(file, hash);
    }
    return ok;
  }

  private freshEdits(): string[] {
    return this.deps.listDirtyWikiFiles().filter((file) => {
      const hash = this.deps.hashFile(file);
      return hash !== null && this.attempted.get(file) !== hash;
    });
  }

  private async step(label: string, fn: () => Promise<void>): Promise<boolean> {
    try {
      await fn();
      return true;
    } catch (err: any) {
      this.deps.log(`${label} failed: ${err?.message ?? err}`);
      return false;
    }
  }
}
