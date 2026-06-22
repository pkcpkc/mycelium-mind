import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import * as path from 'path';
import * as fs from 'fs';
import { fileURLToPath } from 'url';
import { config } from '../../src/utils/config.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const TEST_ROOT = path.resolve(__dirname, '..', '..', '..', 'temp-image-vaults');

describe('image-to-text.ts Tests', () => {
  const vaultName = 'ImageTestVault';
  const inboxDir = path.join(TEST_ROOT, vaultName, 'inbox');

  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn());
    fs.mkdirSync(inboxDir, { recursive: true });
    config.vaultsRoot = TEST_ROOT;
    config.vaultName = vaultName;
    process.env.VAULTS_ROOT = TEST_ROOT;
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    fs.rmSync(TEST_ROOT, { recursive: true, force: true });
    vi.resetModules();
  });

  it('should call fetch and write description for new images', async () => {
    const imgPath = path.join(inboxDir, 'test-image.png');
    fs.writeFileSync(imgPath, 'fake-image-bytes');

    const mockResponse = {
      ok: true,
      status: 200,
      json: async () => ({
        choices: [
          {
            message: {
              content: 'This is a description of the test image.'
            }
          }
        ]
      })
    };
    vi.mocked(fetch).mockResolvedValue(mockResponse as any);

    const originalArgv = process.argv;
    process.argv = ['node', 'image-to-text.ts', vaultName];

    await import('../../src/processing/image-to-text.js');

    await new Promise(resolve => setTimeout(resolve, 100));

    const descPath = imgPath + '.md';
    expect(fs.existsSync(descPath)).toBe(true);
    expect(fs.readFileSync(descPath, 'utf8')).toBe('This is a description of the test image.');

    process.argv = originalArgv;
  });
});
