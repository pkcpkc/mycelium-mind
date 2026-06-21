import { argv, exit } from 'process';
import * as fs from 'fs';
import * as path from 'path';
import { execSync } from 'child_process';
import { updateStatus, cleanStatus } from '../status-helper.ts';

console.log("\n--- OCR Analysis ---");

// Load Environment Variables
const envPath = path.resolve(process.cwd(), '.env');
if (!fs.existsSync(envPath)) {
  console.error("Error: .env not found.");
  exit(1);
}
const envContent = fs.readFileSync(envPath, 'utf8');
for (const line of envContent.split('\n')) {
  const trimmed = line.trim();
  if (!trimmed || trimmed.startsWith('#')) continue;
  const parts = trimmed.split('=');
  const key = parts[0].trim();
  const value = parts.slice(1).join('=').trim().replace(/^['"]|['"]$/g, '');
  process.env[key] = value;
}

const ocrModelName = process.env.OCR_MODEL_NAME;
const apiUrl = process.env.API_URL;
const apiKey = process.env.API_KEY;

if (!ocrModelName || !apiUrl || !apiKey) {
  console.error("Error: OCR_MODEL_NAME, API_URL, or API_KEY is missing from .env.");
  exit(1);
}

const vaultName = argv[2];
if (!vaultName) {
  console.error("Error: Vault name not provided.");
  exit(1);
}

const sourceDir = path.resolve(process.cwd(), 'Vaults', vaultName, 'inbox');
if (!fs.existsSync(sourceDir) || !fs.statSync(sourceDir).isDirectory()) {
  console.error(`Error: Source directory '${sourceDir}' not found.`);
  exit(1);
}

(async () => {
  const files = fs.readdirSync(sourceDir);
  const pdfFiles = files.filter(file => path.extname(file).toLowerCase() === '.pdf');

  // 1. Convert PDFs to images
  console.log("Converting PDFs to images");
  let pdfIdx = 0;
  for (const file of pdfFiles) {
    pdfIdx++;
    updateStatus(`[wiki-sync] Converting PDF to images: ${file}`, `${pdfIdx}/${pdfFiles.length}`);

    const pdfPath = path.join(sourceDir, file);
    const folderName = path.join(sourceDir, path.basename(file, '.pdf'));
    fs.mkdirSync(folderName, { recursive: true });

    try {
      execSync(`pdftoppm -png -r 300 "${pdfPath}" "${path.join(folderName, 'temp')}"`);
      const pageFiles = fs.readdirSync(folderName)
        .filter(f => f.startsWith('temp-') && f.endsWith('.png'))
        .sort();

      let count = 0;
      for (const pageFile of pageFiles) {
        fs.renameSync(
          path.join(folderName, pageFile),
          path.join(folderName, `${count}.png`)
        );
        count++;
      }
    } catch (e: any) {
      console.error(`Failed to convert PDF ${file}:`, e.message);
    }
  }

  // 2. OCR each image in converted PDF subdirectories
  console.log(`Interpreting image with OCR model: ${ocrModelName}`);
  const subdirs = fs.readdirSync(sourceDir)
    .map(f => path.join(sourceDir, f))
    .filter(f => fs.statSync(f).isDirectory());

  let totalImages = 0;
  const subdirImages: { subdir: string; images: string[] }[] = [];
  for (const subdir of subdirs) {
    const pageImages = fs.readdirSync(subdir)
      .filter(f => ['.png', '.jpg', '.jpeg'].includes(path.extname(f).toLowerCase()))
      .sort((a, b) => parseInt(a) - parseInt(b)); // Sort numerically
    
    // We only process images that don't have .md yet
    const imagesToProcess = pageImages.filter(imgName => !fs.existsSync(path.join(subdir, `${imgName}.md`)));
    if (imagesToProcess.length > 0) {
      totalImages += imagesToProcess.length;
      subdirImages.push({ subdir, images: imagesToProcess });
    }
  }

  if (totalImages > 0) {
    let imageIdx = 0;
    for (const { subdir, images } of subdirImages) {
      const folderBasename = path.basename(subdir);
      for (const imgName of images) {
        imageIdx++;
        const imgPath = path.join(subdir, imgName);
        const mdFile = `${imgPath}.md`;

        updateStatus(`[wiki-sync] OCRing: ${folderBasename}/${imgName}`, `${imageIdx}/${totalImages}`);
        console.log(`OCRing: ${imgPath}`);

        const ext = path.extname(imgName).toLowerCase();
        const format = ext === '.jpg' ? 'jpeg' : ext.slice(1);
        const base64Img = fs.readFileSync(imgPath).toString('base64');

        const payload = {
          model: ocrModelName,
          messages: [
            {
              role: "user",
              content: [
                {
                  type: "text",
                  text: "Perform OCR on this image and return the text."
                },
                {
                  type: "image_url",
                  image_url: {
                    url: `data:image/${format};base64,${base64Img}`
                  }
                }
              ]
            }
          ]
        };

        try {
          const response = await fetch(apiUrl!, {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${apiKey}`,
              'Content-Type': 'application/json'
            },
            body: JSON.stringify(payload)
          });
          if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
          }
          const data = (await response.json()) as any;
          const content = data?.choices?.[0]?.message?.content;
          if (content && content.trim()) {
            fs.writeFileSync(mdFile, content);
            console.log(`Success: Created ${mdFile}`);
          } else {
            console.error(`Failed to OCR ${imgPath}: empty response`);
          }
        } catch (e: any) {
          console.error(`Failed to OCR ${imgPath}:`, e.message);
        }
      }
    }
  }

  // 3. Concatenate and cleanup
  console.log("\nConcatenating and cleaning up PDF folders");
  let concatIdx = 0;
  for (const file of pdfFiles) {
    concatIdx++;
    const baseName = path.basename(file, '.pdf');
    const folderName = path.join(sourceDir, baseName);
    const outputMd = path.join(sourceDir, `${baseName}.md`);

    if (fs.existsSync(folderName) && fs.statSync(folderName).isDirectory()) {
      updateStatus(`[wiki-sync] Concatenating PDF results: ${file}`, `${concatIdx}/${pdfFiles.length}`);
      console.log(`Concatenating results from ${folderName} into ${outputMd}`);
      
      const mdFiles = fs.readdirSync(folderName)
        .filter(f => f.endsWith('.png.md'))
        .sort((a, b) => parseInt(a) - parseInt(b));

      let concatenatedContent = '';
      for (const mdFile of mdFiles) {
        const pageContent = fs.readFileSync(path.join(folderName, mdFile), 'utf8');
        concatenatedContent += pageContent + '\n\n';
      }

      if (concatenatedContent.trim()) {
        fs.writeFileSync(outputMd, concatenatedContent);
        fs.rmSync(folderName, { recursive: true, force: true });
        console.log(`Successfully created ${outputMd} and removed ${folderName}`);
      } else {
        console.log(`Warning: ${outputMd} is empty. Not removing ${folderName}`);
      }
    }
  }

  cleanStatus();
})();
