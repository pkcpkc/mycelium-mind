import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import * as path from 'path';
import * as fs from 'fs';
import { execSync } from 'child_process';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const TEST_ROOT = path.resolve(__dirname, '..', '..', '..', 'temp-sanitize-vaults');

describe('sanitize-filenames.ts Tests', () => {
  const vaultName = 'SanitizeTestVault';
  const inboxDir = path.join(TEST_ROOT, vaultName, 'inbox');

  beforeAll(() => {
    fs.mkdirSync(inboxDir, { recursive: true });
  });

  afterAll(() => {
    fs.rmSync(TEST_ROOT, { recursive: true, force: true });
  });

  it('should sanitize invalid characters in filenames within the inbox', () => {
    const badFile1 = path.join(inboxDir, 'Andrej:Karpathy?.md');
    const badFile2 = path.join(inboxDir, 'Normal File.md');

    fs.writeFileSync(badFile1, 'content');
    fs.writeFileSync(badFile2, 'content');

    const scriptPath = path.resolve(__dirname, '..', '..', 'src', 'processing', 'sanitize-filenames.ts');
    execSync(`npx tsx "${scriptPath}" "${vaultName}"`, {
      env: { ...process.env, VAULTS_ROOT: TEST_ROOT }
    });

    expect(fs.existsSync(path.join(inboxDir, 'AndrejKarpathy.md'))).toBe(true);
    expect(fs.existsSync(badFile1)).toBe(false);
    expect(fs.existsSync(badFile2)).toBe(true);
  });
});
