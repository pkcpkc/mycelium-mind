import { argv, exit } from 'process';
import * as fs from 'fs';
import * as path from 'path';
import { config } from '../utils/config.js';
import { getVaultDir } from '../utils/utils.js';

const vaultName = argv[2] || config.vaultName;
if (!vaultName) {
  console.error("Usage: ensure-folders.ts <VaultName|Path>");
  exit(1);
}

const vaultDir = getVaultDir(vaultName);

const directories = [
  path.join(vaultDir, "wiki"),
  path.join(vaultDir, "wiki", "assets"),
  path.join(vaultDir, "schemas"),
  path.join(vaultDir, "wiki", "summaries"),
  path.join(vaultDir, "wiki", "concepts"),
  path.join(vaultDir, "wiki", "persons"),
  path.join(vaultDir, "wiki", "reports"),
  path.join(vaultDir, "inbox"),
];

for (const dir of directories) {
  fs.mkdirSync(dir, { recursive: true });
}
