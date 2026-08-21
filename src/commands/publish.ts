import * as fs from 'fs';
import * as path from 'path';
import { execSync } from 'child_process';
import YAML from 'yaml';
import { projectRootDir } from '../utils/config.js';
import { getVaultDir } from '../utils/fs-utils.js';
import { rewriteAllMarkdownLinks, extractTagsMapping } from '../core/link-rewriter.js';

const compiledAssetsPath = path.join(projectRootDir, 'build/commands/assets');
const useCompiled = fs.existsSync(compiledAssetsPath);
const assetsBaseDir = useCompiled ? compiledAssetsPath : path.join(projectRootDir, 'src/commands/assets');

/**
 * Publishes the wiki to a static site using MkDocs.
 */
export async function publishWiki(wikiPath: string, targetDirArg?: string): Promise<void> {
  const vaultRoot = getVaultDir(wikiPath);
  const vaultName = path.basename(vaultRoot);
  const wikiDir = path.join(vaultRoot, 'wiki');

  if (!fs.existsSync(wikiDir) || !fs.statSync(wikiDir).isDirectory()) {
    throw new Error(`Wiki directory '${wikiDir}' does not exist.`);
  }

  const distDir = path.resolve(projectRootDir, 'dist');
  const buildDir = path.join(distDir, `build-${vaultName}`);
  const docsDir = path.join(buildDir, 'docs');

  let siteDir = '';
  if (targetDirArg && targetDirArg.trim()) {
    const trimmed = targetDirArg.trim();
    siteDir = path.isAbsolute(trimmed) ? trimmed : path.resolve(vaultRoot, trimmed);
  } else {
    siteDir = path.resolve(vaultRoot, 'dist');
  }

  // 1. Clean and recreate build directory
  if (fs.existsSync(buildDir)) {
    fs.rmSync(buildDir, { recursive: true, force: true });
  }
  fs.mkdirSync(docsDir, { recursive: true });

  // 2. Ensure mkdocs.yml exists in the source config folder
  const sourceConfig = path.join(vaultRoot, 'config', 'mkdocs.yml');
  if (!fs.existsSync(sourceConfig)) {
    throw new Error(`MkDocs configuration not found at ${sourceConfig}. Run init first.`);
  }

  // 3. Copy wiki contents to docsDir
  console.log(`Copying wiki files from ${wikiDir} to ${docsDir}...`);
  const items = fs.readdirSync(wikiDir);
  for (const item of items) {
    const src = path.join(wikiDir, item);
    const dest = path.join(docsDir, item);
    const stat = fs.statSync(src);
    if (stat.isDirectory()) {
      fs.cpSync(src, dest, { recursive: true });
    } else {
      fs.copyFileSync(src, dest);
    }
  }

  // 4. Copy custom collections-cloud & mermaid-zoom assets
  const assetsJsDir = path.join(docsDir, 'assets', 'js');
  const assetsCssDir = path.join(docsDir, 'assets', 'css');
  fs.mkdirSync(assetsJsDir, { recursive: true });
  fs.mkdirSync(assetsCssDir, { recursive: true });

  const assetFilesToCopy = [
    { src: 'publish/collections-cloud/collections-cloud.js', dest: path.join(assetsJsDir, 'collections-cloud.js') },
    { src: 'publish/collections-cloud/collections-cloud.css', dest: path.join(assetsCssDir, 'collections-cloud.css') },
    { src: 'publish/collections-cloud/timeline-filter.js', dest: path.join(assetsJsDir, 'timeline-filter.js') },
    { src: 'publish/collections-cloud/timeline-filter.css', dest: path.join(assetsCssDir, 'timeline-filter.css') },
    { src: 'publish/mermaid-zoom/mermaid-zoom.js', dest: path.join(assetsJsDir, 'mermaid-zoom.js') },
    { src: 'publish/mermaid-zoom/mermaid-zoom.css', dest: path.join(assetsCssDir, 'mermaid-zoom.css') },
  ];

  for (const item of assetFilesToCopy) {
    const fullSrc = path.join(assetsBaseDir, item.src);
    if (fs.existsSync(fullSrc)) {
      fs.copyFileSync(fullSrc, item.dest);
    }
  }

  // 4.1 Copy default logo/icon from config/assets if present, otherwise fall back to project root
  const sourceIcon = path.join(vaultRoot, 'config', 'assets', 'mycelium-mind-icon.png');
  const targetIconDir = path.join(docsDir, 'assets');
  const targetIcon = path.join(targetIconDir, 'mycelium-mind-icon.png');
  if (fs.existsSync(sourceIcon)) {
    fs.mkdirSync(targetIconDir, { recursive: true });
    fs.copyFileSync(sourceIcon, targetIcon);
    console.log('Copied mycelium icon to build docs assets.');
  } else {
    const defaultIcon = path.join(projectRootDir, 'assets', 'mycelium-mind-icon.png');
    if (fs.existsSync(defaultIcon)) {
      fs.mkdirSync(targetIconDir, { recursive: true });
      fs.copyFileSync(defaultIcon, targetIcon);
      console.log('Copied default mycelium icon from project root to build docs assets.');

      const vaultIconDir = path.join(vaultRoot, 'config', 'assets');
      if (!fs.existsSync(vaultIconDir)) {
        fs.mkdirSync(vaultIconDir, { recursive: true });
      }
      fs.copyFileSync(defaultIcon, path.join(vaultIconDir, 'mycelium-mind-icon.png'));
      console.log('Copied default mycelium icon to vault config assets.');
    } else {
      console.warn(`Default mycelium icon not found at ${defaultIcon}`);
    }
  }

  // 5. Update mkdocs.yml with navigation, plugins, and custom extensions
  const buildConfigPath = path.join(buildDir, 'mkdocs.yml');
  let configData: any = {};
  try {
    configData = YAML.parse(fs.readFileSync(sourceConfig, 'utf8'), {
      customTags: [
        {
          tag: 'tag:yaml.org,2002:python/name:pymdownx.superfences.fence_code_format',
          resolve() {
            return '!!python/name:pymdownx.superfences.fence_code_format';
          },
        },
      ],
    }) || {};
  } catch (e: any) {
    console.error(`Error loading YAML: ${e.message}, using default configuration.`);
    configData = {};
  }

  configData.site_name = configData.site_name || `${vaultName} Wiki`;
  configData.docs_dir = 'docs';

  if (!configData.theme) {
    configData.theme = { name: 'material' };
  } else if (typeof configData.theme === 'string') {
    configData.theme = { name: configData.theme };
  }

  if (typeof configData.theme === 'object' && !configData.theme.palette) {
    configData.theme.palette = [
      {
        media: '(prefers-color-scheme: light)',
        scheme: 'default',
        primary: 'indigo',
        accent: 'indigo',
      },
      {
        media: '(prefers-color-scheme: dark)',
        scheme: 'slate',
        primary: 'indigo',
        accent: 'indigo',
      },
    ];
  }

  if (!configData.plugins) {
    configData.plugins = ['search', 'tags'];
  }

  // Cytoscape and Mermaid JS/CSS
  let extraJs = configData.extra_javascript || [];
  if (!Array.isArray(extraJs)) extraJs = [];
  const requiredJs = [
    'https://cdnjs.cloudflare.com/ajax/libs/cytoscape/3.29.2/cytoscape.min.js',
    'assets/js/collections-cloud.js',
    'assets/js/timeline-filter.js',
    'assets/js/mermaid-zoom.js',
  ];
  for (const js of requiredJs) {
    if (!extraJs.includes(js)) extraJs.push(js);
  }
  configData.extra_javascript = extraJs;

  let extraCss = configData.extra_css || [];
  if (!Array.isArray(extraCss)) extraCss = [];
  const requiredCss = [
    'assets/css/collections-cloud.css',
    'assets/css/timeline-filter.css',
    'assets/css/mermaid-zoom.css',
  ];
  for (const css of requiredCss) {
    if (!extraCss.includes(css)) extraCss.push(css);
  }
  configData.extra_css = extraCss;

  // Mermaid SuperFences
  let extensions = configData.markdown_extensions || [];
  if (!Array.isArray(extensions)) extensions = [];
  let superfencesConfigured = false;
  for (let i = 0; i < extensions.length; i++) {
    const ext = extensions[i];
    if (typeof ext === 'string' && ext === 'pymdownx.superfences') {
      superfencesConfigured = true;
      extensions[i] = {
        'pymdownx.superfences': {
          custom_fences: [
            {
              name: 'mermaid',
              class: 'mermaid',
              format: '!!python/name:pymdownx.superfences.fence_code_format',
            },
          ],
        },
      };
      break;
    } else if (typeof ext === 'object' && ext['pymdownx.superfences']) {
      superfencesConfigured = true;
      const superfencesConfig = ext['pymdownx.superfences'] || {};
      const customFences = superfencesConfig.custom_fences || [];
      const hasMermaid = customFences.some((f: any) => typeof f === 'object' && f.name === 'mermaid');
      if (!hasMermaid) {
        customFences.push({
          name: 'mermaid',
          class: 'mermaid',
          format: '!!python/name:pymdownx.superfences.fence_code_format',
        });
        superfencesConfig.custom_fences = customFences;
        ext['pymdownx.superfences'] = superfencesConfig;
      }
      break;
    }
  }
  if (!superfencesConfigured) {
    extensions.push({
      'pymdownx.superfences': {
        custom_fences: [
          {
            name: 'mermaid',
            class: 'mermaid',
            format: '!!python/name:pymdownx.superfences.fence_code_format',
          },
        ],
      },
    });
  }

  function buildNavigation(dir: string, relDir = ''): any[] {
    const dirItems = fs.readdirSync(dir);
    const subDirs: string[] = [];
    const mdFiles: string[] = [];

    for (const item of dirItems) {
      if (item === 'assets' && relDir === '') continue;
      const fullPath = path.join(dir, item);
      const stat = fs.statSync(fullPath);
      if (stat.isDirectory()) {
        subDirs.push(item);
      } else if (item.endsWith('.md')) {
        mdFiles.push(item);
      }
    }

    subDirs.sort((a, b) => a.localeCompare(b, undefined, { sensitivity: 'base', numeric: true }));
    mdFiles.sort((a, b) => a.localeCompare(b, undefined, { sensitivity: 'base', numeric: true }));

    const orderedFiles: string[] = [];
    if (mdFiles.includes('index.md')) {
      orderedFiles.push('index.md');
    }
    const folderName = path.basename(dir);
    const cloudFilename = `${folderName}-cloud.md`;
    for (const file of mdFiles) {
      if (
        file === 'index.md' ||
        file === cloudFilename ||
        (folderName === 'overviews' && file.endsWith('-graphic.md'))
      ) continue;
      orderedFiles.push(file);
    }

    const navEntries: any[] = [];
    for (const file of orderedFiles) {
      const relPath = path.join(relDir, file).replace(/\\/g, '/');
      navEntries.push(relPath);
    }

    for (const subDir of subDirs) {
      const subDirPath = path.join(dir, subDir);
      const subRelDir = path.join(relDir, subDir).replace(/\\/g, '/');
      const subNav = buildNavigation(subDirPath, subRelDir);
      if (subNav && subNav.length > 0) {
        const sectionName = subDir.charAt(0).toUpperCase() + subDir.slice(1);
        navEntries.push({ [sectionName]: subNav });
      }
    }

    return navEntries;
  }

  configData.markdown_extensions = extensions;
  configData.nav = buildNavigation(docsDir);

  let yamlStr = YAML.stringify(configData);
  yamlStr = yamlStr.replace(/['"]!!python\/name:([^'"]+)['"]/g, '!!python/name:$1');
  fs.writeFileSync(buildConfigPath, yamlStr, 'utf8');

  // 6. Rewrite links in copied Markdown files using modular link rewriter
  rewriteAllMarkdownLinks(docsDir);

  // 7. Generate tags.json mapping
  console.log('Generating tags.json metadata mapping...');
  const tagsMapping = extractTagsMapping(docsDir);
  const tagsJsonPath = path.join(docsDir, 'tags.json');
  fs.writeFileSync(tagsJsonPath, JSON.stringify({ mappings: tagsMapping }, null, 2), 'utf8');

  // 8. Run MkDocs build
  let venvMkdocs = path.resolve(projectRootDir, '.venv', 'bin', 'mkdocs');
  if (!fs.existsSync(venvMkdocs)) {
    venvMkdocs = 'mkdocs';
  }

  console.log(`Building static site to: ${siteDir}`);
  try {
    execSync(`"${venvMkdocs}" build -f "${buildConfigPath}" -d "${siteDir}"`, { stdio: 'inherit' });
    console.log(`Success! Site published at ${siteDir}`);
  } catch (e: any) {
    console.error('Error building MkDocs site:', e.message);
    throw e;
  } finally {
    if (fs.existsSync(buildDir)) {
      fs.rmSync(buildDir, { recursive: true, force: true });
    }
  }
}
