import * as childProcess from 'child_process';
import * as path from 'path';

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
    }
  } catch (e: any) {
    console.error(`Failed to create git commit for ${filePath}:`, e.message);
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
    runGit(['checkout', '-b', branchName], absolutePath, 'ignore');
    console.log(`Git Branch Created and checked out: "${branchName}"`);
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
      return;
    }

    console.log(`Creating pull request via GitHub CLI...`);
    if (typeof childProcess.execFileSync === 'function') {
      childProcess.execFileSync(
        'gh',
        ['pr', 'create', '--title', `Ingestion: ${branchName}`, '--body', 'Automated compilation of summaries and collections.'],
        { stdio: 'inherit', cwd: absolutePath }
      );
    } else {
      childProcess.execSync(
        `gh pr create --title "Ingestion: ${branchName}" --body "Automated compilation of summaries and collections."`,
        { stdio: 'inherit', cwd: absolutePath }
      );
    }
    console.log(`Successfully created Pull Request for branch ${branchName}`);
  } catch (e: any) {
    console.error(`Failed to automatically create Pull Request:`, e.message);
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


