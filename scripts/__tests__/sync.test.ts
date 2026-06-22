import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import * as path from 'path';
import * as fs from 'fs';
import { execSync } from 'child_process';
import { fileURLToPath } from 'url';
import { config } from '../src/utils/config.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const TEST_ROOT = path.resolve(__dirname, '..', '..', 'temp-sync-orchestrator-vaults');

vi.mock('child_process', async (importOriginal) => {
  const original = await importOriginal<typeof import('child_process')>();
  return {
    ...original,
    execSync: vi.fn()
  };
});

describe('sync.ts (Main Orchestrator) Tests', () => {
  const vaultName = 'SyncOrchestratorVault';

  beforeEach(() => {
    config.vaultsRoot = TEST_ROOT;
    config.vaultName = vaultName;
    process.env.VAULTS_ROOT = TEST_ROOT;
  });

  afterEach(() => {
    fs.rmSync(TEST_ROOT, { recursive: true, force: true });
    vi.resetModules();
  });

  it('should run full sync pipeline by spawning pre-processors, summaries, concepts, persons, timeline, and social-graph scripts', async () => {
    // Mock summaries.ts stdout output representing the parsed processed files
    const mockSummariesStdout = JSON.stringify({
      processed: [
        {
          summaryPath: path.join(TEST_ROOT, vaultName, 'wiki', 'summaries', 'Andrej Karpathy.md'),
          summaryFilename: 'Andrej Karpathy.md',
          frontmatter: {
            entities: {
              concepts: ['Deep Learning'],
              persons: ['Andrej Karpathy']
            }
          }
        }
      ]
    });

    vi.mocked(execSync).mockImplementation((command) => {
      if (String(command).includes('summaries.ts')) {
        // Return JSON output as expected
        return Buffer.from(mockSummariesStdout);
      }
      return Buffer.from('');
    });

    const originalArgv = process.argv;
    process.argv = ['node', 'sync.ts', vaultName];

    await import('../sync.js');

    await new Promise(resolve => setTimeout(resolve, 200));

    // Verify all subprocesses were triggered
    expect(execSync).toHaveBeenCalled();
    const calls = vi.mocked(execSync).mock.calls.map(c => c[0]);

    // Check pre-processors
    expect(calls.some(c => String(c).includes('ensure-folders.ts'))).toBe(true);
    expect(calls.some(c => String(c).includes('sanitize-filenames.ts'))).toBe(true);
    expect(calls.some(c => String(c).includes('image-to-text.ts'))).toBe(true);
    expect(calls.some(c => String(c).includes('ocr-pdf.ts'))).toBe(true);

    // Check summaries parser
    expect(calls.some(c => String(c).includes('summaries.ts'))).toBe(true);

    // Check concepts card worker
    expect(calls.some(c => String(c).includes('concepts.ts') && String(c).includes('Deep Learning'))).toBe(true);

    // Check persons biography worker
    expect(calls.some(c => String(c).includes('persons.ts') && String(c).includes('Andrej Karpathy'))).toBe(true);

    // Check final compilers
    expect(calls.some(c => String(c).includes('timeline.ts'))).toBe(true);
    expect(calls.some(c => String(c).includes('social-graph.ts'))).toBe(true);

    process.argv = originalArgv;
  });
});
