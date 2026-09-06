import * as fs from 'fs';
import * as path from 'path';
import { execFileSync } from 'child_process';
import { callOcrModel } from '../utils/openai-api.js';
import { ExtractedAssetContent } from './types.js';

/**
 * Runs OCR on an image file using the configured multimodal LLM.
 */
export async function ocrImage(imgPath: string): Promise<string> {
  const ext = path.extname(imgPath).toLowerCase();
  const format = ext === '.jpg' ? 'jpeg' : ext.slice(1);
  const base64Img = fs.readFileSync(imgPath).toString('base64');

  return await callOcrModel(base64Img, format);
}

/**
 * Processes PDF files using pdftoppm and ocrImage.
 */
export async function processPdf(pdfPath: string, tempDir: string): Promise<string> {
  try {
    fs.mkdirSync(tempDir, { recursive: true });
    execFileSync('pdftoppm', ['-png', '-r', '150', pdfPath, path.join(tempDir, 'page')], { stdio: 'ignore' });
    const pageFiles = fs.readdirSync(tempDir)
      .filter(f => f.startsWith('page-') && f.endsWith('.png'))
      .sort();

    let combinedText = '';
    for (const pageFile of pageFiles) {
      const pagePath = path.join(tempDir, pageFile);
      console.log(`OCRing PDF page: ${pageFile}`);
      const pageText = await ocrImage(pagePath);
      combinedText += pageText + '\n\n';
    }
    return combinedText.trim();
  } catch (e: any) {
    console.warn(`pdftoppm PDF extraction failed or not available for ${pdfPath}. Using fallback placeholder. Error:`, e.message);
    return `[PDF Content Placeholder for ${path.basename(pdfPath)}]`;
  } finally {
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
}

/**
 * Extracts and prepares an asset file from inbox/assets into destination folders.
 */
export async function extractAsset(
  filePath: string,
  destDirs: { processedDir: string; sourcesDir: string; dateToday: string; absoluteWikiRoot: string },
  companionMdPath?: string
): Promise<ExtractedAssetContent> {
  const fileName = path.basename(filePath);
  const ext = path.extname(fileName).toLowerCase();
  const isMd = ext === '.md';
  const baseName = path.basename(fileName, ext);

  let rawTextContent = '';
  let companionMetadataContent = '';
  const referencedAssets: string[] = [];

  if (isMd || ext === '.txt') {
    rawTextContent = fs.readFileSync(filePath, 'utf8');
    const destProcessed = path.join(destDirs.processedDir, fileName);
    fs.copyFileSync(filePath, destProcessed);
    referencedAssets.push(`wiki/assets/${destDirs.dateToday}/processed/${fileName}`);

    if (isMd) {
      const destSource = path.join(destDirs.sourcesDir, fileName);
      fs.copyFileSync(filePath, destSource);
      referencedAssets.push(`wiki/assets/${destDirs.dateToday}/sources/${fileName}`);
    }
  } else {
    const destProcessed = path.join(destDirs.processedDir, fileName);
    fs.copyFileSync(filePath, destProcessed);
    referencedAssets.push(`wiki/assets/${destDirs.dateToday}/processed/${fileName}`);

    let extractedText = '';
    if (['.png', '.jpg', '.jpeg'].includes(ext)) {
      try {
        extractedText = await ocrImage(filePath);
      } catch (e: any) {
        console.error(`OCR failed for image ${fileName}:`, e.message);
        extractedText = `[OCR failed for image ${fileName}]`;
      }
    } else if (ext === '.pdf') {
      const tempPdfDir = path.join(destDirs.absoluteWikiRoot, 'inbox', `temp-pdf-${baseName}`);
      extractedText = await processPdf(filePath, tempPdfDir);
    } else {
      extractedText = `[Audio/Binary transcription placeholder for ${fileName}]`;
    }

    const txtFilename = `${baseName}_transcription.txt`;
    const destSource = path.join(destDirs.sourcesDir, txtFilename);
    fs.writeFileSync(destSource, extractedText, 'utf8');
    rawTextContent = extractedText;
    referencedAssets.push(`wiki/assets/${destDirs.dateToday}/sources/${txtFilename}`);

    if (companionMdPath && fs.existsSync(companionMdPath)) {
      const companionFileName = path.basename(companionMdPath);
      companionMetadataContent = fs.readFileSync(companionMdPath, 'utf8');
      const companionDestProcessed = path.join(destDirs.processedDir, companionFileName);
      const companionDestSource = path.join(destDirs.sourcesDir, companionFileName);
      fs.copyFileSync(companionMdPath, companionDestProcessed);
      fs.copyFileSync(companionMdPath, companionDestSource);
      referencedAssets.push(`wiki/assets/${destDirs.dateToday}/processed/${companionFileName}`);
      referencedAssets.push(`wiki/assets/${destDirs.dateToday}/sources/${companionFileName}`);
    }
  }

  return {
    rawText: rawTextContent,
    companionMetadata: companionMetadataContent || undefined,
    referencedAssets,
  };
}

/**
 * Loads and extracts text & metadata from an already-archived asset folder during resync.
 */
export function extractArchivedAsset(
  fileName: string,
  paths: { processedPath: string; sourcesPath: string; dateFolder: string },
  mdFiles: string[]
): ExtractedAssetContent {
  const ext = path.extname(fileName).toLowerCase();
  const isMd = ext === '.md';
  const baseName = path.basename(fileName, ext);
  const filePath = path.join(paths.processedPath, fileName);

  const referencedAssets: string[] = [`wiki/assets/${paths.dateFolder}/processed/${fileName}`];
  if (isMd && fs.existsSync(path.join(paths.sourcesPath, fileName))) {
    referencedAssets.push(`wiki/assets/${paths.dateFolder}/sources/${fileName}`);
  }

  let rawTextContent = '';
  let companionMetadataContent = '';

  if (isMd || ext === '.txt') {
    rawTextContent = fs.readFileSync(filePath, 'utf8');
  } else {
    const txtFilename = `${baseName}_transcription.txt`;
    const sourceTxtPath = path.join(paths.sourcesPath, txtFilename);
    if (fs.existsSync(sourceTxtPath)) {
      rawTextContent = fs.readFileSync(sourceTxtPath, 'utf8');
      referencedAssets.push(`wiki/assets/${paths.dateFolder}/sources/${txtFilename}`);
    }

    const companionMd = mdFiles.find(mf => path.basename(mf, '.md') === baseName);
    if (companionMd) {
      const companionPath = path.join(paths.processedPath, companionMd);
      if (fs.existsSync(companionPath)) {
        companionMetadataContent = fs.readFileSync(companionPath, 'utf8');
        referencedAssets.push(`wiki/assets/${paths.dateFolder}/processed/${companionMd}`);
      }
    }
  }

  return {
    rawText: rawTextContent,
    companionMetadata: companionMetadataContent || undefined,
    referencedAssets,
  };
}

