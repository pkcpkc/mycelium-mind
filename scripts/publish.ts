import { argv, exit } from 'process';
import { projectRootDir } from './src/utils/config.js';

const vaultPath = argv[2];
const targetDir = argv[3];

const label = vaultPath ? `for: ${vaultPath}` : 'for all vaults in Vaults';

console.log(`\n========================================`);
console.log(`Starting Site Publishing ${label}`);
console.log(`========================================`);

const cmd = [`npx tsx scripts/src/publish/publish.ts`];
if (vaultPath) {
  cmd.push(`"${vaultPath}"`);
}
if (targetDir) {
  cmd.push(`"${targetDir}"`);
}

try {
  const { execSync } = await import('child_process');
  execSync(cmd.join(' '), { stdio: 'inherit', cwd: projectRootDir });
} catch (e: any) {
  console.error('Publish step failed:', e.message);
  exit(1);
}

console.log(`\n========================================`);
console.log(`Site Publishing Complete!`);
console.log(`========================================\n`);
