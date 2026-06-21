import { argv, exit } from 'process';
import * as fs from 'fs';
import * as path from 'path';

console.log("\n--- Filename Sanitization ---");

const vaultName = argv[2];
if (!vaultName) {
  console.error("Error: Vault name not provided.");
  console.error("Usage: /wiki-sync <vault-name>");
  exit(1);
}

const sourceDir = path.resolve(process.cwd(), 'Vaults', vaultName, 'inbox');
if (!fs.existsSync(sourceDir) || !fs.statSync(sourceDir).isDirectory()) {
  console.error(`Error: Source directory '${sourceDir}' not found.`);
  exit(1);
}

function sanitizeName(name: string): string {
  let sanitized = name.replace(/[\\/:*?"<>|]/g, '');
  sanitized = sanitized.replace(/\s+/g, '-');
  return sanitized;
}

function getUniqueTarget(dir: string, name: string): string {
  const target = path.join(dir, name);
  if (!fs.existsSync(target)) {
    return target;
  }

  const ext = path.extname(name);
  const base = path.basename(name, ext);

  let count = 1;
  while (fs.existsSync(path.join(dir, `${base}-${count}${ext}`))) {
    count++;
  }
  return path.join(dir, `${base}-${count}${ext}`);
}

function walkSync(dir: string): string[] {
  let results: string[] = [];
  const list = fs.readdirSync(dir);
  for (const file of list) {
    const filePath = path.join(dir, file);
    const stat = fs.statSync(filePath);
    if (stat && stat.isDirectory()) {
      results = results.concat(walkSync(filePath));
    } else {
      results.push(filePath);
    }
  }
  return results;
}

const files = walkSync(sourceDir);
let renamedCount = 0;

for (const file of files) {
  const dir = path.dirname(file);
  const filename = path.basename(file);
  let sanitized = sanitizeName(filename);

  if (!sanitized) {
    sanitized = "untitled";
  }

  if (filename === sanitized) {
    continue;
  }

  const target = getUniqueTarget(dir, sanitized);
  fs.renameSync(file, target);
  console.log(`Renamed: ${file} -> ${target}`);
  renamedCount++;
}

console.log(`Filename sanitization complete. Renamed ${renamedCount} file(s).`);
