import * as fs from 'fs';
import * as path from 'path';
import { execSync } from 'child_process';
import { projectRootDir } from '../utils/config.js';

const compiledAssetsPath = path.join(projectRootDir, 'build/commands/assets');
const useCompiled = fs.existsSync(compiledAssetsPath);
const assetsBaseDir = useCompiled ? compiledAssetsPath : path.join(projectRootDir, 'src/commands/assets');

const configAssetsDir = path.join(assetsBaseDir, 'config');
const publishAssetsDir = path.join(assetsBaseDir, 'publish');
const summaryAssetsDir = path.join(assetsBaseDir, 'summary');

import { copyCollection, copyOverview, defaultLibPath } from './library.js';

/**
 * Initializes a new wiki structure.
 */
export async function initWiki(
  wikiPath: string,
  options?: { overwrite?: boolean; includeDefaults?: boolean }
): Promise<void> {
  const overwrite = options?.overwrite ?? true;
  const includeDefaults = options?.includeDefaults ?? false;
  const absolutePath = path.resolve(wikiPath);
  console.log(`Initializing wiki folder layout at: ${absolutePath}`);

  // 1. Create directory structures
  const dirs = [
    path.join(absolutePath, 'inbox'),
    path.join(absolutePath, 'config', 'summary'),
    path.join(absolutePath, 'plugins', 'collections'),
    path.join(absolutePath, 'plugins', 'overviews'),
    path.join(absolutePath, 'wiki', 'assets'),
    path.join(absolutePath, 'wiki', 'collections'),
    path.join(absolutePath, 'wiki', 'summaries'),
    path.join(absolutePath, 'wiki', 'overviews'),
  ];

  for (const d of dirs) {
    if (!fs.existsSync(d)) {
      fs.mkdirSync(d, { recursive: true });
    }
  }

  // Load core templates from asset directories
  const mkdocsContent = fs.readFileSync(path.join(publishAssetsDir, 'mkdocs.yml'), 'utf8');
  const configContent = fs.readFileSync(path.join(configAssetsDir, 'config.yml'), 'utf8');
  const summarySchemaContent = fs.readFileSync(path.join(summaryAssetsDir, 'schema.yml'), 'utf8');
  const summaryPromptContent = fs.readFileSync(path.join(summaryAssetsDir, 'prompt.md'), 'utf8');
  const indexTemplate = fs.readFileSync(path.join(publishAssetsDir, 'index.md'), 'utf8');

  const writeFile = (filePath: string, content: string) => {
    if (overwrite || !fs.existsSync(filePath)) {
      fs.writeFileSync(filePath, content, 'utf8');
    }
  };

  // 2. Pre-populate config files
  writeFile(path.join(absolutePath, 'config', 'mkdocs.yml'), mkdocsContent);
  writeFile(path.join(absolutePath, 'config', 'config.yml'), configContent);
  writeFile(path.join(absolutePath, 'config', 'summary', 'schema.yml'), summarySchemaContent);
  writeFile(path.join(absolutePath, 'config', 'summary', 'prompt.md'), summaryPromptContent);

  // 3. Optional default library templates setup
  if (includeDefaults) {
    console.log('Installing default collections & overviews...');
    try {
      copyCollection('concepts', absolutePath, defaultLibPath);
      copyCollection('persons', absolutePath, defaultLibPath);
      copyCollection('times', absolutePath, defaultLibPath);
      copyOverview('timeline', absolutePath, defaultLibPath);
      copyOverview('social-graph', absolutePath, defaultLibPath);
    } catch (e: any) {
      console.warn('Failed to copy default templates:', e.message);
    }
  }

  // 4. Pre-populate default base wiki index.md
  const indexFile = path.join(absolutePath, 'wiki', 'index.md');
  const wikiName = path.basename(absolutePath);
  const timestamp = new Date().toISOString().replace(/\.\d{3}Z$/, 'Z');
  const baseIndexContent = indexTemplate
    .replace(/{{WIKI_NAME}}/g, wikiName)
    .replace(/{{TIMESTAMP}}/g, timestamp);
  writeFile(indexFile, baseIndexContent);

  // 5. Copy mycelium logo if available in the project root
  const sourceLogo = path.join(projectRootDir, 'assets', 'mycelium-mind-icon.png');
  const targetLogoDir = path.join(absolutePath, 'config', 'assets');
  const targetLogo = path.join(targetLogoDir, 'mycelium-mind-icon.png');
  if (fs.existsSync(sourceLogo)) {
    if (!fs.existsSync(targetLogoDir)) {
      fs.mkdirSync(targetLogoDir, { recursive: true });
    }
    if (overwrite || !fs.existsSync(targetLogo)) {
      fs.copyFileSync(sourceLogo, targetLogo);
      console.log('Copied default mycelium icon to config assets.');
    }
  }

  // 6. Initialize git repository if not present
  const gitDir = path.join(absolutePath, '.git');
  if (!fs.existsSync(gitDir)) {
    try {
      execSync('git init', { cwd: absolutePath, stdio: 'ignore' });
      console.log('Initialized git repository in wiki.');
    } catch (e: any) {
      console.warn(`Failed to initialize git repository in ${absolutePath}:`, e.message);
    }
  }

  console.log(`Wiki successfully initialized at: ${absolutePath}`);
}
