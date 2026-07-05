import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import * as path from 'path';
import * as fs from 'fs';
import { fileURLToPath } from 'url';
import { initWiki } from '../commands/init.js';
import { contradictionsWiki, extractContradictions } from '../commands/contradictions.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const TEST_ROOT = path.resolve(__dirname, '..', '..', 'temp-contradictions-tests-vaults');

describe('Wiki Contradictions Command Tests', () => {
  const wikiPath = path.join(TEST_ROOT, 'TestWiki');

  beforeEach(() => {
    fs.mkdirSync(TEST_ROOT, { recursive: true });
  });

  afterEach(() => {
    fs.rmSync(TEST_ROOT, { recursive: true, force: true });
    vi.clearAllMocks();
  });

  describe('extractContradictions parser unit tests', () => {
    it('should extract content under any heading level matching Contradictions', () => {
      const doc1 = `---
title: "Test"
---
# Test Document
## Contradictions
- Fact X contradicts Fact Y.
- Fact Z is incompatible.
`;
      const result = extractContradictions(doc1);
      expect(result).toBe('- Fact X contradicts Fact Y.\n- Fact Z is incompatible.');

      const doc2 = `---
title: "Test"
---
# Test Document
### Contradictions
Here is one.
`;
      const result2 = extractContradictions(doc2);
      expect(result2).toBe('Here is one.');
    });

    it('should terminate extraction at heading of the same or higher level', () => {
      const doc1 = `---
title: "Test"
---
# Test Document
## Contradictions
First contradiction content.
## Another Section
This should not be included.
`;
      const result = extractContradictions(doc1);
      expect(result).toBe('First contradiction content.');

      const doc2 = `---
title: "Test"
---
# Test Document
### Contradictions
Content here.
#### Nested sub-heading
This sub-heading has lower level (higher hashes), so it should be included.
### Next Section
This has same level, so it should terminate here.
`;
      const result2 = extractContradictions(doc2);
      expect(result2).toBe('Content here.\n#### Nested sub-heading\nThis sub-heading has lower level (higher hashes), so it should be included.');
    });

    it('should return null if no Contradictions heading exists', () => {
      const doc = `---
title: "Test"
---
# Test Document
## Summary
Everything is clean here. No issues found.
`;
      const result = extractContradictions(doc);
      expect(result).toBeNull();
    });
  });

  describe('contradictionsWiki command integration tests', () => {
    it('should log contradictions to console when found', async () => {
      await initWiki(wikiPath);

      // Create a collection card with contradictions
      const collectionsDir = path.join(wikiPath, 'wiki', 'collections', 'persons');
      fs.mkdirSync(collectionsDir, { recursive: true });
      fs.writeFileSync(path.join(collectionsDir, 'John_Doe.md'), `---
type: "Person"
title: "John Doe"
---
# John Doe
## Contradictions
- Born in 1980 vs Born in 1982.
## Details
Other details.
`, 'utf8');

      const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
      await contradictionsWiki(wikiPath);

      const loggedOutput = logSpy.mock.calls.map(call => call[0] || '').join('\n');
      expect(loggedOutput).toContain('John_Doe.md');
      expect(loggedOutput).toContain('Born in 1980 vs Born in 1982.');
      expect(loggedOutput).toContain('Found 1 document(s) with contradictions.');

      logSpy.mockRestore();
    });

    it('should print clean message when no contradictions are present', async () => {
      await initWiki(wikiPath);

      const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
      await contradictionsWiki(wikiPath);

      const loggedOutput = logSpy.mock.calls.map(call => call[0] || '').join('\n');
      expect(loggedOutput).toContain('No contradictions found in the wiki folder.');

      logSpy.mockRestore();
    });
  });
});
