import { argv, exit } from 'process';
import * as fs from 'fs';
import * as path from 'path';
import { execSync } from 'child_process';

const vaults = argv[2];
const inquiry = argv[3];

if (!vaults || !inquiry) {
  console.error("Error: Both Vault name(s) and Report inquiry parameters are required. Usage: /wiki-report <Vaults> <Report-Inquiry>");
  exit(1);
}

const vaultName = vaults.split(',')[0];
const ensureFoldersScript = path.resolve(process.cwd(), '.opencode', 'commands', 'wiki-sync', 'ensure-folders.ts');

try {
  execSync(`node --experimental-strip-types "${ensureFoldersScript}" "${vaultName}"`, { stdio: 'inherit' });
} catch (e: any) {
  console.error("Failed to run ensure-folders:", e.message);
  exit(1);
}

const reportsDir = path.resolve(process.cwd(), 'Vaults', vaultName, 'wiki', 'reports');
fs.mkdirSync(reportsDir, { recursive: true });
