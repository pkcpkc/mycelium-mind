import { argv, exit } from 'process';
import * as fs from 'fs';
import * as path from 'path';

const vaultName = argv[2];
if (!vaultName) {
  console.error("Error: Vault name not provided.");
  exit(1);
}

const vaultDir = path.resolve(process.cwd(), 'Vaults', vaultName);

const directories = [
  path.join(vaultDir, 'wiki'),
  path.join(vaultDir, 'wiki', 'assets'),
  path.join(vaultDir, 'schemas'),
  path.join(vaultDir, 'wiki', 'summaries'),
  path.join(vaultDir, 'wiki', 'concepts'),
  path.join(vaultDir, 'wiki', 'persons'),
  path.join(vaultDir, 'wiki', 'reports'),
  path.join(vaultDir, 'inbox'),
];

for (const dir of directories) {
  fs.mkdirSync(dir, { recursive: true });
}
