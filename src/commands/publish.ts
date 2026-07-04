import * as fs from 'fs';
import * as path from 'path';
import { execSync } from 'child_process';
import YAML from 'yaml';
import { projectRootDir } from '../utils/config.js';
import { getVaultDir } from '../utils/fs-utils.js';

// Regex patterns
const wikilinkRe = /\[\[([^\]]+)\]\]/g;
const stdLinkRe = /\[([^\]]+)\]\(((?!(?:https?:\/\/|mailto:))[^)]+?\.md)(#[^)]*)?\)/g;

/**
 * Publishes the wiki to a static site using MkDocs.
 */
const compiledAssetsPath = path.join(projectRootDir, 'build/commands/assets');
const useCompiled = fs.existsSync(compiledAssetsPath);
const assetsBaseDir = useCompiled ? compiledAssetsPath : path.join(projectRootDir, 'src/commands/assets');
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

  // 4. Copy custom collections-cloud Cytoscape assets
  const assetsJsDir = path.join(docsDir, 'assets', 'js');
  const assetsCssDir = path.join(docsDir, 'assets', 'css');
  fs.mkdirSync(assetsJsDir, { recursive: true });
  fs.mkdirSync(assetsCssDir, { recursive: true });

  const srcJs = path.join(assetsBaseDir, 'publish/collections-cloud/collections-cloud.js');
  const srcCss = path.join(assetsBaseDir, 'publish/collections-cloud/collections-cloud.css');
  
  if (fs.existsSync(srcJs)) {
    fs.copyFileSync(srcJs, path.join(assetsJsDir, 'collections-cloud.js'));
  }
  if (fs.existsSync(srcCss)) {
    fs.copyFileSync(srcCss, path.join(assetsCssDir, 'collections-cloud.css'));
  }

  // 4.05 Copy custom mermaid-zoom assets
  const zoomJs = path.join(assetsBaseDir, 'publish/mermaid-zoom/mermaid-zoom.js');
  const zoomCss = path.join(assetsBaseDir, 'publish/mermaid-zoom/mermaid-zoom.css');
  
  console.log('DEBUG [publish.ts]: zoomJs path =', zoomJs);
  console.log('DEBUG [publish.ts]: zoomJs exists in src =', fs.existsSync(zoomJs));
  console.log('DEBUG [publish.ts]: zoomCss path =', zoomCss);
  console.log('DEBUG [publish.ts]: zoomCss exists in src =', fs.existsSync(zoomCss));

  if (fs.existsSync(zoomJs)) {
    const destJs = path.join(assetsJsDir, 'mermaid-zoom.js');
    fs.copyFileSync(zoomJs, destJs);
    console.log('DEBUG [publish.ts]: Copied JS to', destJs, 'Exists now =', fs.existsSync(destJs));
  } else {
    console.log('DEBUG [publish.ts]: zoomJs NOT FOUND');
  }
  if (fs.existsSync(zoomCss)) {
    const destCss = path.join(assetsCssDir, 'mermaid-zoom.css');
    fs.copyFileSync(zoomCss, destCss);
    console.log('DEBUG [publish.ts]: Copied CSS to', destCss, 'Exists now =', fs.existsSync(destCss));
  } else {
    console.log('DEBUG [publish.ts]: zoomCss NOT FOUND');
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
      // Copy to build docs assets
      fs.mkdirSync(targetIconDir, { recursive: true });
      fs.copyFileSync(defaultIcon, targetIcon);
      console.log('Copied default mycelium icon from project root to build docs assets.');

      // Also copy to vault's config/assets to make it self-contained
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

  // 5. Ensure mkdocs.yml is updated with Cytoscape assets and formatting
  const buildConfigPath = path.join(buildDir, 'mkdocs.yml');
  let configData: any = {};
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
    console.error(`Error loading YAML: ${e.message}, using default configuration.`);
    configData = {};
  }

  // Normalizations and insertions
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
        media: "(prefers-color-scheme: light)",
        scheme: "default",
        primary: "indigo",
        accent: "indigo",
      },
      {
        media: "(prefers-color-scheme: dark)",
        scheme: "slate",
        primary: "indigo",
        accent: "indigo",
      }
    ];
  }

  // Plugins
  if (!configData.plugins) {
    configData.plugins = ['search', 'tags'];
  }

  // Cytoscape CSS/JS
  let extraJs = configData.extra_javascript || [];
  if (!Array.isArray(extraJs)) extraJs = [];
  const cytoscapeCdn = 'https://cdnjs.cloudflare.com/ajax/libs/cytoscape/3.29.2/cytoscape.min.js';
  if (!extraJs.includes(cytoscapeCdn)) extraJs.push(cytoscapeCdn);
  const customJs = 'assets/js/collections-cloud.js';
  if (!extraJs.includes(customJs)) extraJs.push(customJs);
  const zoomJsAsset = 'assets/js/mermaid-zoom.js';
  if (!extraJs.includes(zoomJsAsset)) extraJs.push(zoomJsAsset);
  configData.extra_javascript = extraJs;

  let extraCss = configData.extra_css || [];
  if (!Array.isArray(extraCss)) extraCss = [];
  const customCss = 'assets/css/collections-cloud.css';
  if (!extraCss.includes(customCss)) extraCss.push(customCss);
  const zoomCssAsset = 'assets/css/mermaid-zoom.css';
  if (!extraCss.includes(zoomCssAsset)) extraCss.push(zoomCssAsset);
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
      const hasMermaid = customFences.some((f: any) => typeof f === 'object' && f.name === 'mermaid');
      if (!hasMermaid) {
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
  // Helper function to build dynamic navigation
  function buildNavigation(dir: string, relDir = ''): any[] {
    const items = fs.readdirSync(dir);
    const subDirs: string[] = [];
    const mdFiles: string[] = [];

    for (const item of items) {
      if (item === 'assets' && relDir === '') continue; // Skip assets folder at root
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
      if (file === 'index.md' || file === cloudFilename) continue;
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

  // 6. Build file name-to-path index for fuzzy link rewriting
  const fileMap: Record<string, string> = {};
  function walkDocs(dir: string) {
    const files = fs.readdirSync(dir);
    for (const file of files) {
      const fullPath = path.join(dir, file);
      const stat = fs.statSync(fullPath);
      if (stat.isDirectory()) {
        walkDocs(fullPath);
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
  walkDocs(docsDir);

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

  // 7. Rewrite links in copied Markdown files
  function processFile(filePath: string) {
    const currentDirAbs = path.dirname(filePath);
    let content = fs.readFileSync(filePath, 'utf8');

    let newContent = content.replace(wikilinkRe, (match, linkContent) => {
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
          if (!label) label = targetClean.slice(1);
          return `[${label.trim()}](${targetClean})`;
        }
        return label ? label.trim() : targetClean;
      }
    });

    newContent = newContent.replace(stdLinkRe, (match, label, pathPart, anchorPart = '') => {
      let cleanedPath = pathPart;
      if (cleanedPath.startsWith('wiki/')) {
        cleanedPath = cleanedPath.slice(5);
      } else if (cleanedPath.startsWith('./wiki/')) {
        cleanedPath = cleanedPath.slice(7);
      }

      let pathRelativeToDocs = cleanedPath;
      if (cleanedPath.startsWith('.')) {
        const currentFileDirFromDocs = path.relative(docsDir, currentDirAbs);
        pathRelativeToDocs = path.join(currentFileDirFromDocs, cleanedPath);
      }
      const relPathNoExt = pathRelativeToDocs.endsWith('.md') ? pathRelativeToDocs.slice(0, -3) : pathRelativeToDocs;
      const relPathLower = relPathNoExt.toLowerCase().replace(/\\/g, '/');
      let targetRelPath = findFuzzyMatch(relPathLower);

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

  function processAllMarkdown(dir: string) {
    const files = fs.readdirSync(dir);
    for (const file of files) {
      const fullPath = path.join(dir, file);
      const stat = fs.statSync(fullPath);
      if (stat.isDirectory()) {
        processAllMarkdown(fullPath);
      } else if (file.endsWith('.md')) {
        processFile(fullPath);
      }
    }
  }
  processAllMarkdown(docsDir);
  // 7b. Generate tags.json mapping all files and their tags
  console.log('Generating tags.json metadata mapping...');
  const tagsMapping: any[] = [];
  function gatherTags(dir: string) {
    const files = fs.readdirSync(dir);
    for (const file of files) {
      const fullPath = path.join(dir, file);
      const stat = fs.statSync(fullPath);
      if (stat.isDirectory()) {
        gatherTags(fullPath);
      } else if (file.endsWith('.md')) {
        try {
          const content = fs.readFileSync(fullPath, 'utf8');
          const fmMatch = content.match(/^---\r?\n([\s\S]+?)\r?\n---/);
          if (fmMatch) {
            const fmData = YAML.parse(fmMatch[1]) || {};
            const rawTags = fmData.tags || [];
            const tags = (Array.isArray(rawTags) ? rawTags : [rawTags])
              .map((t: any) => String(t).trim().toLowerCase())
              .filter((t: string) => t.length > 0);

            if (tags.length > 0) {
              const relPath = path.relative(docsDir, fullPath);
              const urlPath = relPath.replace(/\.md$/, '.html').replace(/\\/g, '/');
              tagsMapping.push({
                item: {
                  title: fmData.title || path.basename(file, '.md'),
                  url: urlPath
                },
                tags: tags
              });
            }
          }
        } catch (e: any) {
          console.warn(`Failed to read tags from ${file}: ${e.message}`);
        }
      }
    }
  }
  gatherTags(docsDir);
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
