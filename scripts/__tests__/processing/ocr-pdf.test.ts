import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import * as path from 'path';
import * as fs from 'fs';
import { execSync } from 'child_process';
import { fileURLToPath } from 'url';
import { config } from '../../src/utils/config.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const TEST_ROOT = path.resolve(__dirname, '..', '..', '..', 'temp-ocr-vaults');

vi.mock('child_process', async (importOriginal) => {
  const original = await importOriginal<typeof import('child_process')>();
  return {
    ...original,
    execSync: vi.fn()
  };
});

describe('ocr-pdf.ts Tests', () => {
  const vaultName = 'OcrTestVault';
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

  it('should convert PDF to image, perform OCR, and concatenate the results', async () => {
    const pdfPath = path.join(inboxDir, 'test-doc.pdf');
    fs.writeFileSync(pdfPath, 'dummy-pdf-content');

    vi.mocked(execSync).mockImplementation((command) => {
      const folderName = path.join(inboxDir, 'test-doc');
      fs.mkdirSync(folderName, { recursive: true });
      fs.writeFileSync(path.join(folderName, 'temp-1.png'), 'fake-image-bytes');
      return Buffer.from('');
    });

    const mockResponse = {
      ok: true,
      status: 200,
      json: async () => ({
        choices: [
          {
            message: {
              content: 'Page 1 OCR Text Content'
            }
          }
        ]
      })
    };
    vi.mocked(fetch).mockResolvedValue(mockResponse as any);

    const originalArgv = process.argv;
    process.argv = ['node', 'ocr-pdf.ts', vaultName];

    await import('../../src/processing/ocr-pdf.js');

    await new Promise(resolve => setTimeout(resolve, 200));

    expect(execSync).toHaveBeenCalled();

    const finalMdPath = path.join(inboxDir, 'test-doc.md');
    expect(fs.existsSync(finalMdPath)).toBe(true);
    expect(fs.readFileSync(finalMdPath, 'utf8')).toContain('Page 1 OCR Text Content');

    process.argv = originalArgv;
  });
});
