import { argv, exit } from 'process';
import * as fs from 'fs';
import * as path from 'path';
import { execSync } from 'child_process';
import YAML from 'yaml';
import { config } from '../utils/config.js';
import { getVaultDir } from '../utils/utils.js';

const vaultNameOrPath = argv[2];
const targetDirArg = argv[3];
const projectRoot = process.cwd();

function getVaultsToPublish(requestedVault?: string): string[] {
  const normalized = requestedVault?.trim();
  if (normalized && !['all', 'ALL', '*'].includes(normalized)) {
    return [normalized];
  }

  const vaultsRoot = path.resolve(projectRoot, config.vaultsRoot);
  if (!fs.existsSync(vaultsRoot) || !fs.statSync(vaultsRoot).isDirectory()) {
    return [];
  }

  return fs.readdirSync(vaultsRoot, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => path.join(vaultsRoot, entry.name))
    .filter((vaultRoot) => fs.existsSync(path.join(vaultRoot, 'wiki')));
}

function publishVault(vaultNameOrPath: string, targetDirArg?: string) {
  const vaultRoot = getVaultDir(vaultNameOrPath);
  const vaultName = path.basename(vaultRoot);
  const vaultDir = path.join(vaultRoot, 'wiki');

  if (!fs.existsSync(vaultDir) || !fs.statSync(vaultDir).isDirectory()) {
    console.error(`Error: Vault directory '${vaultDir}' does not exist.`);
    exit(1);
  }

  const distDir = path.resolve(projectRoot, 'dist');
  const buildDir = path.join(distDir, `build-${vaultName}`);
  const docsDir = path.join(buildDir, 'docs');

  let siteDir = '';
  if (targetDirArg && targetDirArg.trim()) {
    const trimmed = targetDirArg.trim();
    siteDir = path.isAbsolute(trimmed) ? trimmed : path.resolve(projectRoot, trimmed);
  } else {
    siteDir = path.resolve(distDir, vaultName);
  }

  // 2. Clean and recreate build directory
  if (fs.existsSync(buildDir)) {
    fs.rmSync(buildDir, { recursive: true, force: true });
  }
  fs.mkdirSync(docsDir, { recursive: true });

  // 3. Ensure mkdocs.yml exists in the source vault directory
  const sourceConfig = path.join(vaultRoot, 'mkdocs.yml');
  if (!fs.existsSync(sourceConfig)) {
    console.log(`Writing default config to ${sourceConfig}...`);
    
    // Ensure icon is copied to source vault's assets directory
    const sourceAssetsDir = path.join(vaultDir, 'assets');
    fs.mkdirSync(sourceAssetsDir, { recursive: true });
    const projectIconPath = path.resolve(projectRoot, 'assets', 'mycelium-mind-icon.png');
    if (fs.existsSync(projectIconPath)) {
      fs.copyFileSync(projectIconPath, path.join(sourceAssetsDir, 'mycelium-mind-icon.png'));
      console.log(`Copied default icon to ${sourceAssetsDir}`);
    }

    const defaultConfigContent = `site_name: ${vaultName} Wiki
theme:
  name: material
  favicon: assets/mycelium-mind-icon.png
  logo: assets/mycelium-mind-icon.png
  palette:
    - media: "(prefers-color-scheme: light)"
      scheme: default
      primary: indigo
      accent: indigo
      toggle:
        icon: material/brightness-7
        name: Switch to dark mode
    - media: "(prefers-color-scheme: dark)"
      scheme: slate
      primary: indigo
      accent: indigo
      toggle:
        icon: material/brightness-4
        name: Switch to light mode
use_directory_urls: false
plugins:
  - search
  - panzoom
  - tags
markdown_extensions:
  - pymdownx.superfences:
      custom_fences:
        - name: mermaid
          class: mermaid
          format: !!python/name:pymdownx.superfences.fence_code_format
`;
    fs.writeFileSync(sourceConfig, defaultConfigContent, 'utf8');
  }

  // 4. Copy wiki contents to docs_dir
  console.log(`Copying wiki files from ${vaultDir} to ${docsDir}...`);
  const items = fs.readdirSync(vaultDir);
  for (const item of items) {
    const src = path.join(vaultDir, item);
    const dest = path.join(docsDir, item);
    if (item === 'mkdocs.yml') {
      fs.copyFileSync(src, path.join(buildDir, 'mkdocs.yml'));
      continue;
    }
    const stat = fs.statSync(src);
    if (stat.isDirectory()) {
      fs.cpSync(src, dest, { recursive: true });
    } else {
      fs.copyFileSync(src, dest);
    }
  }

  // Copy custom concepts-cloud Cytoscape assets
  const assetsJsDir = path.join(docsDir, 'assets', 'js');
  const assetsCssDir = path.join(docsDir, 'assets', 'css');
  fs.mkdirSync(assetsJsDir, { recursive: true });
  fs.mkdirSync(assetsCssDir, { recursive: true });

  const srcJs = path.resolve(projectRoot, 'scripts/src/publish/assets/concepts-cloud.js');
  const srcCss = path.resolve(projectRoot, 'scripts/src/publish/assets/concepts-cloud.css');
  if (fs.existsSync(srcJs)) {
    fs.copyFileSync(srcJs, path.join(assetsJsDir, 'concepts-cloud.js'));
    console.log(`Copied concepts-cloud.js to ${assetsJsDir}`);
  }
  if (fs.existsSync(srcCss)) {
    fs.copyFileSync(srcCss, path.join(assetsCssDir, 'concepts-cloud.css'));
    console.log(`Copied concepts-cloud.css to ${assetsCssDir}`);
  }

// Ensure mkdocs.yml exists in the build dir with correct settings
const buildConfigPath = path.join(buildDir, 'mkdocs.yml');
let configData: any = {};
if (fs.existsSync(sourceConfig)) {
  console.log(`Loading config from ${sourceConfig}...`);
  try {
    configData = YAML.parse(fs.readFileSync(sourceConfig, 'utf8'), {
      customTags: [
        {
          tag: 'tag:yaml.org,2002:python/name:pymdownx.superfences.fence_code_format',
          resolve() {
            return '!!python/name:pymdownx.superfences.fence_code_format';
          }
        }
      ]
    }) || {};
  } catch (e: any) {
    console.error(`Error loading YAML: ${e.message}, falling back to default configuration.`);
    configData = {};
  }
}

// Update or add required config keys
if (!configData.site_name) {
  configData.site_name = `${vaultName} Wiki`;
}

if (!configData.theme) {
  configData.theme = { name: 'material' };
} else if (typeof configData.theme === 'string') {
  configData.theme = { name: configData.theme };
} else if (typeof configData.theme === 'object' && !configData.theme.name) {
  configData.theme.name = 'material';
}

if (typeof configData.theme === 'object' && !configData.theme.palette) {
  configData.theme.palette = [
    {
      media: "(prefers-color-scheme: light)",
      scheme: "default",
      primary: "indigo",
      accent: "indigo",
      toggle: {
        icon: "material/brightness-7",
        name: "Switch to dark mode"
      }
    },
    {
      media: "(prefers-color-scheme: dark)",
      scheme: "slate",
      primary: "indigo",
      accent: "indigo",
      toggle: {
        icon: "material/brightness-4",
        name: "Switch to light mode"
      }
    }
  ];
}

if (!configData.plugins) {
  configData.plugins = ['search', 'panzoom', 'tags'];
} else if (Array.isArray(configData.plugins)) {
  if (!configData.plugins.includes('panzoom')) {
    configData.plugins.push('panzoom');
  }
  const hasTags = configData.plugins.some((p: any) => {
    if (typeof p === 'string' && p === 'tags') return true;
    if (typeof p === 'object' && p !== null && p.tags !== undefined) return true;
    return false;
  });
  if (!hasTags) {
    configData.plugins.push('tags');
  }
}

if (configData.use_directory_urls === undefined) {
  configData.use_directory_urls = false;
}

// Ensure extra_javascript contains Cytoscape CDN and assets/js/concepts-cloud.js
let extraJs = configData.extra_javascript || [];
if (!Array.isArray(extraJs)) {
  extraJs = [];
}
const cytoscapeCdn = 'https://cdnjs.cloudflare.com/ajax/libs/cytoscape/3.29.2/cytoscape.min.js';
if (!extraJs.includes(cytoscapeCdn)) {
  extraJs.push(cytoscapeCdn);
}
const customJs = 'assets/js/concepts-cloud.js';
if (!extraJs.includes(customJs)) {
  extraJs.push(customJs);
}
configData.extra_javascript = extraJs;

// Ensure extra_css contains assets/css/concepts-cloud.css
let extraCss = configData.extra_css || [];
if (!Array.isArray(extraCss)) {
  extraCss = [];
}
const customCss = 'assets/css/concepts-cloud.css';
if (!extraCss.includes(customCss)) {
  extraCss.push(customCss);
}
configData.extra_css = extraCss;

// Force Mermaid support configuration
let extensions = configData.markdown_extensions || [];
if (!Array.isArray(extensions)) {
  extensions = [];
}

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
            format: '!!python/name:pymdownx.superfences.fence_code_format'
          }
        ]
      }
    };
    break;
  } else if (typeof ext === 'object' && ext['pymdownx.superfences']) {
    superfencesConfigured = true;
    const superfencesConfig = ext['pymdownx.superfences'] || {};
    const customFences = superfencesConfig.custom_fences || [];
    
    let mermaidConfigured = false;
    for (const fence of customFences) {
      if (typeof fence === 'object' && fence.name === 'mermaid') {
        mermaidConfigured = true;
        break;
      }
    }
    
    if (!mermaidConfigured) {
      customFences.push({
        name: 'mermaid',
        class: 'mermaid',
        format: '!!python/name:pymdownx.superfences.fence_code_format'
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
          format: '!!python/name:pymdownx.superfences.fence_code_format'
        }
      ]
    }
  });
}

configData.markdown_extensions = extensions;

// Dump config and replace quoted YAML tags so MkDocs parses them correctly
let yamlStr = YAML.stringify(configData);
yamlStr = yamlStr.replace(/['"]!!python\/name:([^'"]+)['"]/g, '!!python/name:$1');

fs.writeFileSync(buildConfigPath, yamlStr, 'utf8');

// Ensure tags.md exists if tags plugin is configured
const hasTagsPlugin = Array.isArray(configData.plugins) && configData.plugins.some((p: any) => {
  if (typeof p === 'string' && p === 'tags') return true;
  if (typeof p === 'object' && p !== null && p.tags !== undefined) return true;
  return false;
});

if (hasTagsPlugin) {
  let tagsFileName = 'tags.md';
  for (const p of configData.plugins) {
    if (typeof p === 'object' && p !== null && p.tags && p.tags.tags_file) {
      tagsFileName = p.tags.tags_file;
      break;
    }
  }
  const tagsFilePath = path.join(docsDir, tagsFileName);
  if (!fs.existsSync(tagsFilePath)) {
    console.log(`Auto-creating tags file at ${tagsFilePath}...`);
    fs.writeFileSync(tagsFilePath, `# Tags\n\n<!-- material/tags -->\n`, 'utf8');
  }
  const sourceTagsFilePath = path.join(vaultRoot, tagsFileName);
  if (!fs.existsSync(sourceTagsFilePath)) {
    console.log(`Auto-creating source tags file at ${sourceTagsFilePath}...`);
    fs.writeFileSync(sourceTagsFilePath, `# Tags\n\n<!-- material/tags -->\n`, 'utf8');
  }
}

// 5. Build filename-to-relative-path map (case-insensitive)
const fileMap: { [key: string]: string } = {};

function walkDir(currentDir: string) {
  const files = fs.readdirSync(currentDir);
  for (const file of files) {
    const fullPath = path.join(currentDir, file);
    const stat = fs.statSync(fullPath);
    if (stat.isDirectory()) {
      walkDir(fullPath);
    } else if (file.endsWith('.md')) {
      const relPath = path.relative(docsDir, fullPath);
      const relPathNorm = relPath.replace(/\\/g, '/');
      const basename = path.basename(file, '.md');
      const basenameLower = basename.toLowerCase();

      if (basenameLower === 'index') {
        if (relPathNorm === 'index.md') {
          fileMap[basenameLower] = relPath;
        }
        const parentDir = path.dirname(relPathNorm);
        if (parentDir !== '.') {
          fileMap[parentDir.toLowerCase()] = relPath;
          fileMap[`${parentDir}/index`.toLowerCase()] = relPath;
        }
      } else {
        fileMap[basenameLower] = relPath;
        const relPathNoExt = relPathNorm.slice(0, -3);
        fileMap[relPathNoExt.toLowerCase()] = relPath;
      }
    }
  }
}
walkDir(docsDir);

console.log(`Indexed ${Object.keys(fileMap).length} markdown files.`);

function findFuzzyMatch(targetLower: string): string | null {
  if (!targetLower) return null;
  if (fileMap[targetLower]) return fileMap[targetLower];
  const keys = Object.keys(fileMap).sort((a, b) => b.length - a.length);
  for (const k of keys) {
    if (k.length >= 3 && targetLower.length >= 3) {
      if (targetLower.startsWith(k) || k.startsWith(targetLower)) {
        return fileMap[k];
      }
    }
  }
  return null;
}

// Regex patterns
const wikilinkRe = /\[\[([^\]]+)\]\]/g;
const stdLinkRe = /\[([^\]]+)\]\(((?!(?:https?:\/\/|mailto:))[^)]+?\.md)(#[^)]*)?\)/g;

function processFile(filePath: string) {
  const currentDirAbs = path.dirname(filePath);
  let content = fs.readFileSync(filePath, 'utf8');

  let newContent = content.replace(wikilinkRe, (match: string, linkContent: string) => {
    let targetPart = '';
    let label = '';
    if (linkContent.includes('|')) {
      const parts = linkContent.split('|');
      targetPart = parts[0];
      label = parts[1];
    } else {
      targetPart = linkContent;
    }

    let target = '';
    let anchorPart = '';
    if (targetPart.includes('#')) {
      const parts = targetPart.split('#');
      target = parts[0];
      anchorPart = `#${parts[1]}`;
    } else {
      target = targetPart;
    }

    const targetClean = target.trim();
    const targetLower = targetClean.toLowerCase();

    const targetRelPath = findFuzzyMatch(targetLower);
    if (targetRelPath) {
      const targetAbsPath = path.join(docsDir, targetRelPath);
      const relPath = path.relative(currentDirAbs, targetAbsPath);
      const urlPath = relPath.replace(/\\/g, '/');

      if (!label) {
        label = anchorPart ? `${targetClean} > ${anchorPart.slice(1)}` : targetClean;
      }

      return `[${label.trim()}](${urlPath}${anchorPart})`;
    } else {
      if (targetClean.startsWith('#')) {
        if (!label) {
          label = targetClean.slice(1);
        }
        return `[${label.trim()}](${targetClean})`;
      }
      return label ? label.trim() : targetClean;
    }
  });

  newContent = newContent.replace(stdLinkRe, (match: string, label: string, pathPart: string, anchorPart: string = '') => {
    let cleanedPath = pathPart;
    if (cleanedPath.startsWith('wiki/')) {
      cleanedPath = cleanedPath.slice(5);
    } else if (cleanedPath.startsWith('./wiki/')) {
      cleanedPath = cleanedPath.slice(7);
    }

    // Try to resolve path relative to docsDir to perform a precise lookup
    let pathRelativeToDocs = cleanedPath;
    if (cleanedPath.startsWith('.')) {
      const currentFileDirFromDocs = path.relative(docsDir, currentDirAbs);
      pathRelativeToDocs = path.join(currentFileDirFromDocs, cleanedPath);
    }
    const relPathNoExt = pathRelativeToDocs.endsWith('.md') ? pathRelativeToDocs.slice(0, -3) : pathRelativeToDocs;
    const relPathLower = relPathNoExt.toLowerCase().replace(/\\/g, '/');

    let targetRelPath = findFuzzyMatch(relPathLower);

    // Fall back to basename lookup if not found
    if (!targetRelPath) {
      const baseNameWithExt = path.basename(cleanedPath);
      const baseNameNoExt = path.basename(baseNameWithExt, '.md');
      const baseNameLower = baseNameNoExt.toLowerCase();
      targetRelPath = findFuzzyMatch(baseNameLower);
    }

    if (targetRelPath) {
      const targetAbsPath = path.join(docsDir, targetRelPath);
      const relPath = path.relative(currentDirAbs, targetAbsPath);
      const normalizedPath = relPath.replace(/\\/g, '/');
      return `[${label}](${normalizedPath}${anchorPart})`;
    } else {
      return label;
    }
  });

  if (newContent !== content) {
    fs.writeFileSync(filePath, newContent, 'utf8');
  }
}

function processAllFiles(currentDir: string) {
  const files = fs.readdirSync(currentDir);
  for (const file of files) {
    const fullPath = path.join(currentDir, file);
    const stat = fs.statSync(fullPath);
    if (stat.isDirectory()) {
      processAllFiles(fullPath);
    } else if (file.endsWith('.md')) {
      processFile(fullPath);
    }
  }
}

processAllFiles(docsDir);
console.log("Link preprocessing completed successfully.");

// 6. Run mkdocs build
let venvMkdocs = path.resolve(projectRoot, '.venv', 'bin', 'mkdocs');
if (!fs.existsSync(venvMkdocs)) {
  venvMkdocs = 'mkdocs';
}

console.log("Building static site with MkDocs Material...");
try {
  execSync(`"${venvMkdocs}" build -f "${buildConfigPath}" -d "${siteDir}"`, { stdio: 'inherit' });
  console.log(`Success! Wiki '${vaultName}' rendered to ${siteDir}`);
} catch (e: any) {
  console.error("Error building MkDocs site:", e.message);
  exit(1);
} finally {
  if (fs.existsSync(buildDir)) {
    fs.rmSync(buildDir, { recursive: true, force: true });
  }
}
}

const vaultsToPublish = getVaultsToPublish(vaultNameOrPath);
if (vaultsToPublish.length === 0) {
  console.error("No vaults found to publish. Ensure the Vaults directory contains vault folders with a wiki/ directory.");
  exit(1);
}

for (const vaultPath of vaultsToPublish) {
  publishVault(vaultPath, targetDirArg);
}
