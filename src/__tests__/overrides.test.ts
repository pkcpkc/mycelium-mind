import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import * as path from 'path';
import * as fs from 'fs';
import { fileURLToPath } from 'url';
import { initWiki } from '../commands/init.js';
import { syncWiki } from '../commands/sync.js';
import { resyncWiki } from '../commands/resync.js';
import { overridesWiki } from '../commands/overrides.js';
import { callAgenticModel } from '../utils/openai-api.js';
import * as childProcess from 'child_process';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const TEST_ROOT = path.resolve(__dirname, '..', '..', 'temp-overrides-tests-vaults');

vi.mock('child_process', () => {
  return {
    execSync: vi.fn((cmd: string, options?: any) => {
      if (cmd.includes('git diff HEAD --name-only -- wiki')) {
        return Buffer.from('wiki/summaries/Andrej Karpathy.md\n');
      }
      if (cmd.includes('git diff HEAD -- "wiki/summaries/Andrej Karpathy.md"')) {
        return Buffer.from('diff --git a/wiki/summaries/Andrej Karpathy.md b/wiki/summaries/Andrej Karpathy.md\n--- a/wiki/summaries/Andrej Karpathy.md\n+++ b/wiki/summaries/Andrej Karpathy.md\n@@ -3,1 +3,2 @@\n-title: Andrej Karpathy\n+title: Andrej Karpathy Edited\n');
      }
      if (cmd.includes('git show HEAD:"wiki/summaries/Andrej Karpathy.md"')) {
        return Buffer.from(`---
type: "Summary"
title: "Andrej Karpathy"
person: ["Andrej Karpathy"]
---
# Andrej Karpathy
Pioneering AI engineer.
`);
      }
      return Buffer.from('');
    })
  };
});

vi.mock('../utils/openai-api.js', () => ({
  callAgenticModel: vi.fn((messages: any[]) => {
    const userMsg = messages[messages.length - 1].content;
    const systemMsg = messages[0]?.content || '';

    if (userMsg.includes('logically apply the changes from the git diff')) {
      return Promise.resolve(`---
type: "Summary"
title: "Andrej Karpathy Edited"
person: ["Andrej Karpathy"]
---
# Andrej Karpathy
Pioneering AI engineer (edited).
`);
    } else if (userMsg.includes('Wiki Person Prompt')) {
      return Promise.resolve(`---
type: "Person"
title: "Andrej Karpathy"
description: "Pioneering AI engineer and educator."
timestamp: "2026-06-24T10:38:00Z"
---
# Andrej Karpathy
AI researcher and educator.
`);
    } else if (systemMsg.includes('Base Summary Extraction Prompt')) {
      return Promise.resolve(`---
type: "Summary"
title: "Andrej Karpathy"
person: ["Andrej Karpathy"]
---
# Andrej Karpathy
Pioneering AI engineer.
`);
    }
    return Promise.resolve('# Mocked Content');
  })
}));

describe('Wiki Overrides and Chronological Replay Tests', () => {
  const wikiPath = path.join(TEST_ROOT, 'TestWiki');

  beforeEach(() => {
    fs.mkdirSync(TEST_ROOT, { recursive: true });
  });

  afterEach(() => {
    fs.rmSync(TEST_ROOT, { recursive: true, force: true });
    vi.clearAllMocks();
  });

  it('should identify manual edits, write overrides.json, and recreate the document via LLM', async () => {
    // 1. Initialize wiki with collections persons
    await initWiki(wikiPath, { includeDefaults: true });

    // Ensure the summary file directory exists
    const summariesDir = path.join(wikiPath, 'wiki', 'summaries');
    fs.mkdirSync(summariesDir, { recursive: true });

    // Write original summary file
    const summaryFile = path.join(summariesDir, 'Andrej Karpathy.md');
    fs.writeFileSync(summaryFile, `---
type: "Summary"
title: "Andrej Karpathy"
person: ["Andrej Karpathy"]
---
# Andrej Karpathy
Pioneering AI engineer.
`, 'utf8');

    // Run overrides
    await overridesWiki(wikiPath);

    // 2. Verify overrides JSON was written to assets/overrides/YYYYMMDD-HHMMSS
    const overridesAssetsDir = path.join(wikiPath, 'wiki', 'assets', 'overrides');
    expect(fs.existsSync(overridesAssetsDir)).toBe(true);

    const timestamps = fs.readdirSync(overridesAssetsDir);
    expect(timestamps.length).toBe(1);
    expect(/^\d{8}-\d{6}$/.test(timestamps[0])).toBe(true);

    const jsonPath = path.join(overridesAssetsDir, timestamps[0], 'overrides.json');
    expect(fs.existsSync(jsonPath)).toBe(true);

    const content = JSON.parse(fs.readFileSync(jsonPath, 'utf8'));
    expect(content[0].file).toBe('wiki/summaries/Andrej Karpathy.md');
    expect(content[0].diff).toContain('title: Andrej Karpathy Edited');

    // 3. Verify the document was recreated via LLM
    const recreatedContent = fs.readFileSync(summaryFile, 'utf8');
    expect(recreatedContent).toContain('title: "Andrej Karpathy Edited"');
    expect(recreatedContent).toContain('Pioneering AI engineer (edited).');
  });

  it('should replay overrides progressively during resyncWiki', async () => {
    await initWiki(wikiPath, { includeDefaults: true });

    // Set up a standard daily ingestion folder
    const ingestionDir = path.join(wikiPath, 'wiki', 'assets', '20260705-120000');
    const processedDir = path.join(ingestionDir, 'processed');
    fs.mkdirSync(processedDir, { recursive: true });
    fs.writeFileSync(path.join(processedDir, 'Andrej Karpathy.md'), '# Andrej Karpathy\nPioneering AI engineer.', 'utf8');

    // Set up an overrides folder
    const overridesDir = path.join(wikiPath, 'wiki', 'assets', 'overrides', '20260705-123000');
    fs.mkdirSync(overridesDir, { recursive: true });
    fs.writeFileSync(path.join(overridesDir, 'overrides.json'), JSON.stringify([
      {
        file: 'wiki/summaries/Andrej Karpathy.md',
        diff: 'diff --git a/wiki/summaries/Andrej Karpathy.md b/wiki/summaries/Andrej Karpathy.md\n--- a/wiki/summaries/Andrej Karpathy.md\n+++ b/wiki/summaries/Andrej Karpathy.md\n@@ -3,1 +3,2 @@\n-title: Andrej Karpathy\n+title: Andrej Karpathy Edited\n'
      }
    ]), 'utf8');

    // Run resync
    await resyncWiki(wikiPath);

    // Verify summary is recreated and the override was re-applied
    const summaryFile = path.join(wikiPath, 'wiki', 'summaries', 'Andrej Karpathy.md');
    expect(fs.existsSync(summaryFile)).toBe(true);

    const finalSummaryContent = fs.readFileSync(summaryFile, 'utf8');
    expect(finalSummaryContent).toContain('title: "Andrej Karpathy Edited"');
    expect(finalSummaryContent).toContain('Pioneering AI engineer (edited).');
  });
});
