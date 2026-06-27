import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import * as path from 'path';
import * as fs from 'fs';
import { fileURLToPath } from 'url';
import { config } from '../../src/utils/config.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const TEST_ROOT = path.resolve(__dirname, '..', '..', '..', 'temp-concepts-vaults');

describe('concepts-cloud.ts Tests', () => {
  const vaultName = 'ConceptsTestVault';
  const wikiDir = path.join(TEST_ROOT, vaultName, 'wiki');

  beforeEach(() => {
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

  it('should generate concepts-cloud.md with nodes, edges, mermaid fallback, and shared tags table', async () => {
    // 1. Create a few concept files with overlapping tags
    fs.writeFileSync(
      path.join(wikiDir, 'concepts', 'Backpropagation.md'),
      `---
type: Concept
title: "Backpropagation"
tags:
  - deep-learning
  - neural-networks
  - optimization
---
# Backpropagation`
    );

    fs.writeFileSync(
      path.join(wikiDir, 'concepts', 'Deep Learning.md'),
      `---
type: Concept
title: "Deep Learning"
tags:
  - deep-learning
  - machine-learning
  - optimization
---
# Deep Learning`
    );

    fs.writeFileSync(
      path.join(wikiDir, 'concepts', 'Transformer.md'),
      `---
type: Concept
title: "Transformer"
tags:
  - nlp
  - deep-learning
---
# Transformer`
    );

    fs.writeFileSync(path.join(wikiDir, 'index.md'), '# Index\n\n## Connection Map');

    const originalArgv = process.argv;
    process.argv = ['node', 'concepts-cloud.ts', vaultName];

    // Import the script to execute it
    await import('../../src/concepts-cloud/concepts-cloud.js');

    // Give it a brief moment to finish async operations
    await new Promise(resolve => setTimeout(resolve, 100));

    const cloudPath = path.join(wikiDir, 'concepts-cloud.md');
    expect(fs.existsSync(cloudPath)).toBe(true);

    const cloudContent = fs.readFileSync(cloudPath, 'utf8');

    // Should contain Cytoscape container and link to fullscreen
    expect(cloudContent).toContain('<div id="cy"></div>');
    expect(cloudContent).toContain('[[concepts-cloud-fullscreen|Open Fullscreen Interactive Graph ↗]]');

    // Verify fullscreen file exists and is populated
    const fullscreenPath = path.join(wikiDir, 'concepts-cloud-fullscreen.md');
    expect(fs.existsSync(fullscreenPath)).toBe(true);
    const fullscreenContent = fs.readFileSync(fullscreenPath, 'utf8');
    expect(fullscreenContent).toContain('<div id="cy-fullscreen"></div>');
    expect(fullscreenContent).toContain('[[concepts-cloud|← Back to Concepts Cloud]]');

    // Should contain the Shared Tags Registry table
    expect(cloudContent).toContain('| Concept A | Shared Tags | Concept B |');
    expect(cloudContent).toContain('[[Backpropagation]]');
    expect(cloudContent).toContain('[[Deep Learning]]');
    expect(cloudContent).not.toContain('[[Transformer]]');

    // Verify index.md was updated
    const indexContent = fs.readFileSync(path.join(wikiDir, 'index.md'), 'utf8');
    expect(indexContent).toContain('[[concepts-cloud|Concepts Cloud]]');

    process.argv = originalArgv;
  });
});
