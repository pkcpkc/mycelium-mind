import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import * as path from 'path';
import * as fs from 'fs';
import { fileURLToPath } from 'url';
import { config } from '../../src/utils/config.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const TEST_ROOT = path.resolve(__dirname, '..', '..', '..', 'temp-social-vaults');

describe('social-graph.ts Tests', () => {
  const vaultName = 'SocialTestVault';
  const wikiDir = path.join(TEST_ROOT, vaultName, 'wiki');

  beforeEach(() => {
    fs.mkdirSync(path.join(wikiDir, 'summaries'), { recursive: true });
    fs.mkdirSync(path.join(wikiDir, 'persons'), { recursive: true });
    config.vaultsRoot = TEST_ROOT;
    config.vaultName = vaultName;
    process.env.VAULTS_ROOT = TEST_ROOT;
  });

  afterEach(() => {
    fs.rmSync(TEST_ROOT, { recursive: true, force: true });
    vi.resetModules();
  });

  it('should compile relationships and persons into social-graph.md', async () => {
    fs.writeFileSync(
      path.join(wikiDir, 'persons', 'Andrej Karpathy.md'),
      `---
type: Person
title: "Andrej Karpathy"
---
# Andrej Karpathy`
    );

    fs.writeFileSync(
      path.join(wikiDir, 'summaries', 'Summary Two.md'),
      `---
type: Summary
title: "Summary Two"
entities:
  persons: ["Andrej Karpathy", "Geoffrey Hinton"]
relationships:
  - personA: "Andrej Karpathy"
    relation: "advised by"
    personB: "Geoffrey Hinton"
---
# Summary Two`
    );

    fs.writeFileSync(path.join(wikiDir, 'index.md'), '# Index\n\n## Connection Map');

    const originalArgv = process.argv;
    process.argv = ['node', 'social-graph.ts', vaultName];

    await import('../../src/social-graph/social-graph.js');

    await new Promise(resolve => setTimeout(resolve, 100));

    const socialGraphPath = path.join(wikiDir, 'social-graph.md');
    expect(fs.existsSync(socialGraphPath)).toBe(true);

    const socialGraphContent = fs.readFileSync(socialGraphPath, 'utf8');
    expect(socialGraphContent).toContain('Andrej Karpathy');
    expect(socialGraphContent).toContain('Geoffrey Hinton');
    expect(socialGraphContent).toContain('advised by');

    const indexContent = fs.readFileSync(path.join(wikiDir, 'index.md'), 'utf8');
    expect(indexContent).toContain('[[social-graph|Social Graph]]');

    process.argv = originalArgv;
  });
});
