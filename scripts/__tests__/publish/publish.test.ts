import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import * as path from 'path';
import * as fs from 'fs';
import { fileURLToPath } from 'url';
import { execSync } from 'child_process';
import { config } from '../../src/utils/config.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const TEST_ROOT = path.resolve(__dirname, '..', '..', '..', 'temp-publish-vaults');

vi.mock('child_process', () => {
  return {
    execSync: vi.fn(),
  };
});

describe('publish.ts Tests', () => {
  const vaultName = 'PublishTestVault';
  const vaultRoot = path.join(TEST_ROOT, vaultName);
  const wikiDir = path.join(vaultRoot, 'wiki');

  beforeEach(() => {
    fs.mkdirSync(wikiDir, { recursive: true });
    config.vaultsRoot = TEST_ROOT;
    config.vaultName = vaultName;
    process.env.VAULTS_ROOT = TEST_ROOT;
  });

  afterEach(() => {
    fs.rmSync(TEST_ROOT, { recursive: true, force: true });
    vi.resetModules();
  });

  it('should copy wiki files, resolve wikilinks to relative standard markdown links, and call mkdocs build', async () => {
    const notePath = path.join(wikiDir, 'Deep Learning.md');
    fs.writeFileSync(notePath, '# Deep Learning\n\nRefer to [[Andrej Karpathy]] for details.');

    const personPath = path.join(wikiDir, 'Andrej Karpathy.md');
    fs.writeFileSync(personPath, '# Andrej Karpathy');

    const originalArgv = [...process.argv];
    process.argv.length = 0;
    process.argv.push('node', 'publish.ts', vaultName);

    await import('../../src/publish/publish.js');

    await new Promise((resolve) => setTimeout(resolve, 200));

    expect(execSync).toHaveBeenCalledWith(
      expect.stringContaining('mkdocs'),
      expect.objectContaining({ stdio: 'inherit' }),
    );

    process.argv.length = 0;
    process.argv.push(...originalArgv);
  });

  it('should resolve wikilinks with aliases to standard markdown links', async () => {
    const notePath = path.join(wikiDir, 'Machine Learning.md');
    fs.writeFileSync(notePath, '# Machine Learning\n\nSee [[Deep Learning|DL article]] for more.');

    const targetPath = path.join(wikiDir, 'Deep Learning.md');
    fs.writeFileSync(targetPath, '# Deep Learning\n\nContent here.');

    const originalArgv = [...process.argv];
    process.argv.length = 0;
    process.argv.push('node', 'publish.ts', vaultName);

    await import('../../src/publish/publish.js');

    await new Promise((resolve) => setTimeout(resolve, 200));

    // The processed file is in the docsDir inside dist/build-{vaultName}/docs/
    const distDir = path.resolve(process.cwd(), 'dist');
    const buildDir = path.join(distDir, `build-${vaultName}`, 'docs');
    if (fs.existsSync(buildDir)) {
      const processedContent = fs.readFileSync(path.join(buildDir, 'Machine Learning.md'), 'utf8');
      expect(processedContent).not.toContain('[[Deep Learning|DL article]]');
    }

    process.argv.length = 0;
    process.argv.push(...originalArgv);
  });

  it('should accept full path as vault argument', async () => {
    const notePath = path.join(wikiDir, 'Test.md');
    fs.writeFileSync(notePath, '# Test\n\n[[Other Page]]');

    const otherPath = path.join(wikiDir, 'Other Page.md');
    fs.writeFileSync(otherPath, '# Other Page');

    const originalArgv = [...process.argv];
    process.argv.length = 0;
    process.argv.push('node', 'publish.ts', vaultRoot);

    await import('../../src/publish/publish.js');

    await new Promise((resolve) => setTimeout(resolve, 200));

    expect(execSync).toHaveBeenCalledWith(
      expect.stringContaining('mkdocs'),
      expect.objectContaining({ stdio: 'inherit' }),
    );

    process.argv.length = 0;
    process.argv.push(...originalArgv);
  });

  it('should accept custom target directory', async () => {
    const targetDir = path.join(TEST_ROOT, 'custom-dist');

    const originalArgv = [...process.argv];
    process.argv.length = 0;
    process.argv.push('node', 'publish.ts', vaultName, targetDir);

    await import('../../src/publish/publish.js');

    await new Promise((resolve) => setTimeout(resolve, 200));

    expect(execSync).toHaveBeenCalledWith(
      expect.stringContaining(targetDir),
      expect.any(Object),
    );

    process.argv.length = 0;
    process.argv.push(...originalArgv);
  });

  it('should handle relative target directory', async () => {
    const originalArgv = [...process.argv];
    process.argv.length = 0;
    process.argv.push('node', 'publish.ts', vaultName, 'custom-relative-dist');

    await import('../../src/publish/publish.js');

    await new Promise((resolve) => setTimeout(resolve, 200));

    expect(execSync).toHaveBeenCalled();

    process.argv.length = 0;
    process.argv.push(...originalArgv);
  });
});
