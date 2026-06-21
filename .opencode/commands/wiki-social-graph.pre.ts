import { argv, exit } from 'process';
import * as fs from 'fs';
import * as path from 'path';

const vaultName = argv[2];
if (!vaultName) {
  console.error("Error: Vault name parameter is required. Usage: /wiki-social-graph <VaultName>");
  exit(1);
}

const personsDir = path.resolve(process.cwd(), 'Vaults', vaultName, 'wiki', 'persons');

if (!fs.existsSync(personsDir) || !fs.statSync(personsDir).isDirectory()) {
  console.log("[wiki-social-graph] No person files found. Run /wiki-persons first.");
  exit(0);
}

const files = fs.readdirSync(personsDir).filter(f => f.endsWith('.md'));
if (files.length === 0) {
  console.log("[wiki-social-graph] No person files found. Run /wiki-persons first.");
  exit(0);
}
