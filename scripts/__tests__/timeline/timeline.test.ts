import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import * as path from 'path';
import * as fs from 'fs';
import { fileURLToPath } from 'url';
import { config } from '../../src/utils/config.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const TEST_ROOT = path.resolve(__dirname, '..', '..', '..', 'temp-timeline-vaults');

describe('timeline.ts Tests', () => {
  const vaultName = 'TimelineTestVault';
  const wikiDir = path.join(TEST_ROOT, vaultName, 'wiki');

  beforeEach(() => {
    fs.mkdirSync(path.join(wikiDir, 'summaries'), { recursive: true });
    fs.mkdirSync(path.join(wikiDir, 'concepts'), { recursive: true });
    config.vaultsRoot = TEST_ROOT;
    config.vaultName = vaultName;
    process.env.VAULTS_ROOT = TEST_ROOT;
  });

  afterEach(() => {
    fs.rmSync(TEST_ROOT, { recursive: true, force: true });
    vi.resetModules();
  });

  it('should compile chronological events from summaries into timeline.md', async () => {
    fs.writeFileSync(
      path.join(wikiDir, 'summaries', 'Summary One.md'),
      `---
type: Summary
title: "Summary One"
times:
  - date: "2026-06-01"
    title: "Event One"
  - "2026-06-15: Event Two"
---
# Summary One`
    );

    fs.writeFileSync(path.join(wikiDir, 'index.md'), '# Index\n\n## Timeline');

    const originalArgv = process.argv;
    process.argv = ['node', 'timeline.ts', vaultName];

    await import('../../src/timeline/timeline.js');

    await new Promise(resolve => setTimeout(resolve, 100));

    const timelinePath = path.join(wikiDir, 'timeline.md');
    expect(fs.existsSync(timelinePath)).toBe(true);
    
    const timelineContent = fs.readFileSync(timelinePath, 'utf8');
    expect(timelineContent).toContain('Event One');
    expect(timelineContent).toContain('Event Two');
    expect(timelineContent).toContain('2026-06-01');
    expect(timelineContent).toContain('2026-06-15');

    const indexContent = fs.readFileSync(path.join(wikiDir, 'index.md'), 'utf8');
    expect(indexContent).toContain('[[timeline|Timeline]]');

    process.argv = originalArgv;
  });
});
