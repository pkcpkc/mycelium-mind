import * as fs from 'fs';
import * as path from 'path';
import {
  getVaultDir,
  rebuildFolderIndex,
  rebuildWikiRootIndex,
  rebuildTagsPage
} from '../utils/fs-utils.js';
import { buildSessionGraph, runOverviewScript } from '../utils/overview-runner.js';
import { publishWiki } from './publish.js';
import { gitCommit, gitCreateBranch, gitCreatePR, enableGitCommits } from '../utils/git.js';

/**
 * Re-compiles the overview markdown files and rebuilds folder/root indexes.
 * If targetHtmlPath is provided, compiles the static HTML site using MkDocs at the end.
 */
export async function overviewsWiki(
  wikiPath: string,
  targetHtmlPath?: string,
  options?: { pr?: boolean; verbose?: boolean }
): Promise<void> {
  enableGitCommits(!!options?.pr);
  const absolutePath = path.resolve(wikiPath);
  const vaultRoot = getVaultDir(absolutePath);
  const wikiDir = path.join(vaultRoot, 'wiki');

  let branchName = '';
  if (options?.pr) {
    const timestamp = new Date().toISOString()
      .replace(/[-:]/g, '')
      .replace('T', '-')
      .split('.')[0];
    branchName = `overviews-${timestamp}`;
    gitCreateBranch(absolutePath, branchName);
  }

  // 1. Compile Overviews
  console.log('Generating overviews...');
  const overviewsPluginDir = path.join(absolutePath, 'plugins', 'overviews');
  const overviewScripts = fs.existsSync(overviewsPluginDir)
    ? fs.readdirSync(overviewsPluginDir).filter(f => f.endsWith('.js'))
    : [];
  const totalOverviews = overviewScripts.length;

  const sessionGraph = await buildSessionGraph(wikiDir);
  let overviewIdx = 0;
  for (const script of overviewScripts) {
    overviewIdx++;
    const scriptPath = path.join(overviewsPluginDir, script);
    console.log(`[Overviews ${overviewIdx}/${totalOverviews}] Running overview script: ${script}`);
    try {
      await runOverviewScript(scriptPath, wikiDir, sessionGraph);
    } catch (e: any) {
      console.error(`Overview script ${script} failed:`, e.message);
    }
  }

  // 2. Rebuild Indexes
  console.log('Rebuilding indexes...');
  const schemasDir = path.join(absolutePath, 'plugins', 'collections');
  const activeSchemas = fs.existsSync(schemasDir)
    ? fs.readdirSync(schemasDir).filter(f => fs.statSync(path.join(schemasDir, f)).isDirectory())
    : [];
  
  const totalIndexes = activeSchemas.length + 4;
  let indexStepIdx = 0;

  const indexSteps = [
    { name: 'summaries', action: () => rebuildFolderIndex(wikiDir, 'summaries', 'Summaries') },
    { name: 'overviews', action: () => rebuildFolderIndex(wikiDir, 'overviews', 'Overviews') },
    ...activeSchemas.map(s => ({ name: s, action: () => rebuildFolderIndex(wikiDir, `collections/${s}`, s.charAt(0).toUpperCase() + (s.endsWith('s') ? s.slice(1) : s.slice(1) + 's')) })),
    { name: 'root', action: () => rebuildWikiRootIndex(wikiDir) },
    { name: 'tags', action: () => rebuildTagsPage(wikiDir) }
  ];

  for (const step of indexSteps) {
    try {
      indexStepIdx++;
      console.log(`[Indexes ${indexStepIdx}/${totalIndexes}] Rebuilding index for: ${step.name}`);
      const indexStartTime = Date.now();
      await step.action();
      console.log(`[Indexes ${indexStepIdx}/${totalIndexes}] Done in ${((Date.now() - indexStartTime) / 1000).toFixed(1)}s`);
    } catch (e: any) {
      console.error(`Failed to rebuild index for ${step.name}:`, e.message);
    }
  }

  // 3. Compile static site to HTML if targetHtmlPath is provided
  if (targetHtmlPath && targetHtmlPath.trim()) {
    console.log(`\nCompiling static site to: ${targetHtmlPath}...`);
    await publishWiki(wikiPath, targetHtmlPath);
  }

  if (options?.pr && branchName) {
    gitCreatePR(absolutePath, branchName);
  }
}
