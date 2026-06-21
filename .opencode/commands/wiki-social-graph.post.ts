import { argv, exit } from 'process';

const vaultName = argv[2];
if (!vaultName) {
  console.error("Error: Vault name parameter is required. Usage: /wiki-social-graph.post.ts <VaultName>");
  exit(1);
}

console.log('\n[Hook] Social graph post-processing finished.');
