import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import * as path from 'path';
import * as fs from 'fs';
import { fileURLToPath } from 'url';
import { config } from '../src/utils/config.js';
import { callAgenticModel } from '../src/utils/llm.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const TEST_ROOT = path.resolve(__dirname, '..', '..', 'temp-entity-vaults');

vi.mock('../src/utils/llm.js', () => ({
  callAgenticModel: vi.fn(() => Promise.resolve('# Mocked Content')),
}));

function setupScript(argvArgs: string[]) {
  const originalArgv = [...process.argv];
  process.argv.length = 0;
  process.argv.push('node', 'entity.ts', ...argvArgs);
  return originalArgv;
}

function restoreArgv(originalArgv: string[]) {
  process.argv.length = 0;
  process.argv.push(...originalArgv);
}

async function importEntityScript(type: 'person' | 'concept') {
  if (type === 'person') {
    await import('../src/persons/persons.js');
  } else {
    await import('../src/concepts/concepts.js');
  }
  if ((globalThis as any).__entityScriptPromise) {
    await (globalThis as any).__entityScriptPromise;
    delete (globalThis as any).__entityScriptPromise;
  }
}

describe('Entity script tests', () => {
  const vaultName = 'EntityTestVault';
  const vaultRoot = path.join(TEST_ROOT, vaultName);
  const wikiDir = path.join(vaultRoot, 'wiki');

  beforeEach(() => {
    fs.mkdirSync(wikiDir, { recursive: true });
    process.env.VAULTS_ROOT = TEST_ROOT;
    process.env.VAULT_NAME = vaultName;
    config.vaultsRoot = TEST_ROOT;
    config.vaultName = vaultName;
  });

  afterEach(() => {
    fs.rmSync(TEST_ROOT, { recursive: true, force: true });
    vi.resetModules();
  });

  describe('person entity generation', () => {
    it('should generate a person biography card and update index', async () => {
      const summariesDir = path.join(wikiDir, 'summaries');
      fs.mkdirSync(summariesDir, { recursive: true });
      const summaryPath = path.join(summariesDir, 'test-summary.md');
      fs.writeFileSync(summaryPath, '# Test Summary\n\nThis is about Alan Turing.');

      const schemaDir = path.join(TEST_ROOT, vaultName, 'schemas');
      fs.mkdirSync(schemaDir, { recursive: true });
      fs.writeFileSync(path.join(schemaDir, 'person.md'), '# Person Schema\n- Name: $NAME');

      const originalArgv = setupScript([vaultName, 'Alan Turing', summaryPath]);
      await importEntityScript('person');

      const entityPath = path.join(wikiDir, 'persons', 'Alan Turing.md');
      expect(fs.existsSync(entityPath)).toBe(true);

      const indexContent = fs.readFileSync(path.join(wikiDir, 'persons', 'index.md'), 'utf8');
      expect(indexContent).toContain('Alan Turing');

      expect(callAgenticModel).toHaveBeenCalled();
      restoreArgv(originalArgv);
    });

    it('should fail with missing person name', async () => {
      const spy = vi.spyOn(process, 'exit').mockImplementation(() => {
        throw new Error('exit');
      });

      const originalArgv = setupScript([vaultName]);
      await expect(importEntityScript('person')).rejects.toThrow('exit');

      spy.mockRestore();
      restoreArgv(originalArgv);
    });
  });

  describe('concept entity generation', () => {
    it('should generate a concept card and update index', async () => {
      const summariesDir = path.join(wikiDir, 'summaries');
      fs.mkdirSync(summariesDir, { recursive: true });
      const summaryPath = path.join(summariesDir, 'test-concept-summary.md');
      fs.writeFileSync(summaryPath, '# Test Summary\n\nThis is about Quantum Computing.');

      const schemaDir = path.join(TEST_ROOT, vaultName, 'schemas');
      fs.mkdirSync(schemaDir, { recursive: true });
      fs.writeFileSync(path.join(schemaDir, 'concept.md'), '# Concept Schema\n- Name: $NAME');

      const originalArgv = setupScript([vaultName, 'Quantum Computing', summaryPath]);
      await importEntityScript('concept');

      const entityPath = path.join(wikiDir, 'concepts', 'Quantum Computing.md');
      expect(fs.existsSync(entityPath)).toBe(true);

      const indexContent = fs.readFileSync(path.join(wikiDir, 'concepts', 'index.md'), 'utf8');
      expect(indexContent).toContain('Quantum Computing');

      expect(callAgenticModel).toHaveBeenCalled();
      restoreArgv(originalArgv);
    });

    it('should fail with missing concept name', async () => {
      const spy = vi.spyOn(process, 'exit').mockImplementation(() => {
        throw new Error('exit');
      });

      const originalArgv = setupScript([vaultName]);
      await expect(importEntityScript('concept')).rejects.toThrow('exit');

      spy.mockRestore();
      restoreArgv(originalArgv);
    });
  });

  describe('entity script with path argument', () => {
    it('should accept a full path to the vault', async () => {
      const summariesDir = path.join(wikiDir, 'summaries');
      fs.mkdirSync(summariesDir, { recursive: true });
      const summaryPath = path.join(summariesDir, 'path-test-summary.md');
      fs.writeFileSync(summaryPath, '# Path Test\n\nTesting with full path.');

      const schemaDir = path.join(TEST_ROOT, vaultName, 'schemas');
      fs.mkdirSync(schemaDir, { recursive: true });
      fs.writeFileSync(path.join(schemaDir, 'concept.md'), '# Concept Schema\n- Name: $NAME');

      const originalArgv = setupScript([vaultRoot, 'Path Concept', summaryPath]);
      await importEntityScript('concept');

      const entityPath = path.join(wikiDir, 'concepts', 'Path Concept.md');
      expect(fs.existsSync(entityPath)).toBe(true);

      restoreArgv(originalArgv);
    });

    it('should accept a relative path to the vault', async () => {
      const summariesDir = path.join(wikiDir, 'summaries');
      fs.mkdirSync(summariesDir, { recursive: true });
      const summaryPath = path.join(summariesDir, 'rel-test-summary.md');
      fs.writeFileSync(summaryPath, '# Relative Path Test\n\nTesting with relative path.');

      const schemaDir = path.join(TEST_ROOT, vaultName, 'schemas');
      fs.mkdirSync(schemaDir, { recursive: true });
      fs.writeFileSync(path.join(schemaDir, 'concept.md'), '# Concept Schema\n- Name: $NAME');

      const relativePath = path.relative(process.cwd(), vaultRoot);
      const originalArgv = setupScript([relativePath, 'Relative Concept', summaryPath]);
      await importEntityScript('concept');

      const entityPath = path.join(wikiDir, 'concepts', 'Relative Concept.md');
      expect(fs.existsSync(entityPath)).toBe(true);

      restoreArgv(originalArgv);
    });
  });
});
