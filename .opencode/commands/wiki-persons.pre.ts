import { argv, exit } from 'process';
import * as fs from 'fs';
import * as path from 'path';

const vaultName = argv[2];
if (!vaultName) {
  console.error("Error: Vault name parameter is required. Usage: /wiki-persons <VaultName>");
  exit(1);
}

const summariesDir = path.resolve(process.cwd(), 'Vaults', vaultName, 'wiki', 'summaries');
const personsDir = path.resolve(process.cwd(), 'Vaults', vaultName, 'wiki', 'persons');

fs.mkdirSync(personsDir, { recursive: true });

if (!fs.existsSync(summariesDir) || fs.readdirSync(summariesDir).filter(f => f.endsWith('.md')).length === 0) {
  console.log("[wiki-persons] No summaries found. Run /wiki-summaries first.");
  exit(0);
}
