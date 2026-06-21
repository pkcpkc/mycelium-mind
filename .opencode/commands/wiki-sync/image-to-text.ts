import { argv, exit } from 'process';
import * as fs from 'fs';
import * as path from 'path';
import { updateStatus, cleanStatus } from '../status-helper.ts';

console.log("--- Semantic Image Analysis ---");

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

const imageModelName = process.env.IMAGE_MODEL_NAME;
const apiUrl = process.env.API_URL;
const apiKey = process.env.API_KEY;

if (!imageModelName || !apiUrl || !apiKey) {
  console.error("Error: IMAGE_MODEL_NAME, API_URL, or API_KEY is missing from .env.");
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

console.log(`Interpreting inbox images with image model: ${imageModelName}`);

(async () => {
  const files = fs.readdirSync(sourceDir);
  const imageExtensions = ['.png', '.jpg', '.jpeg'];
  const filesToProcess = files.filter(file => {
    const ext = path.extname(file).toLowerCase();
    if (!imageExtensions.includes(ext)) return false;
    const imgPath = path.join(sourceDir, file);
    return !fs.existsSync(`${imgPath}.md`);
  });

  if (filesToProcess.length === 0) {
    console.log("[wiki-sync] No new images to analyze.");
    return;
  }

  let idx = 0;
  for (const file of filesToProcess) {
    idx++;
    const ext = path.extname(file).toLowerCase();
    const imgPath = path.join(sourceDir, file);
    const mdFile = `${imgPath}.md`;

    updateStatus(`[wiki-sync] Analyzing image: ${file}`, `${idx}/${filesToProcess.length}`);
    console.log(`Analyzing: ${imgPath}`);

    const format = ext === '.jpg' ? 'jpeg' : ext.slice(1);
    const base64Img = fs.readFileSync(imgPath).toString('base64');

    const payload = {
      model: imageModelName,
      messages: [
        {
          role: "user",
          content: [
            {
              type: "text",
              text: "Provide nothing but an into-detail image description for this image."
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
        console.error(`Failed to analyze ${imgPath}: empty response`);
      }
    } catch (e: any) {
      console.error(`Failed to analyze ${imgPath}:`, e.message);
    }
  }

  cleanStatus();
})();
