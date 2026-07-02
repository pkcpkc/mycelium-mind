import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import * as path from 'path';
import * as fs from 'fs';
import { fileURLToPath } from 'url';
import { initWiki } from '../commands/init.js';
import { syncWiki } from '../commands/sync.js';
import { publishWiki } from '../commands/publish.js';
import { resyncWiki } from '../commands/resync.js';
import { callAgenticModel } from '../utils/openai-api.js';
import * as childProcess from 'child_process';
import { runOverviewScript } from '../utils/overview-runner.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const TEST_ROOT = path.resolve(__dirname, '..', '..', 'temp-cli-tests-vaults');

vi.mock('child_process', () => ({
  execSync: vi.fn(() => Buffer.from(''))
}));

vi.mock('../utils/openai-api.js', () => ({
  callAgenticModel: vi.fn((messages: any[]) => {
    const userMsg = messages[messages.length - 1].content;
    const systemMsg = messages[0]?.content || '';

    if (systemMsg.includes('Base Summary Extraction Prompt')) {
      return Promise.resolve(`---
type: "Summary"
title: "Andrej Karpathy"
tags: ["ai-education"]
concept: ["Deep Learning"]
person: ["Andrej Karpathy"]
times:
  - date: "2015"
    event: "Founding member at OpenAI"
---
# Summary of: Andrej Karpathy
This is a summary description about Deep Learning and Andrej Karpathy.
`);
    } else if (userMsg.includes('Wiki Person Prompt')) {
      return Promise.resolve(`---
type: "Person"
title: "Andrej Karpathy"
description: "Pioneering AI engineer and educator."
tags: ["ai-education"]
timestamp: "2026-06-24T10:38:00Z"
---
# Andrej Karpathy
AI researcher and educator.
`);
    } else if (userMsg.includes('Wiki Concept Prompt')) {
      return Promise.resolve(`---
type: "Concept"
title: "Deep Learning"
description: "A subset of machine learning."
tags: ["machine-learning"]
timestamp: "2026-06-24T10:38:00Z"
---
# Deep Learning
Deep learning details.
`);
    }

    return Promise.resolve('# Mocked Content');
  })
}));

describe('Unified Wiki Compiler CLI Tests', () => {
  const wikiPath = path.join(TEST_ROOT, 'TestWiki');

  beforeEach(() => {
    fs.mkdirSync(TEST_ROOT, { recursive: true });
  });

  afterEach(() => {
    fs.rmSync(TEST_ROOT, { recursive: true, force: true });
    vi.clearAllMocks();
  });

  it('init command: should create the entire folder structure and default configurations', async () => {
    await initWiki(wikiPath);

    // Verify folders
    expect(fs.existsSync(path.join(wikiPath, 'inbox'))).toBe(true);
    expect(fs.existsSync(path.join(wikiPath, 'config', 'summary', 'schema.md'))).toBe(true);
    expect(fs.existsSync(path.join(wikiPath, 'config', 'summary', 'prompt.md'))).toBe(true);
    expect(fs.existsSync(path.join(wikiPath, 'config', 'mkdocs.yml'))).toBe(true);
    expect(fs.existsSync(path.join(wikiPath, 'plugins', 'collections', 'concepts', 'schema.md'))).toBe(true);
    expect(fs.existsSync(path.join(wikiPath, 'plugins', 'collections', 'persons', 'schema.md'))).toBe(true);
    expect(fs.existsSync(path.join(wikiPath, 'plugins', 'collections', 'times', 'schema.md'))).toBe(true);
    expect(fs.existsSync(path.join(wikiPath, 'plugins', 'overviews', 'timeline.js'))).toBe(true);
    expect(fs.existsSync(path.join(wikiPath, 'plugins', 'overviews', 'social-graph.js'))).toBe(true);
    expect(fs.existsSync(path.join(wikiPath, 'config', 'config.yml'))).toBe(true);
    expect(fs.existsSync(path.join(wikiPath, 'wiki', 'index.md'))).toBe(true);
  });

  it('sync command: should process files from inbox, copy to assets, build summaries, compile collections, run overviews, and build index files', async () => {
    // Initialize wiki structure
    await initWiki(wikiPath);

    // Write a test document to inbox
    const docPath = path.join(wikiPath, 'inbox', 'Andrej Karpathy.md');
    fs.writeFileSync(docPath, '# Andrej Karpathy\nI like deep learning and co-founded OpenAI.', 'utf8');

    // Run sync
    await syncWiki(wikiPath);

    // Verify inbox is empty
    expect(fs.existsSync(docPath)).toBe(false);

    // Verify processed and sources copy
    const dateToday = new Date().toISOString().split('T')[0];
    const processedCopy = path.join(wikiPath, 'wiki', 'assets', dateToday, 'processed', 'Andrej Karpathy.md');
    const sourceCopy = path.join(wikiPath, 'wiki', 'assets', dateToday, 'sources', 'Andrej Karpathy.md');
    expect(fs.existsSync(processedCopy)).toBe(true);
    expect(fs.existsSync(sourceCopy)).toBe(true);

    // Verify summary generated
    const summaryFile = path.join(wikiPath, 'wiki', 'summaries', 'Andrej Karpathy.md');
    expect(fs.existsSync(summaryFile)).toBe(true);
    const summaryContent = fs.readFileSync(summaryFile, 'utf8');
    expect(summaryContent).toContain('type: Summary');

    // Verify collections compiled
    const personFile = path.join(wikiPath, 'wiki', 'collections', 'persons', 'Andrej Karpathy.md');
    const conceptFile = path.join(wikiPath, 'wiki', 'collections', 'concepts', 'Deep Learning.md');
    expect(fs.existsSync(personFile)).toBe(true);
    expect(fs.existsSync(conceptFile)).toBe(true);

    // Verify overviews executed
    const timelineFile = path.join(wikiPath, 'wiki', 'overviews', 'timeline.md');
    const socialFile = path.join(wikiPath, 'wiki', 'overviews', 'social-graph.md');
    expect(fs.existsSync(timelineFile)).toBe(true);
    expect(fs.existsSync(socialFile)).toBe(true);

    // Verify dynamic collection clouds generated
    const conceptsCloudFile = path.join(wikiPath, 'wiki', 'collections', 'concepts', 'concepts-cloud.md');
    const personsCloudFile = path.join(wikiPath, 'wiki', 'collections', 'persons', 'persons-cloud.md');
    expect(fs.existsSync(conceptsCloudFile)).toBe(true);
    expect(fs.existsSync(personsCloudFile)).toBe(true);

    // Verify index files built
    expect(fs.existsSync(path.join(wikiPath, 'wiki', 'summaries', 'index.md'))).toBe(true);
    expect(fs.existsSync(path.join(wikiPath, 'wiki', 'collections', 'persons', 'index.md'))).toBe(true);
    expect(fs.existsSync(path.join(wikiPath, 'wiki', 'collections', 'concepts', 'index.md'))).toBe(true);
    expect(fs.existsSync(path.join(wikiPath, 'wiki', 'index.md'))).toBe(true);
  });

  it('resync command: should wipe and recreate summaries, collections and overviews from existing assets', async () => {
    // Setup and run a clean sync first
    await initWiki(wikiPath);
    const docPath = path.join(wikiPath, 'inbox', 'Andrej Karpathy.md');
    fs.writeFileSync(docPath, '# Andrej Karpathy\nI like deep learning and co-founded OpenAI.', 'utf8');
    await syncWiki(wikiPath);

    // Run resync
    await resyncWiki(wikiPath);

    // Verify summary, collections, overviews exist after recreation
    const summaryFile = path.join(wikiPath, 'wiki', 'summaries', 'Andrej Karpathy.md');
    const personFile = path.join(wikiPath, 'wiki', 'collections', 'persons', 'Andrej Karpathy.md');
    const conceptFile = path.join(wikiPath, 'wiki', 'collections', 'concepts', 'Deep Learning.md');
    const timelineFile = path.join(wikiPath, 'wiki', 'overviews', 'timeline.md');

    expect(fs.existsSync(summaryFile)).toBe(true);
    expect(fs.existsSync(personFile)).toBe(true);
    expect(fs.existsSync(conceptFile)).toBe(true);
    expect(fs.existsSync(timelineFile)).toBe(true);
  });

  it('publish command: should write cytoscape assets and build standard MkDocs outputs with converted links', async () => {
    await initWiki(wikiPath);
    const docPath = path.join(wikiPath, 'inbox', 'Andrej Karpathy.md');
    fs.writeFileSync(docPath, '# Andrej Karpathy\nI like deep learning.', 'utf8');
    await syncWiki(wikiPath);

    // Write a test target directory for publish
    const targetDir = path.join(TEST_ROOT, 'PublishedSite');
    
    // We mock execSync for mkdocs since we don't assume mkdocs is globally available in the test runner
    const { execSync } = await import('child_process');
    
    await publishWiki(wikiPath, targetDir);

    expect(execSync).toHaveBeenCalled();
  });

  it('sync and resync commands: should accept options for git branch, pull request, and verbose logs', async () => {
    await initWiki(wikiPath);
    const docPath = path.join(wikiPath, 'inbox', 'Andrej Karpathy.md');
    fs.writeFileSync(docPath, '# Andrej Karpathy\nI like deep learning.', 'utf8');

    const gitUtils = await import('../utils/git.js');
    const spyBranch = vi.spyOn(gitUtils, 'gitCreateBranch');
    const spyPR = vi.spyOn(gitUtils, 'gitCreatePR');

    // 1. Run sync WITHOUT options (should not commit or branch or pr or tag)
    await syncWiki(wikiPath);

    expect(spyBranch).not.toHaveBeenCalled();
    expect(spyPR).not.toHaveBeenCalled();
    expect(gitUtils.isGitCommitsEnabled()).toBe(false);

    // Reset inbox file for the next run
    fs.writeFileSync(docPath, '# Andrej Karpathy\nI like deep learning.', 'utf8');

    // 2. Run sync with options
    await syncWiki(wikiPath, { branch: true, pr: true, verbose: true });

    expect(spyBranch).toHaveBeenCalled();
    expect(spyPR).toHaveBeenCalled();
    expect(gitUtils.isGitCommitsEnabled()).toBe(true);

    // Verify index.md for overviews was also generated
    const overviewsIndex = path.join(wikiPath, 'wiki', 'overviews', 'index.md');
    expect(fs.existsSync(overviewsIndex)).toBe(true);

    spyBranch.mockClear();
    spyPR.mockClear();

    // 3. Run resync WITHOUT options
    await resyncWiki(wikiPath);
    expect(spyBranch).not.toHaveBeenCalled();
    expect(spyPR).not.toHaveBeenCalled();
    expect(gitUtils.isGitCommitsEnabled()).toBe(false);

    // 4. Run resync with options
    await resyncWiki(wikiPath, { branch: true, pr: true, verbose: true });

    expect(spyBranch).toHaveBeenCalled();
    expect(spyPR).toHaveBeenCalled();
    expect(gitUtils.isGitCommitsEnabled()).toBe(true);

    spyBranch.mockRestore();
    spyPR.mockRestore();
  });

  it('sync and resync commands: should implicitly check plugins and exit with 1 on plugin error', async () => {
    await initWiki(wikiPath);

    // Make a plugin invalid by writing invalid content to schema.md
    const invalidPluginSchema = path.join(wikiPath, 'plugins', 'collections', 'concepts', 'schema.md');
    fs.writeFileSync(invalidPluginSchema, 'invalid schema content without frontmatter', 'utf8');

    const exitSpy = vi.spyOn(process, 'exit').mockImplementation(() => {
      throw new Error('process.exit called');
    });
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    // Running syncWiki should trigger checkPlugin, which exits on error
    await expect(syncWiki(wikiPath)).rejects.toThrow('process.exit called');
    expect(exitSpy).toHaveBeenCalledWith(1);

    exitSpy.mockClear();

    // Running resyncWiki should trigger checkPlugin, which exits on error
    await expect(resyncWiki(wikiPath)).rejects.toThrow('process.exit called');
    expect(exitSpy).toHaveBeenCalledWith(1);

    exitSpy.mockRestore();
    errorSpy.mockRestore();
  });

  it('sync and resync commands: should implicitly initialize a wiki if target folders are missing', async () => {
    expect(fs.existsSync(path.join(wikiPath, 'inbox'))).toBe(false);

    await syncWiki(wikiPath);

    expect(fs.existsSync(path.join(wikiPath, 'inbox'))).toBe(true);
    expect(fs.existsSync(path.join(wikiPath, 'config', 'summary', 'schema.md'))).toBe(true);

    fs.rmSync(wikiPath, { recursive: true, force: true });
    expect(fs.existsSync(path.join(wikiPath, 'wiki'))).toBe(false);

    await resyncWiki(wikiPath);

    expect(fs.existsSync(path.join(wikiPath, 'wiki'))).toBe(true);
    expect(fs.existsSync(path.join(wikiPath, 'config', 'summary', 'schema.md'))).toBe(true);
  });

  it('overview runner: should respect the timeout set in config.yml and abort slow scripts', async () => {
    await initWiki(wikiPath);

    // Overwrite config.yml with a very short timeout (50ms)
    const configPath = path.join(wikiPath, 'config', 'config.yml');
    fs.writeFileSync(configPath, 'overviews:\n  script_timeout_ms: 50\n', 'utf8');

    // Create a script that runs an infinite loop
    const slowScriptFolder = path.join(wikiPath, 'plugins', 'overviews');
    fs.mkdirSync(slowScriptFolder, { recursive: true });
    const slowScriptPath = path.join(slowScriptFolder, 'infinite-loop.js');
    fs.writeFileSync(slowScriptPath, 'while (true) {}', 'utf8');

    const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    // Try executing the script; it should time out and throw an error
    await expect(runOverviewScript(slowScriptPath, path.join(wikiPath, 'wiki'), [])).rejects.toThrow();

    consoleErrorSpy.mockRestore();
  });

  it('sync and resync commands: should log dual-level progress and final summary', async () => {
    await initWiki(wikiPath);
    const docPath = path.join(wikiPath, 'inbox', 'Andrej Karpathy.md');
    fs.writeFileSync(docPath, '# Andrej Karpathy\nI like deep learning and co-founded OpenAI.', 'utf8');

    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

    // Run sync
    await syncWiki(wikiPath);

    // Verify logs
    const loggedLines = logSpy.mock.calls.map(call => call[0]);
    
    // Check that we logged steps for summaries, concepts, overviews, indexes
    expect(loggedLines.some(line => line && line.includes('[Step 1] [Summaries 1/1]'))).toBe(true);
    expect(loggedLines.some(line => line && line.includes('[concepts 1/1]'))).toBe(true);
    expect(loggedLines.some(line => line && line.includes('[Indexes 1/'))).toBe(true);
    expect(loggedLines.some(line => line && line.includes('Sync pipeline complete.'))).toBe(true);
    expect(loggedLines.some(line => line && line.includes('- Summaries generated: 1/1'))).toBe(true);

    logSpy.mockClear();

    // Run resync
    await resyncWiki(wikiPath);

    const resyncLoggedLines = logSpy.mock.calls.map(call => call[0]);
    expect(resyncLoggedLines.some(line => line && line.includes('[Step 1] [Summaries 1/1]'))).toBe(true);
    expect(resyncLoggedLines.some(line => line && line.includes('Resync complete.'))).toBe(true);
    expect(resyncLoggedLines.some(line => line && line.includes('- Summaries generated: 1/1'))).toBe(true);

    logSpy.mockRestore();
  });
});
