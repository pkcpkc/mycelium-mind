import { execSync } from 'child_process';
import * as path from 'path';
import { projectRootDir } from './config.js';

let commitsEnabled = false;

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
    // Skip committing during test runs to avoid polluting git history
    return;
  }
  try {
    const absolutePath = path.resolve(filePath);
    const fileDir = path.dirname(absolutePath);
    execSync(`git add "${absolutePath}"`, { stdio: 'ignore', cwd: fileDir });
    const status = execSync(`git status --porcelain "${absolutePath}"`, { cwd: fileDir }).toString().trim();
    if (status) {
      execSync(`git commit -m "${message}"`, { stdio: 'ignore', cwd: fileDir });
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
    // Make sure we have a clean state or git is init
    execSync(`git checkout -b "${branchName}"`, { stdio: 'ignore', cwd: absolutePath });
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
      execSync(`git push -u origin "${branchName}"`, { stdio: 'inherit', cwd: absolutePath });
    } catch (e: any) {
      console.warn(`Failed to push branch to origin (is a remote configured?):`, e.message);
      return;
    }
    
    console.log(`Creating pull request via GitHub CLI...`);
    execSync(
      `gh pr create --title "Ingestion: ${branchName}" --body "Automated compilation of summaries and collections."`,
      { stdio: 'inherit', cwd: absolutePath }
    );
    console.log(`Successfully created Pull Request for branch ${branchName}`);
  } catch (e: any) {
    console.error(`Failed to automatically create Pull Request:`, e.message);
  }
}

