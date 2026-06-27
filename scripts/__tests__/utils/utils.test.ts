import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import * as path from 'path';
import * as fs from 'fs';
import { fileURLToPath } from 'url';
import { config } from '../../src/utils/config.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const TEST_ROOT = path.resolve(__dirname, '..', '..', '..', 'temp-utils-vaults');

describe('sanitizeWikilinks', () => {
  it('should extract wikilink targets from text', async () => {
    const { sanitizeWikilinks } = await import('../../src/utils/utils.js');
    const text = 'See [[Alan Turing]] and [[Alan Turing|Turing]] for info.';
    expect(sanitizeWikilinks(text)).toEqual(['Alan Turing']);
  });

  it('should return empty array for null input', async () => {
    const { sanitizeWikilinks } = await import('../../src/utils/utils.js');
    expect(sanitizeWikilinks(null as any)).toEqual([]);
    expect(sanitizeWikilinks('')).toEqual([]);
  });

  it('should handle mixed wikilink formats', async () => {
    const { sanitizeWikilinks } = await import('../../src/utils/utils.js');
    const text = '[[First]] and [[Second|Alias]] and [[Third]]';
    expect(sanitizeWikilinks(text)).toEqual(['First', 'Second', 'Third']);
  });
});

describe('cleanContentBody', () => {
  it('should strip wikilink brackets', async () => {
    const { cleanContentBody } = await import('../../src/utils/utils.js');
    expect(cleanContentBody('Check [[Alan Turing]]')).toBe('Check Alan Turing');
  });

  it('should use alias when present', async () => {
    const { cleanContentBody } = await import('../../src/utils/utils.js');
    expect(cleanContentBody('[[Alan Turing|Turing]] is great')).toBe('Turing is great');
  });

  it('should return empty string for null input', async () => {
    const { cleanContentBody } = await import('../../src/utils/utils.js');
    expect(cleanContentBody(null as any)).toBe('');
  });
});

describe('toSafeFilename and fromSafeFilename', () => {
  it('should keep spaces in safe filename', async () => {
    const { toSafeFilename, fromSafeFilename } = await import('../../src/utils/utils.js');
    expect(toSafeFilename('Alan Turing')).toBe('Alan Turing.md');
    expect(toSafeFilename('  Alan Turing  ')).toBe('Alan Turing.md');
  });

  it('should remove special characters', async () => {
    const { toSafeFilename } = await import('../../src/utils/utils.js');
    expect(toSafeFilename('Test/Name:Here')).toBe('TestNameHere.md');
  });

  it('should parse filename back to title', async () => {
    const { fromSafeFilename } = await import('../../src/utils/utils.js');
    expect(fromSafeFilename('Alan Turing.md')).toBe('Alan Turing');
  });
});

describe('cleanMarkdownResponse', () => {
  it('should strip markdown code block wrappers', async () => {
    const { cleanMarkdownResponse } = await import('../../src/utils/utils.js');
    expect(cleanMarkdownResponse('```markdown\nHello\n```')).toBe('Hello');
  });

  it('should strip plain code block wrappers', async () => {
    const { cleanMarkdownResponse } = await import('../../src/utils/utils.js');
    expect(cleanMarkdownResponse('```\nHello\n```')).toBe('Hello');
  });

  it('should return trimmed text without wrappers', async () => {
    const { cleanMarkdownResponse } = await import('../../src/utils/utils.js');
    expect(cleanMarkdownResponse('  Hello  ')).toBe('Hello');
  });
});

describe('getVaultDir', () => {
  beforeEach(() => {
    config.vaultsRoot = TEST_ROOT;
  });

  it('should resolve vault name from config', async () => {
    const { getVaultDir } = await import('../../src/utils/utils.js');
    const resolved = getVaultDir('TestVault');
    expect(resolved).toBe(path.join(TEST_ROOT, 'TestVault'));
  });

  it('should resolve absolute path directly', async () => {
    const { getVaultDir } = await import('../../src/utils/utils.js');
    const absPath = '/some/absolute/path';
    expect(getVaultDir(absPath)).toBe(absPath);
  });

  it('should resolve relative path if directory exists', async () => {
    const testDir = path.join(TEST_ROOT, 'rel-vault');
    fs.mkdirSync(testDir, { recursive: true });

    const cwd = process.cwd();
    process.chdir(TEST_ROOT);

    try {
      const { getVaultDir } = await import('../../src/utils/utils.js');
      expect(getVaultDir('rel-vault')).toBe(testDir);
    } finally {
      process.chdir(cwd);
    }
  });

  it('should fallback to vaultsRoot for unknown name', async () => {
    const { getVaultDir } = await import('../../src/utils/utils.js');
    expect(getVaultDir('UnknownVault')).toBe(path.join(TEST_ROOT, 'UnknownVault'));
  });

  it('should throw when no vault specified', async () => {
    const originalVaultName = config.vaultName;
    config.vaultName = '';
    try {
      const { getVaultDir } = await import('../../src/utils/utils.js');
      expect(() => getVaultDir()).toThrow('Missing parameter: vault is required.');
    } finally {
      config.vaultName = originalVaultName;
    }
  });
});

describe('getVaultWikiDir', () => {
  beforeEach(() => {
    config.vaultsRoot = TEST_ROOT;
  });

  it('should resolve the correct vault wiki directory path', async () => {
    const { getVaultWikiDir } = await import('../../src/utils/utils.js');
    const resolved = getVaultWikiDir('TestVault');
    expect(resolved).toBe(path.join(TEST_ROOT, 'TestVault', 'wiki'));
  });
});

describe('getAllFrontmatters', () => {
  let wikiDir: string;

  beforeEach(() => {
    wikiDir = path.join(TEST_ROOT, 'FrontmatterTestVault', 'wiki');
    fs.mkdirSync(path.join(wikiDir, 'concepts'), { recursive: true });
  });

  it('should return all frontmatters in a folder', async () => {
    const { getAllFrontmatters } = await import('../../src/utils/utils.js');

    fs.writeFileSync(
      path.join(wikiDir, 'concepts', 'Quantum Computing.md'),
      '---\ntitle: Quantum Computing\ntags: [physics]\n---\nContent',
    );
    fs.writeFileSync(
      path.join(wikiDir, 'concepts', 'Qubits.md'),
      '---\ntitle: Qubits\n---\nContent',
    );

    const frontmatters = await getAllFrontmatters(wikiDir, 'concepts');
    expect(frontmatters.length).toBe(2);
    const titles = frontmatters.map((f) => f.title);
    expect(titles).toContain('Quantum Computing');
    expect(titles).toContain('Qubits');
  });

  it('should filter by keys', async () => {
    const { getAllFrontmatters } = await import('../../src/utils/utils.js');

    fs.writeFileSync(
      path.join(wikiDir, 'concepts', 'Quantum Computing.md'),
      '---\ntitle: Quantum Computing\ntags: [physics]\n---\nContent',
    );
    fs.writeFileSync(
      path.join(wikiDir, 'concepts', 'Qubits.md'),
      '---\ntitle: Qubits\n---\nContent',
    );

    const frontmatters = await getAllFrontmatters(wikiDir, 'concepts', ['tags']);
    expect(frontmatters.length).toBe(1);
    expect(frontmatters[0].title).toBe('Quantum Computing');
  });

  it('should skip index.md files', async () => {
    // Clean up first to avoid contamination from other tests
    const conceptDir = path.join(wikiDir, 'concepts');
    fs.rmSync(conceptDir, { recursive: true, force: true });
    fs.mkdirSync(conceptDir, { recursive: true });

    const { getAllFrontmatters } = await import('../../src/utils/utils.js');

    fs.writeFileSync(
      path.join(wikiDir, 'concepts', 'index.md'),
      '---\ntitle: Index\n---\nIndex content',
    );

    const frontmatters = await getAllFrontmatters(wikiDir, 'concepts');
    expect(frontmatters.length).toBe(0);
  });

  it('should handle empty directory', async () => {
    const { getAllFrontmatters } = await import('../../src/utils/utils.js');
    const frontmatters = await getAllFrontmatters(wikiDir, 'nonexistent');
    expect(frontmatters).toEqual([]);
  });
});

describe('rebuildFolderIndex', () => {
  it('should create index.md with sorted entries', async () => {
    const { rebuildFolderIndex } = await import('../../src/utils/utils.js');

    const folderPath = path.join(TEST_ROOT, 'index-test', 'wiki', 'concepts');
    fs.mkdirSync(folderPath, { recursive: true });

    fs.writeFileSync(
      path.join(folderPath, 'B Concept.md'),
      '---\ntitle: Beta Concept\ndescription: Second concept\n---\nContent',
    );
    fs.writeFileSync(
      path.join(folderPath, 'A Concept.md'),
      '---\ntitle: Alpha Concept\n---\nContent',
    );

    rebuildFolderIndex(path.join(TEST_ROOT, 'index-test', 'wiki'), 'concepts', 'Concepts');

    const indexPath = path.join(folderPath, 'index.md');
    expect(fs.existsSync(indexPath)).toBe(true);

    const content = fs.readFileSync(indexPath, 'utf8');
    expect(content).toContain('Alpha Concept');
    expect(content).toContain('Beta Concept');
  });

  it('should sort persons index by last name', async () => {
    const { rebuildFolderIndex } = await import('../../src/utils/utils.js');

    const folderPath = path.join(TEST_ROOT, 'index-test-persons', 'wiki', 'persons');
    fs.mkdirSync(folderPath, { recursive: true });

    fs.writeFileSync(
      path.join(folderPath, 'Donald Tusk.md'),
      '---\ntitle: Donald Tusk\n---\nContent',
    );
    fs.writeFileSync(
      path.join(folderPath, 'Jan Kees Martijn.md'),
      '---\ntitle: Jan Kees Martijn\n---\nContent',
    );

    rebuildFolderIndex(path.join(TEST_ROOT, 'index-test-persons', 'wiki'), 'persons', 'Persons');

    const indexPath = path.join(folderPath, 'index.md');
    expect(fs.existsSync(indexPath)).toBe(true);

    const content = fs.readFileSync(indexPath, 'utf8');
    
    const lines = content.split('\n').filter(l => l.startsWith('*'));
    expect(lines[0]).toContain('Jan Kees Martijn');
    expect(lines[1]).toContain('Donald Tusk');
  });

  it('should handle missing directory gracefully', async () => {
    const { rebuildFolderIndex } = await import('../../src/utils/utils.js');
    expect(() =>
      rebuildFolderIndex(path.join(TEST_ROOT, 'nonexistent'), 'concepts', 'Concepts'),
    ).not.toThrow();
  });
});
