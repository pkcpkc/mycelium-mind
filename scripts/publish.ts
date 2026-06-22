import { argv, exit } from 'process';
import { config, projectRootDir } from './src/utils/config.js';

const vaultPath = argv[2] || config.vaultName;
const targetDir = argv[3];

if (!vaultPath) {
  console.error('Usage: npx tsx scripts/publish.ts <VaultName|Path> [TargetDir]');
  exit(1);
}

console.log(`\n========================================`);
console.log(`Starting Site Publishing for: ${vaultPath}`);
console.log(`========================================`);

const cmd = `npx tsx scripts/src/publish/publish.ts "${vaultPath}"${targetDir ? ` "${targetDir}"` : ''}`;

try {
  const { execSync } = await import('child_process');
  execSync(cmd, { stdio: 'inherit', cwd: projectRootDir });
} catch (e: any) {
  console.error('Publish step failed:', e.message);
  exit(1);
}

console.log(`\n========================================`);
console.log(`Site Publishing Complete!`);
console.log(`========================================\n`);
