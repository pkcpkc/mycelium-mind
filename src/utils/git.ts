import * as childProcess from 'child_process';
import * as fs from 'fs';
import * as path from 'path';
import { emitEvent, toVaultPath } from '../core/hooks.js';

let commitsEnabled = false;

/**
 * Executes a git command with parameterized arguments to avoid shell escaping issues.
 */
function runGit(args: string[], cwd: string, stdio: any = 'ignore'): string {
  if (typeof childProcess.execFileSync === 'function') {
    try {
      const res = childProcess.execFileSync('git', args, { cwd, stdio });
      return res ? res.toString() : '';
    } catch (err) {
      throw err;
    }
  }
  // Fallback for test runners where only execSync was mocked
  const quotedArgs = args.map(a => `"${a.replace(/"/g, '\\"')}"`).join(' ');
  const res = childProcess.execSync(`git ${quotedArgs}`, { cwd, stdio });
  return res ? res.toString() : '';
}

/**
 * Emits git.committed for the commit just created in `cwd`.
 */
function emitCommitted(cwd: string, message: string, files: string[]): void {
  try {
    const sha = runGit(['rev-parse', 'HEAD'], cwd, 'pipe').trim();
    const branch = runGit(['rev-parse', '--abbrev-ref', 'HEAD'], cwd, 'pipe').trim();
    emitEvent('git.committed', { sha, message, files, branch });
  } catch {
    // Hook metadata is best-effort; the commit itself already succeeded
  }
}

/**
 * Lists staged files as vault-relative paths.
 */
function stagedFiles(cwd: string): string[] {
  const root = runGit(['rev-parse', '--show-toplevel'], cwd, 'pipe').trim();
  return runGit(['diff', '--cached', '--name-only', '-z'], cwd, 'pipe')
    .split('\0')
    .filter(Boolean)
    .map((f) => toVaultPath(path.join(root, f)));
}

/**
 * Enable or disable git commits and tags globally.
 */
export function enableGitCommits(enabled = true): void {
  commitsEnabled = enabled;
}

/**
 * Returns whether git commits and tags are currently enabled.
 */
export function isGitCommitsEnabled(): boolean {
  return commitsEnabled;
}

/**
 * Creates a git commit for the specified file with the given message.
 * Safe to call even if there are no changes, or if running in a test environment.
 */
export function gitCommit(filePath: string, message: string): void {
  if (!commitsEnabled) {
    return;
  }
  if (process.env.NODE_ENV === 'test' || process.env.VITEST === 'true') {
    return;
  }
  try {
    const absolutePath = path.resolve(filePath);
    const fileDir = path.dirname(absolutePath);
    runGit(['add', absolutePath], fileDir, 'ignore');
    const status = runGit(['status', '--porcelain', absolutePath], fileDir, 'pipe').trim();
    if (status) {
      runGit(['commit', '-m', message], fileDir, 'ignore');
      console.log(`Git Commit: "${message}"`);
      emitCommitted(fileDir, message, [toVaultPath(absolutePath)]);
    }
  } catch (e: any) {
    console.error(`Failed to create git commit for ${filePath}:`, e.message);
  }
}

const engineWrites = new Set<string>();

/**
 * Records a file written (or deleted) by the engine, so gitCommitTracked can stage exactly
 * the engine's output and leave concurrent manual edits untouched.
 */
export function trackEngineWrite(filePath: string): void {
  engineWrites.add(path.resolve(filePath));
}

/**
 * Forgets previously tracked writes; call at the start of a run so a later
 * gitCommitTracked only covers that run's output.
 */
export function clearEngineWrites(): void {
  engineWrites.clear();
}

/**
 * Commits all tracked engine writes plus every change under `extraPathspecs`
 * (for directories only the engine writes to), then clears the tracked set.
 */
export function gitCommitTracked(wikiPath: string, extraPathspecs: string[], message: string): void {
  const tracked = [...engineWrites];
  engineWrites.clear();
  if (!commitsEnabled) {
    return;
  }
  if (process.env.NODE_ENV === 'test' || process.env.VITEST === 'true') {
    return;
  }
  try {
    const absolutePath = path.resolve(wikiPath);
    for (const spec of extraPathspecs) {
      if (fs.existsSync(path.join(absolutePath, spec))) {
        runGit(['add', '-A', '--', spec], absolutePath, 'ignore');
      }
    }
    const existing = tracked.filter((f) => fs.existsSync(f));
    for (let i = 0; i < existing.length; i += 100) {
      runGit(['add', '--', ...existing.slice(i, i + 100)], absolutePath, 'ignore');
    }
    // Files the engine deleted: stage the removal (no-op if never committed)
    const removed = tracked.filter((f) => !fs.existsSync(f));
    for (let i = 0; i < removed.length; i += 100) {
      runGit(['rm', '--cached', '--ignore-unmatch', '-q', '--', ...removed.slice(i, i + 100)], absolutePath, 'ignore');
    }
    const staged = stagedFiles(absolutePath);
    if (staged.length > 0) {
      runGit(['commit', '-m', message], absolutePath, 'ignore');
      console.log(`Git Commit: "${message}"`);
      emitCommitted(absolutePath, message, staged);
    }
  } catch (e: any) {
    console.error(`Failed to create git commit for tracked engine writes:`, e.message);
  }
}

/**
 * Runs a read-only git command without a shell and returns its stdout.
 */
export function gitRead(repoPath: string, args: string[]): string {
  return runGit(args, repoPath, ['ignore', 'pipe', 'ignore']);
}

/**
 * Lists repo-relative paths of markdown files under `pathspec` that differ from HEAD.
 * Uses NUL-delimited output so non-ASCII names are never quoted or escaped.
 */
export function gitListModifiedMarkdown(repoPath: string, pathspec: string): string[] {
  return runGit(['diff', 'HEAD', '--name-only', '-z', '--', pathspec], repoPath, 'pipe')
    .split('\0')
    .filter((name) => name.endsWith('.md'));
}

/**
 * Stages every change (including deletions) under the given pathspec and commits it.
 * Catches files removed by folder wipes or written while per-file commits were disabled.
 */
export function gitCommitAll(wikiPath: string, pathspec: string, message: string): void {
  if (!commitsEnabled) {
    return;
  }
  if (process.env.NODE_ENV === 'test' || process.env.VITEST === 'true') {
    return;
  }
  try {
    const absolutePath = path.resolve(wikiPath);
    runGit(['add', '-A', '--', pathspec], absolutePath, 'ignore');
    const staged = stagedFiles(absolutePath);
    if (staged.length > 0) {
      runGit(['commit', '-m', message], absolutePath, 'ignore');
      console.log(`Git Commit: "${message}"`);
      emitCommitted(absolutePath, message, staged);
    }
  } catch (e: any) {
    console.error(`Failed to create git commit for ${pathspec}:`, e.message);
  }
}

/**
 * Creates and checkouts a new git branch in the wiki repository.
 */
export function gitCreateBranch(wikiPath: string, branchName: string): void {
  if (process.env.NODE_ENV === 'test' || process.env.VITEST === 'true') {
    return;
  }
  try {
    const absolutePath = path.resolve(wikiPath);
    const baseBranch = gitGetCurrentBranch(absolutePath);
    runGit(['checkout', '-b', branchName], absolutePath, 'ignore');
    console.log(`Git Branch Created and checked out: "${branchName}"`);
    emitEvent('git.branch.created', { branch: branchName, base_branch: baseBranch });
  } catch (e: any) {
    console.error(`Failed to create/checkout git branch ${branchName} in ${wikiPath}:`, e.message);
  }
}

/**
 * Pushes the branch and creates a pull request using the github (gh) CLI.
 */
export function gitCreatePR(wikiPath: string, branchName: string): void {
  if (process.env.NODE_ENV === 'test' || process.env.VITEST === 'true') {
    return;
  }
  try {
    const absolutePath = path.resolve(wikiPath);
    console.log(`Pushing branch ${branchName} to origin...`);
    try {
      runGit(['push', '-u', 'origin', branchName], absolutePath, 'inherit');
    } catch (e: any) {
      console.warn(`Failed to push branch to origin (is a remote configured?):`, e.message);
      emitEvent('git.pr.failed', { branch: branchName, stage: 'push', error: e.message });
      return;
    }

    console.log(`Creating pull request via GitHub CLI...`);
    const title = `Ingestion: ${branchName}`;
    // stdout is captured (not inherited) so the PR URL gh prints can be reported to hooks
    const stdio: childProcess.StdioOptions = ['ignore', 'pipe', 'inherit'];
    let output: Buffer | string;
    if (typeof childProcess.execFileSync === 'function') {
      output = childProcess.execFileSync(
        'gh',
        ['pr', 'create', '--title', title, '--body', 'Automated compilation of summaries and collections.'],
        { stdio, cwd: absolutePath }
      );
    } else {
      output = childProcess.execSync(
        `gh pr create --title "${title}" --body "Automated compilation of summaries and collections."`,
        { stdio, cwd: absolutePath }
      );
    }
    const text = output ? output.toString().trim() : '';
    if (text) console.log(text);
    const url = text.match(/https?:\/\/\S+/g)?.pop() ?? null;
    console.log(`Successfully created Pull Request for branch ${branchName}`);
    emitEvent('git.pr.created', { branch: branchName, url, title });
  } catch (e: any) {
    console.error(`Failed to automatically create Pull Request:`, e.message);
    emitEvent('git.pr.failed', { branch: branchName, stage: 'gh', error: e.message });
  }
}

export interface GitCommitQueue {
  queuedGitCommit: (filePath: string, message: string) => Promise<void>;
  awaitGitCommits: () => Promise<void>;
}

/**
 * Creates a sequential FIFO promise queue for git commits.
 */
export function createGitCommitQueue(): GitCommitQueue {
  let gitCommitQueue = Promise.resolve();
  const queuedGitCommit = (filePath: string, message: string) => {
    gitCommitQueue = gitCommitQueue.then(() => {
      gitCommit(filePath, message);
    });
    return gitCommitQueue;
  };

  const awaitGitCommits = () => gitCommitQueue;

  return { queuedGitCommit, awaitGitCommits };
}

/**
 * Returns the current checked out git branch in the wiki repository.
 */
export function gitGetCurrentBranch(wikiPath: string): string {
  if (process.env.NODE_ENV === 'test' || process.env.VITEST === 'true') {
    return 'main';
  }
  try {
    const absolutePath = path.resolve(wikiPath);
    return runGit(['rev-parse', '--abbrev-ref', 'HEAD'], absolutePath, 'pipe').trim() || 'main';
  } catch {
    return 'main';
  }
}

/**
 * Discards uncommitted modifications and returns to targetBranch, deleting the aborted branch if specified.
 */
export function gitRollbackBranch(wikiPath: string, targetBranch?: string, branchToDelete?: string): void {
  if (process.env.NODE_ENV === 'test' || process.env.VITEST === 'true') {
    return;
  }
  try {
    const absolutePath = path.resolve(wikiPath);
    runGit(['checkout', '--', '.'], absolutePath, 'ignore');
    runGit(['clean', '-fd'], absolutePath, 'ignore');
    if (targetBranch) {
      runGit(['checkout', targetBranch], absolutePath, 'ignore');
    }
    const deleteBranch = !!branchToDelete && branchToDelete !== targetBranch;
    if (deleteBranch) {
      runGit(['branch', '-D', branchToDelete!], absolutePath, 'ignore');
      console.log(`Rolled back to branch '${targetBranch}' and deleted aborted branch '${branchToDelete}'.`);
    }
    emitEvent('git.rolled_back', { restored_branch: targetBranch ?? null, branch_deleted: deleteBranch ? branchToDelete : null });
  } catch (e: any) {
    console.error(`Failed during git rollback:`, e.message);
  }
}


