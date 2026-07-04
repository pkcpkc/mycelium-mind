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
const conceptsAssetsDir = path.join(assetsBaseDir, 'collections/concepts');
const personsAssetsDir = path.join(assetsBaseDir, 'collections/persons');
const timesAssetsDir = path.join(assetsBaseDir, 'collections/times');
const overviewsAssetsDir = path.join(assetsBaseDir, 'overviews');

/**
 * Initializes a new wiki structure.
 */
export async function initWiki(wikiPath: string, options?: { overwrite?: boolean }): Promise<void> {
  const overwrite = options?.overwrite ?? true;
  const absolutePath = path.resolve(wikiPath);
  console.log(`Initializing wiki folder layout at: ${absolutePath}`);

  // 1. Create directory structures
  const dirs = [
    path.join(absolutePath, 'inbox'),
    path.join(absolutePath, 'config', 'summary'),
    path.join(absolutePath, 'plugins', 'collections', 'concepts'),
    path.join(absolutePath, 'plugins', 'collections', 'persons'),
    path.join(absolutePath, 'plugins', 'collections', 'times'),
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

  // Load templates from asset directories
  const mkdocsContent = fs.readFileSync(path.join(publishAssetsDir, 'mkdocs.yml'), 'utf8');
  const configContent = fs.readFileSync(path.join(configAssetsDir, 'config.yml'), 'utf8');
  const summarySchemaContent = fs.readFileSync(path.join(summaryAssetsDir, 'schema.yml'), 'utf8');
  const summaryPromptContent = fs.readFileSync(path.join(summaryAssetsDir, 'prompt.md'), 'utf8');

  const conceptSchemaContent = fs.readFileSync(path.join(conceptsAssetsDir, 'schema.yml'), 'utf8');
  const conceptExtensionContent = fs.readFileSync(path.join(conceptsAssetsDir, 'summary-schema-extension.yml'), 'utf8');
  const conceptPromptContent = fs.readFileSync(path.join(conceptsAssetsDir, 'prompt.md'), 'utf8');

  const personSchemaContent = fs.readFileSync(path.join(personsAssetsDir, 'schema.yml'), 'utf8');
  const personExtensionContent = fs.readFileSync(path.join(personsAssetsDir, 'summary-schema-extension.yml'), 'utf8');
  const personPromptContent = fs.readFileSync(path.join(personsAssetsDir, 'prompt.md'), 'utf8');

  const timesSchemaContent = fs.readFileSync(path.join(timesAssetsDir, 'schema.yml'), 'utf8');
  const timesExtensionContent = fs.readFileSync(path.join(timesAssetsDir, 'summary-schema-extension.yml'), 'utf8');
  const timesPromptContent = fs.readFileSync(path.join(timesAssetsDir, 'prompt.md'), 'utf8');

  const timelineContent = fs.readFileSync(path.join(overviewsAssetsDir, 'timeline.js'), 'utf8');
  const socialGraphContent = fs.readFileSync(path.join(overviewsAssetsDir, 'social-graph.js'), 'utf8');

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

  // 3. Pre-populate default schema plugins
  writeFile(path.join(absolutePath, 'plugins', 'collections', 'concepts', 'schema.yml'), conceptSchemaContent);
  writeFile(path.join(absolutePath, 'plugins', 'collections', 'concepts', 'summary-schema-extension.yml'), conceptExtensionContent);
  writeFile(path.join(absolutePath, 'plugins', 'collections', 'concepts', 'prompt.md'), conceptPromptContent);

  writeFile(path.join(absolutePath, 'plugins', 'collections', 'persons', 'schema.yml'), personSchemaContent);
  writeFile(path.join(absolutePath, 'plugins', 'collections', 'persons', 'summary-schema-extension.yml'), personExtensionContent);
  writeFile(path.join(absolutePath, 'plugins', 'collections', 'persons', 'prompt.md'), personPromptContent);

  writeFile(path.join(absolutePath, 'plugins', 'collections', 'times', 'schema.yml'), timesSchemaContent);
  writeFile(path.join(absolutePath, 'plugins', 'collections', 'times', 'summary-schema-extension.yml'), timesExtensionContent);
  writeFile(path.join(absolutePath, 'plugins', 'collections', 'times', 'prompt.md'), timesPromptContent);

  // 4. Pre-populate default overview scripts
  writeFile(path.join(absolutePath, 'plugins', 'overviews', 'timeline.js'), timelineContent);
  writeFile(path.join(absolutePath, 'plugins', 'overviews', 'social-graph.js'), socialGraphContent);

  // 5. Pre-populate default base wiki index.md
  const indexFile = path.join(absolutePath, 'wiki', 'index.md');
  const wikiName = path.basename(absolutePath);
  const timestamp = new Date().toISOString().replace(/\.\d{3}Z$/, 'Z');
  const baseIndexContent = indexTemplate
    .replace(/{{WIKI_NAME}}/g, wikiName)
    .replace(/{{TIMESTAMP}}/g, timestamp);
  writeFile(indexFile, baseIndexContent);

  // 6. Copy mycelium logo if available in the project root
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

  // 7. Initialize git repository if not present
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
