import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';

// 1. Run typescript compiler
console.log('Compiling TypeScript...');
execSync('npx tsc', { stdio: 'inherit' });

// 2. Helper to copy directory recursively
function copyDir(src, dest) {
  fs.mkdirSync(dest, { recursive: true });
  const entries = fs.readdirSync(src, { withFileTypes: true });
  for (const entry of entries) {
    const srcPath = path.join(src, entry.name);
    const destPath = path.join(dest, entry.name);
    if (entry.isDirectory()) {
      copyDir(srcPath, destPath);
    } else {
      fs.copyFileSync(srcPath, destPath);
    }
  }
}

// 3. Copy assets
console.log('Copying assets...');
fs.copyFileSync(
  'src/utils/collection-cloud-template.md',
  'build/utils/collection-cloud-template.md'
);
copyDir('src/commands/assets', 'build/commands/assets');
console.log('Build completed successfully!');
