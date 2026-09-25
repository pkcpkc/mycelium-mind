import * as fs from 'fs';
import * as path from 'path';
import { describe, it, expect, vi } from 'vitest';
import {
  parseSchemaProperties,
  deduplicateEntityTasks,
  EntityCompileTask,
  filterCompanionFiles,
  sanitizeYamlString,
  repairFrontmatterWithLLM,
  synthesizeSummary
} from '../core/compiler-engine.js';
import { loadIngestionSettings } from '../utils/config.js';
import { extractArchivedAsset } from '../core/asset-extractor.js';
import { callAgenticModel } from '../utils/openai-api.js';

vi.mock('../utils/openai-api.js', () => ({
  callAgenticModel: vi.fn(),
  isNonRecoverableError: vi.fn(() => false),
}));

describe('Compiler Engine Unit Tests', () => {
  it('should strip $meta and extract clean YAML properties schema', () => {
    const rawSchema = `
$meta:
  type: Schema
  title: Test Schema
  description: A test schema

name: string # String | Required | The entity name
age: integer # Integer | Optional | The entity age
tags:
  - string # Array | Optional | List of tags
`;

    const clean = parseSchemaProperties(rawSchema);
    expect(clean).not.toContain('$meta');
    expect(clean).toContain('name: string');
    expect(clean).toContain('age: integer');
  });

  it('should gracefully handle empty or malformed YAML', () => {
    expect(parseSchemaProperties('')).toBe('');
  });

  it('should deduplicate entities across multiple summaries', () => {
    const tasks: EntityCompileTask[] = [
      { schemaName: 'concepts', entityName: 'Artificial Intelligence', summaryContent: 'Content 1', summaryPath: '/wiki/summaries/doc1.md' },
      { schemaName: 'concepts', entityName: 'artificial intelligence', summaryContent: 'Content 2', summaryPath: '/wiki/summaries/doc2.md' },
      { schemaName: 'persons', entityName: 'Paul Hackenberger', summaryContent: 'Content 3', summaryPath: '/wiki/summaries/doc1.md' },
      { schemaName: 'concepts', entityName: 'Artificial Intelligence', summaryContent: 'Content 1', summaryPath: '/wiki/summaries/doc1.md' }, // Duplicate from doc1
    ];

    const grouped = deduplicateEntityTasks(tasks);
    expect(grouped.length).toBe(2);

    const aiGroup = grouped.find(g => g.schemaName === 'concepts');
    expect(aiGroup).toBeDefined();
    expect(aiGroup?.sources.length).toBe(2);
    expect(aiGroup?.sources[0].summaryTitle).toBe('doc1');
    expect(aiGroup?.sources[1].summaryTitle).toBe('doc2');

    const paulGroup = grouped.find(g => g.schemaName === 'persons');
    expect(paulGroup).toBeDefined();
    expect(paulGroup?.sources.length).toBe(1);
  });

  it('should collect all unique sources for an entity', () => {
    const tasks: EntityCompileTask[] = Array.from({ length: 12 }, (_, i) => ({
      schemaName: 'concepts',
      entityName: 'Cloud Computing',
      summaryContent: `Content ${i + 1}`,
      summaryPath: `/wiki/summaries/doc_${i + 1}.md`
    }));

    const grouped = deduplicateEntityTasks(tasks);
    expect(grouped.length).toBe(1);
    expect(grouped[0].sources.length).toBe(12);
  });

  it('should pair companion markdown files with binary assets in filterCompanionFiles', () => {
    const fileList = [
      'paper.pdf',
      'paper.md', // companion to paper.pdf
      'photo.PNG',
      'photo.md', // companion to photo.PNG
      'notes.md', // standalone markdown
      'data.txt',
    ];

    const { filesToProcess, mdFiles } = filterCompanionFiles(fileList);
    expect(filesToProcess).toEqual(['paper.pdf', 'photo.PNG', 'notes.md', 'data.txt']);
    expect(mdFiles).toEqual(['paper.md', 'photo.md', 'notes.md']);
  });

  it('should parse ingestion configuration with fallbacks in loadIngestionSettings', () => {
    const tempDir = path.join(process.cwd(), 'temp-config-test');
    const configDir = path.join(tempDir, 'config');
    fs.mkdirSync(configDir, { recursive: true });

    // 1. Default fallback when no config.yml exists
    const defaultSettings = loadIngestionSettings(tempDir);
    expect(defaultSettings.concurrency).toBe(4);
    expect(defaultSettings.inboxChunkSize).toBe(10);
    expect(defaultSettings.maxSummariesPerEntity).toBe(5);

    // 2. Custom values from config.yml
    fs.writeFileSync(
      path.join(configDir, 'config.yml'),
      'ingestion:\n  concurrency: 6\n  inbox_chunk_size: 15\n  max_summaries_per_entity: 8\n',
      'utf8'
    );
    const customSettings = loadIngestionSettings(tempDir);
    expect(customSettings.concurrency).toBe(6);
    expect(customSettings.inboxChunkSize).toBe(15);
    expect(customSettings.maxSummariesPerEntity).toBe(8);

    // 3. parallelPromptExecution: false overrides concurrency to 1
    fs.writeFileSync(
      path.join(configDir, 'config.yml'),
      'parallelPromptExecution: false\n',
      'utf8'
    );
    const serialSettings = loadIngestionSettings(tempDir);
    expect(serialSettings.concurrency).toBe(1);

    fs.rmSync(tempDir, { recursive: true, force: true });
  });

  it('should extract archived assets cleanly during resync', () => {
    const tempDir = path.join(process.cwd(), 'temp-archived-asset-test');
    const processedDir = path.join(tempDir, 'processed');
    const sourcesDir = path.join(tempDir, 'sources');
    fs.mkdirSync(processedDir, { recursive: true });
    fs.mkdirSync(sourcesDir, { recursive: true });

    // Write mock asset files
    fs.writeFileSync(path.join(processedDir, 'document.pdf'), 'PDF bytes', 'utf8');
    fs.writeFileSync(path.join(sourcesDir, 'document_transcription.txt'), 'Transcribed PDF text', 'utf8');
    fs.writeFileSync(path.join(processedDir, 'document.md'), 'Companion note metadata', 'utf8');

    const result = extractArchivedAsset(
      'document.pdf',
      { processedPath: processedDir, sourcesPath: sourcesDir, dateFolder: '20260820-120000' },
      ['document.md']
    );

    expect(result.rawText).toBe('Transcribed PDF text');
    expect(result.companionMetadata).toBe('Companion note metadata');
    expect(result.referencedAssets).toContain('wiki/assets/20260820-120000/processed/document.pdf');
    expect(result.referencedAssets).toContain('wiki/assets/20260820-120000/sources/document_transcription.txt');
    expect(result.referencedAssets).toContain('wiki/assets/20260820-120000/processed/document.md');

    fs.rmSync(tempDir, { recursive: true, force: true });
  });

  describe('Frontmatter Sanitization & LLM Repair', () => {
    it('should sanitize YAML string removing code fences and delimiters', () => {
      const raw = '```yaml\n---\ntitle: Test\nstatus: active\n---\n```';
      const clean = sanitizeYamlString(raw);
      expect(clean).toBe('title: Test\nstatus: active');
    });

    it('should successfully repair malformed frontmatter via LLM', async () => {
      const brokenYaml = `
findings:
  - "Constitutional Court declaring tax court reforms as adequate progress"
  "Magistrate recruitment continuing at a good pace"
`;
      const repairedYaml = `
findings:
  - "Constitutional Court declaring tax court reforms as adequate progress"
  - "Magistrate recruitment continuing at a good pace"
`;

      vi.mocked(callAgenticModel).mockResolvedValueOnce(repairedYaml);

      const parsed = await repairFrontmatterWithLLM(brokenYaml, 'All mapping items must start at the same column');
      expect(parsed).toBeDefined();
      expect(parsed.findings).toHaveLength(2);
      expect(parsed.findings[0]).toBe('Constitutional Court declaring tax court reforms as adequate progress');
      expect(parsed.findings[1]).toBe('Magistrate recruitment continuing at a good pace');
      expect(callAgenticModel).toHaveBeenCalledTimes(1);
    });

    it('should fallback to empty object if LLM repair fails all attempts', async () => {
      vi.mocked(callAgenticModel).mockResolvedValue('still: invalid: yaml: :::');

      const parsed = await repairFrontmatterWithLLM('broken', 'syntax error', 2);
      expect(parsed).toEqual({});
    });

    it('should self-heal in synthesizeSummary when LLM initially produces invalid YAML frontmatter', async () => {
      // First LLM call: generates full summary with broken frontmatter (missing list dash bullet)
      const brokenSummaryResponse = `---
title: "2025 Rule of Law Report Hungary"
findings:
  - "Constitutional Court declaring tax court reforms as adequate progress"
  "Magistrate recruitment continuing at a good pace with 578 new ordinary judges"
---
# 2025 Rule of Law Report Hungary

The European Commission published its annual Rule of Law report.`;

      // Second LLM call: repairFrontmatterWithLLM generates fixed YAML
      const repairedYamlResponse = "```yaml\n" +
        'title: "2025 Rule of Law Report Hungary"\n' +
        'findings:\n' +
        '  - "Constitutional Court declaring tax court reforms as adequate progress"\n' +
        '  - "Magistrate recruitment continuing at a good pace with 578 new ordinary judges"\n' +
        "```";

      vi.mocked(callAgenticModel)
        .mockResolvedValueOnce(brokenSummaryResponse)
        .mockResolvedValueOnce(repairedYamlResponse);

      const result = await synthesizeSummary(
        'Raw source text of Hungary report',
        undefined,
        '2025 Rule of Law Report Hungary',
        'Summarize this document with schema',
        ['wiki/assets/20260705-000000/sources/EU Commission (2025) 2025 Rule of Law Report Hungary.md']
      );

      expect(result.frontmatter.title).toBe('2025 Rule of Law Report Hungary');
      expect(result.frontmatter.type).toBe('Summary');
      expect((result.frontmatter as any).findings).toHaveLength(2);
      expect((result.frontmatter as any).findings[1]).toBe('Magistrate recruitment continuing at a good pace with 578 new ordinary judges');
      expect(result.bodyContent).toContain('# 2025 Rule of Law Report Hungary');
      expect(result.fullMarkdown).toContain('Magistrate recruitment continuing at a good pace');
    });
  });
});




