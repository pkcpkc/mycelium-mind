import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as path from 'path';
import * as fs from 'fs';
import { fileURLToPath } from 'url';
import { runOverviewScript } from '../utils/overview-runner.js';
import { getMockConceptsCloudGraph } from './mock-data.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const TEST_ROOT = path.resolve(__dirname, '..', '..', 'temp-concepts-cloud-script-tests');

describe('Default concepts-cloud.js script tests', () => {
  const wikiPath = path.join(TEST_ROOT, 'TestWiki');
  const wikiDir = path.join(wikiPath, 'wiki');

  beforeEach(() => {
    fs.mkdirSync(TEST_ROOT, { recursive: true });
    fs.mkdirSync(wikiDir, { recursive: true });
    fs.mkdirSync(path.join(wikiDir, 'overviews'), { recursive: true });
  });

  afterEach(() => {
    fs.rmSync(TEST_ROOT, { recursive: true, force: true });
  });

  it('should group concepts and write concept-cloud markdown page correctly', async () => {
    const sessionGraph = getMockConceptsCloudGraph();
    const scriptPath = path.resolve(__dirname, '..', '..', 'library', 'overviews', 'concepts-cloud.js');

    await runOverviewScript(scriptPath, wikiDir, sessionGraph);

    const cloudFile = path.join(wikiDir, 'overviews', 'concepts-cloud.md');
    expect(fs.existsSync(cloudFile)).toBe(true);

    const cloudContent = fs.readFileSync(cloudFile, 'utf8');
    expect(cloudContent).toContain('# Concepts Relation Cloud');
    expect(cloudContent).toContain('Deep Learning');
    expect(cloudContent).toContain('Machine Learning');
  });
});
