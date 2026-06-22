import { argv, exit } from 'process';
import * as fs from 'fs';
import * as path from 'path';
import matter from 'gray-matter';
import YAML from 'yaml';
import { config, projectRootDir } from '../utils/config.js';
import { getVaultDir, getVaultWikiDir, toSafeFilename, cleanMarkdownResponse, rebuildFolderIndex } from '../utils/utils.js';
import { callAgenticModel } from '../utils/llm.js';

const vaultName = argv[2] || config.vaultName;
if (!vaultName) {
  console.error("Usage: npx tsx scripts/src/summaries/summaries.ts <VaultName|Path>");
  exit(1);
}

const vaultDir = getVaultDir(vaultName);
const wikiDir = getVaultWikiDir(vaultName);
const inboxDir = path.join(vaultDir, 'inbox');
const assetDirParent = path.join(wikiDir, 'assets');
const dateToday = new Date().toISOString().split('T')[0];
const assetDir = path.join(assetDirParent, dateToday);

(async () => {
  if (!fs.existsSync(inboxDir)) {
    console.log(JSON.stringify({ processed: [] }));
    return;
  }

  const inboxFiles = fs.readdirSync(inboxDir).filter(file => {
    const ext = path.extname(file).toLowerCase();
    const isTarget = ['.md', '.txt'].includes(ext);
    const isDotFile = file.startsWith('.');
    const isFile = fs.statSync(path.join(inboxDir, file)).isFile();
    return isTarget && !isDotFile && isFile;
  });

  const processedResults: any[] = [];

  if (inboxFiles.length > 0) {
    const promptsDir = path.join(projectRootDir, 'scripts', 'prompts');
    const summaryPromptTemplate = fs.readFileSync(path.join(promptsDir, 'summary.md'), 'utf8');
    const schemaPath = path.join(vaultDir, 'schemas', 'summary.md');
    const schemaContent = fs.existsSync(schemaPath) ? fs.readFileSync(schemaPath, 'utf8') : '';
    const summaryPromptWithSchema = summaryPromptTemplate.replace('$SCHEMA', schemaContent);

    for (const filename of inboxFiles) {
      const filePath = path.join(inboxDir, filename);
      const fileContent = fs.readFileSync(filePath, 'utf8');

      const prompt = summaryPromptWithSchema.replace('$DOCUMENT_CONTENT', fileContent);
      let summaryText = '';
      try {
        summaryText = await callAgenticModel([{ role: 'user', content: prompt }]);
        summaryText = cleanMarkdownResponse(summaryText);
      } catch (e: any) {
        console.error(`Failed to generate summary for ${filename}:`, e.message);
        continue;
      }

      let frontmatter: any = {};
      let bodyContent = summaryText;
      if (summaryText.startsWith('---')) {
        const parts = summaryText.split('---');
        if (parts.length >= 3) {
          try {
            frontmatter = YAML.parse(parts[1]) || {};
          } catch (e: any) {
            console.error("Failed to parse summary frontmatter YAML:", e.message);
          }
          bodyContent = parts.slice(2).join('---');
        }
      }

      const title = frontmatter.title || path.basename(filename, path.extname(filename));
      const summaryFilename = toSafeFilename(title);
      const summaryPath = path.join(wikiDir, 'summaries', summaryFilename);

      // Archive PDF if derived from PDF, otherwise archive text/md file
      const ext = path.extname(filename);
      let originalFilePath = filePath;
      if (ext.toLowerCase() === '.md') {
        const baseName = path.basename(filename, '.md');
        const pdfPath = path.join(inboxDir, baseName + '.pdf');
        if (fs.existsSync(pdfPath) && fs.statSync(pdfPath).isFile()) {
          originalFilePath = pdfPath;
        }
      }

      let resourcePath = '';
      if (fs.existsSync(originalFilePath) && fs.statSync(originalFilePath).isFile()) {
        fs.mkdirSync(assetDir, { recursive: true });
        const destPath = path.join(assetDir, path.basename(originalFilePath));
        fs.copyFileSync(originalFilePath, destPath);
        resourcePath = `assets/${dateToday}/${path.basename(originalFilePath)}`;
      }

      const timestamp = new Date().toISOString().replace(/\.\d{3}Z$/, 'Z');
      if (resourcePath) {
        frontmatter.resource = resourcePath;
      }
      frontmatter.timestamp = timestamp;

      const updatedFrontmatter = YAML.stringify(frontmatter);
      const finalSummaryContent = `---\n${updatedFrontmatter}---\n${bodyContent}`;
      fs.writeFileSync(summaryPath, finalSummaryContent, 'utf8');

      // Clean up temporary md inbox file, leave PDF in inbox
      const isPdf = path.extname(filePath).toLowerCase() === '.pdf';
      if (!isPdf) {
        fs.unlinkSync(filePath);
      }

      processedResults.push({
        summaryPath,
        summaryFilename,
        frontmatter
      });
    }
  }

  // Rebuild the summaries folder index
  rebuildFolderIndex(wikiDir, 'summaries', 'Summaries');

  // Output JSON formatted list of processed summaries to stdout for orchestrator parsing
  console.log(JSON.stringify({ processed: processedResults }));
})();
