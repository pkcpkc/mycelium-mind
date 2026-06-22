import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import * as path from 'path';
import * as fs from 'fs';
import { fileURLToPath } from 'url';
import { config } from '../../src/utils/config.js';
import { callAgenticModel } from '../../src/utils/llm.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const TEST_ROOT = path.resolve(__dirname, '..', '..', '..', 'temp-summaries-vaults');

vi.mock('../../src/utils/llm.js', () => {
  return {
    callAgenticModel: vi.fn()
  };
});

describe('summaries.ts Tests', () => {
  const vaultName = 'SummariesTestVault';
  const inboxDir = path.join(TEST_ROOT, vaultName, 'inbox');
  const wikiDir = path.join(TEST_ROOT, vaultName, 'wiki');

  beforeEach(() => {
    fs.mkdirSync(inboxDir, { recursive: true });
    fs.mkdirSync(path.join(wikiDir, 'summaries'), { recursive: true });
    fs.mkdirSync(path.join(wikiDir, 'assets'), { recursive: true });
    fs.mkdirSync(path.join(TEST_ROOT, vaultName, 'schemas'), { recursive: true });

    // Mock prompt templates
    const promptsDir = path.join(TEST_ROOT, 'scripts', 'prompts');
    fs.mkdirSync(promptsDir, { recursive: true });
    fs.writeFileSync(path.join(promptsDir, 'summary.md'), 'Schema: $SCHEMA - Content: $DOCUMENT_CONTENT');
    fs.writeFileSync(path.join(TEST_ROOT, vaultName, 'schemas', 'summary.md'), 'MockSummarySchemaText');

    config.vaultsRoot = TEST_ROOT;
    config.vaultName = vaultName;
    process.env.VAULTS_ROOT = TEST_ROOT;
  });

  afterEach(() => {
    fs.rmSync(TEST_ROOT, { recursive: true, force: true });
    vi.resetModules();
  });

  it('should process inbox files, archive them, generate summaries, and rebuild folder index', async () => {
    // 1. Create inbox document
    const docPath = path.join(inboxDir, 'Andrej-Karpathy.md');
    fs.writeFileSync(docPath, 'Plain text transcription.');

    const pdfPath = path.join(inboxDir, 'Andrej-Karpathy.pdf');
    fs.writeFileSync(pdfPath, 'dummy-pdf-bytes');

    // 2. Mock LLM call
    vi.mocked(callAgenticModel).mockResolvedValue(`---
type: Summary
title: Andrej Karpathy
entities:
  concepts: ["Deep Learning"]
  persons: ["Andrej Karpathy"]
---
# Summary: Andrej Karpathy`);

    const originalArgv = [...process.argv];
    process.argv.length = 0;
    process.argv.push('node', 'summaries.ts', vaultName);

    // Capture console.log
    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

    // Run by importing summaries script
    await import('../../src/summaries/summaries.js');

    // Wait a tiny bit
    await new Promise(resolve => setTimeout(resolve, 200));

    // Verify LLM prompt contains the schema
    expect(callAgenticModel).toHaveBeenCalledWith([
      {
        role: 'user',
        content: expect.stringContaining('MockSummarySchemaText')
      }
    ]);

    // Verify summary was created
    const summaryPath = path.join(wikiDir, 'summaries', 'Andrej Karpathy.md');
    expect(fs.existsSync(summaryPath)).toBe(true);

    const summaryContent = fs.readFileSync(summaryPath, 'utf8');
    expect(summaryContent).toContain('resource:');

    // Verify index.md was created in summaries folder
    const indexPath = path.join(wikiDir, 'summaries', 'index.md');
    expect(fs.existsSync(indexPath)).toBe(true);
    expect(fs.readFileSync(indexPath, 'utf8')).toContain('[[Andrej Karpathy]]');

    // Verify temp md file in inbox is deleted, but PDF remains
    expect(fs.existsSync(docPath)).toBe(false);
    expect(fs.existsSync(pdfPath)).toBe(true);

    // Verify console log logged the JSON string choice on the last line
    expect(logSpy).toHaveBeenCalled();
    const calls = logSpy.mock.calls;
    const lastCall = calls[calls.length - 1][0];
    const data = JSON.parse(lastCall);
    expect(data.processed.length).toBe(1);
    expect(data.processed[0].summaryFilename).toBe('Andrej Karpathy.md');

    logSpy.mockRestore();
    process.argv.length = 0;
    process.argv.push(...originalArgv);
  });
});
