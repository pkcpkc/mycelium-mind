import { describe, it, expect } from 'vitest';
import { rewriteMarkdownLinks, findFuzzyMatch } from '../core/link-rewriter.js';

describe('Link Rewriter Tests', () => {
  const fileMap: Record<string, string> = {
    'andrej karpathy': 'collections/persons/Andrej Karpathy.md',
    'deep learning': 'collections/concepts/Deep Learning.md',
    'index': 'index.md',
    'summaries': 'summaries/index.md',
    'overviews/timeline': 'overviews/timeline.md',
  };

  it('should find exact and fuzzy matches from fileMap', () => {
    expect(findFuzzyMatch('andrej karpathy', fileMap)).toBe('collections/persons/Andrej Karpathy.md');
    expect(findFuzzyMatch('deep learning', fileMap)).toBe('collections/concepts/Deep Learning.md');
    expect(findFuzzyMatch('nonexistent-target', fileMap)).toBeNull();
  });

  it('should rewrite simple wikilinks to relative markdown links', () => {
    const content = 'Check out [[Andrej Karpathy]] for details.';
    const filePath = '/path/to/docs/summaries/MySummary.md';
    const docsDir = '/path/to/docs';

    const rewritten = rewriteMarkdownLinks(content, filePath, docsDir, fileMap);
    expect(rewritten).toBe('Check out [Andrej Karpathy](../collections/persons/Andrej Karpathy.md) for details.');
  });

  it('should rewrite aliased wikilinks preserving custom label', () => {
    const content = 'Check out [[Andrej Karpathy|Karpathy]] and [[Deep Learning|DL]].';
    const filePath = '/path/to/docs/index.md';
    const docsDir = '/path/to/docs';

    const rewritten = rewriteMarkdownLinks(content, filePath, docsDir, fileMap);
    expect(rewritten).toBe('Check out [Karpathy](collections/persons/Andrej Karpathy.md) and [DL](collections/concepts/Deep Learning.md).');
  });

  it('should preserve standard markdown external links unchanged', () => {
    const content = 'Visit [OpenAI](https://openai.com) or [Email](mailto:test@example.com).';
    const filePath = '/path/to/docs/index.md';
    const docsDir = '/path/to/docs';

    const rewritten = rewriteMarkdownLinks(content, filePath, docsDir, fileMap);
    expect(rewritten).toBe(content);
  });
});
