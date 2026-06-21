import { argv, exit } from 'process';
import * as path from 'path';
import { execSync } from 'child_process';
import * as fs from 'fs';

const vaultName = argv[2];
if (!vaultName) {
  console.error("Error: Vault name parameter is required. Usage: /wiki-indices <VaultName>");
  exit(1);
}

const generateIndicesScript = path.resolve(process.cwd(), '.opencode', 'commands', 'generate-indices.ts');
const wikiDir = path.resolve(process.cwd(), 'Vaults', vaultName, 'wiki');

if (!fs.existsSync(generateIndicesScript)) {
  console.error(`Error: generate-indices.ts script not found at ${generateIndicesScript}`);
  exit(1);
}

execSync(`node --experimental-strip-types "${generateIndicesScript}" "${wikiDir}"`, { stdio: 'inherit' });
