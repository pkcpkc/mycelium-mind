import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import * as path from 'path';
import * as fs from 'fs';
import { execSync } from 'child_process';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const TEST_ROOT = path.resolve(__dirname, '..', '..', '..', 'temp-sync-vaults');

describe('ensure-folders.ts Tests', () => {
  const vaultName = 'EnsureTestVault';
  const vaultDir = path.join(TEST_ROOT, vaultName);

  beforeAll(() => {
    fs.mkdirSync(TEST_ROOT, { recursive: true });
    process.env.VAULTS_ROOT = TEST_ROOT;
  });

  afterAll(() => {
    fs.rmSync(TEST_ROOT, { recursive: true, force: true });
  });

  it('should create all required folders inside the target vault directory', () => {
    const scriptPath = path.resolve(__dirname, '..', '..', 'src', 'processing', 'ensure-folders.ts');
    execSync(`npx tsx "${scriptPath}" "${vaultName}"`, {
      env: { ...process.env, VAULTS_ROOT: TEST_ROOT }
    });

    const expectedDirs = [
      path.join(vaultDir, "wiki"),
      path.join(vaultDir, "wiki", "assets"),
      path.join(vaultDir, "schemas"),
      path.join(vaultDir, "wiki", "summaries"),
      path.join(vaultDir, "wiki", "concepts"),
      path.join(vaultDir, "wiki", "persons"),
      path.join(vaultDir, "wiki", "reports"),
      path.join(vaultDir, "inbox"),
    ];

    for (const dir of expectedDirs) {
      expect(fs.existsSync(dir)).toBe(true);
      expect(fs.statSync(dir).isDirectory()).toBe(true);
    }
  });
});
