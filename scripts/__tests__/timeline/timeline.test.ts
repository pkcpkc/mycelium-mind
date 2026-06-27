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
    process.env.VAULTS_ROOT = TEST_ROOT;
    process.env.VAULT_NAME = vaultName;
    config.vaultsRoot = TEST_ROOT;
    config.vaultName = vaultName;
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

  it('should normalize dates to yyyy-mm-dd and sort them chronologically', async () => {
    fs.writeFileSync(
      path.join(wikiDir, 'summaries', 'Summary Two.md'),
      `---
type: Summary
title: "Summary Two"
times:
  - date: "2026-6-1"
    title: "First Event"
  - date: "2026-12-15"
    title: "Third Event"
  - date: "2026-8-05"
    title: "Second Event"
---
# Summary Two`
    );

    const originalArgv = process.argv;
    process.argv = ['node', 'timeline.ts', vaultName];

    await import('../../src/timeline/timeline.js');

    await new Promise(resolve => setTimeout(resolve, 100));

    const timelinePath = path.join(wikiDir, 'timeline.md');
    const timelineContent = fs.readFileSync(timelinePath, 'utf8');

    expect(timelineContent).toContain('2026-06-01');
    expect(timelineContent).toContain('2026-08-05');
    expect(timelineContent).toContain('2026-12-15');
    expect(timelineContent).not.toContain('2026-6-1');

    const firstEventIndex = timelineContent.indexOf('First Event');
    const secondEventIndex = timelineContent.indexOf('Second Event');
    const thirdEventIndex = timelineContent.indexOf('Third Event');

    expect(firstEventIndex).toBeGreaterThan(-1);
    expect(secondEventIndex).toBeGreaterThan(firstEventIndex);
    expect(thirdEventIndex).toBeGreaterThan(secondEventIndex);

    process.argv = originalArgv;
  });

  it('should handle unquoted date objects and numbers in frontmatter and sort them chronologically', async () => {
    fs.writeFileSync(
      path.join(wikiDir, 'summaries', 'Summary Three.md'),
      `---
type: Summary
title: "Summary Three"
times:
  - date: 2026-06-04
    title: "Unquoted Date Event"
  - date: 2025
    title: "Unquoted Year Event"
  - date: 2026-06-02
    title: "Another Event"
---
# Summary Three`
    );

    const originalArgv = process.argv;
    process.argv = ['node', 'timeline.ts', vaultName];

    await import('../../src/timeline/timeline.js');

    await new Promise(resolve => setTimeout(resolve, 100));

    const timelinePath = path.join(wikiDir, 'timeline.md');
    const timelineContent = fs.readFileSync(timelinePath, 'utf8');

    expect(timelineContent).toContain('2026-06-04');
    expect(timelineContent).toContain('2025');
    expect(timelineContent).toContain('2026-06-02');

    const year2025Index = timelineContent.indexOf('## 2025');
    const year2026Index = timelineContent.indexOf('## 2026');
    const event202602Index = timelineContent.indexOf('Another Event');
    const event202604Index = timelineContent.indexOf('Unquoted Date Event');

    expect(year2025Index).toBeGreaterThan(-1);
    expect(year2026Index).toBeGreaterThan(year2025Index);
    expect(event202602Index).toBeGreaterThan(year2026Index);
    expect(event202604Index).toBeGreaterThan(event202602Index);

    process.argv = originalArgv;
  });

  it('should add wiki links when matching concepts or persons are found in the event title', async () => {
    fs.mkdirSync(path.join(wikiDir, 'persons'), { recursive: true });
    fs.mkdirSync(path.join(wikiDir, 'concepts'), { recursive: true });
    fs.writeFileSync(path.join(wikiDir, 'persons', 'Alan Turing.md'), '# Alan Turing');
    fs.writeFileSync(path.join(wikiDir, 'concepts', 'Quantum Computing.md'), '# Quantum Computing');

    fs.writeFileSync(
      path.join(wikiDir, 'summaries', 'Summary Four.md'),
      `---
type: Summary
title: "Summary Four"
times:
  - date: "2026-06-01"
    title: "Event about Alan Turing and Quantum Computing research"
---
# Summary Four`
    );

    const originalArgv = process.argv;
    process.argv = ['node', 'timeline.ts', vaultName];

    await import('../../src/timeline/timeline.js');

    await new Promise(resolve => setTimeout(resolve, 100));

    const timelinePath = path.join(wikiDir, 'timeline.md');
    const timelineContent = fs.readFileSync(timelinePath, 'utf8');

    expect(timelineContent).toContain('[[Alan Turing]]');
    expect(timelineContent).toContain('[[Quantum Computing]]');
    expect(timelineContent).toContain('Event about [[Alan Turing]] and [[Quantum Computing]] research');

    process.argv = originalArgv;
  });
});
