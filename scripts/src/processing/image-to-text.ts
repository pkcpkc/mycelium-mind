import { argv, exit } from "process";
import * as fs from "fs";
import * as path from "path";
import { config } from "../utils/config.js";
import { getVaultDir } from "../utils/utils.js";

console.log("\n--- Semantic Image Analysis ---");

const imageModelName = process.env.IMAGE_MODEL_NAME || config.agenticModelName;
const apiUrl = config.apiUrl;
const apiKey = config.apiKey;

const vaultName = argv[2] || config.vaultName;
if (!vaultName) {
  console.error("Usage: image-to-text.ts <VaultName|Path>");
  exit(1);
}

const sourceDir = path.join(getVaultDir(vaultName), "inbox");
if (!fs.existsSync(sourceDir) || !fs.statSync(sourceDir).isDirectory()) {
  console.error(`Error: Source directory '${sourceDir}' not found.`);
  exit(1);
}

console.log(`Interpreting inbox images with image model: ${imageModelName}`);

(async () => {
  const files = fs.readdirSync(sourceDir);
  const imageExtensions = [".png", ".jpg", ".jpeg"];
  const filesToProcess = files.filter((file) => {
    const ext = path.extname(file).toLowerCase();
    if (!imageExtensions.includes(ext)) return false;
    const imgPath = path.join(sourceDir, file);
    return !fs.existsSync(`${imgPath}.md`);
  });

  if (filesToProcess.length === 0) {
    console.log("[wiki-sync] No new images to analyze.");
    return;
  }

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };
  if (apiKey && apiKey !== "dummy-key") {
    headers["Authorization"] = `Bearer ${apiKey}`;
  }

  for (const file of filesToProcess) {
    const ext = path.extname(file).toLowerCase();
    const imgPath = path.join(sourceDir, file);
    const mdFile = `${imgPath}.md`;

    console.log(`Analyzing: ${imgPath}`);

    const format = ext === ".jpg" ? "jpeg" : ext.slice(1);
    const base64Img = fs.readFileSync(imgPath).toString("base64");

    const payload = {
      model: imageModelName,
      messages: [
        {
          role: "user",
          content: [
            {
              type: "text",
              text: "Provide nothing but an into-detail image description for this image.",
            },
            {
              type: "image_url",
              image_url: {
                url: `data:image/${format};base64,${base64Img}`,
              },
            },
          ],
        },
      ],
    };

    try {
      const response = await fetch(apiUrl, {
        method: "POST",
        headers: headers,
        body: JSON.stringify(payload),
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
})();
