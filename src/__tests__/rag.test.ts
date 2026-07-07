import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import * as path from 'path';
import * as fs from 'fs';
import { fileURLToPath } from 'url';
import YAML from 'yaml';
import { ragWiki } from '../commands/rag.js';

import { PassThrough } from 'stream';

// Mock child_process spawn
const spawnMock = vi.fn();
const childMock = {
  on: vi.fn(),
  stdin: new PassThrough(),
  stdout: new PassThrough(),
  stderr: new PassThrough(),
  kill: vi.fn(),
  killed: false,
};

vi.mock('child_process', async () => {
  const actual = await vi.importActual<typeof import('child_process')>('child_process');
  return {
    ...actual,
    spawn: (exec: string, args: string[], opts: any) => {
      spawnMock(exec, args, opts);
      return childMock;
    },
  };
});

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const TEST_WIKI_ROOT = path.resolve(__dirname, '..', '..', 'temp-rag-tests');

describe('rag command tests', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    if (fs.existsSync(TEST_WIKI_ROOT)) {
      fs.rmSync(TEST_WIKI_ROOT, { recursive: true, force: true });
    }
    fs.mkdirSync(TEST_WIKI_ROOT, { recursive: true });
    fs.mkdirSync(path.join(TEST_WIKI_ROOT, 'config'), { recursive: true });
    fs.mkdirSync(path.join(TEST_WIKI_ROOT, 'wiki'), { recursive: true });
    fs.writeFileSync(path.join(TEST_WIKI_ROOT, '.gitignore'), 'node_modules\n', 'utf8');
  });

  afterEach(() => {
    fs.rmSync(TEST_WIKI_ROOT, { recursive: true, force: true });
  });

  it('should write default sse transport settings when no config exists', async () => {
    // Run command with empty flags
    await ragWiki(TEST_WIKI_ROOT, {});

    // 1. Verify config.yaml generation
    const generatedConfigPath = path.join(TEST_WIKI_ROOT, '.rag', 'config.yaml');
    expect(fs.existsSync(generatedConfigPath)).toBe(true);

    const generatedYaml = YAML.parse(fs.readFileSync(generatedConfigPath, 'utf8'));
    expect(generatedYaml.paths.documents_dir).toBe(path.join(TEST_WIKI_ROOT, 'wiki'));
    expect(generatedYaml.paths.data_dir).toBe(path.join(TEST_WIKI_ROOT, '.rag', 'data'));
    expect(generatedYaml.server.transport).toBe('sse');
    expect(generatedYaml.server.host).toBe('127.0.0.1');
    expect(generatedYaml.server.port).toBe(8179);

    // 2. Verify gitignore update
    const gitignoreContent = fs.readFileSync(path.join(TEST_WIKI_ROOT, '.gitignore'), 'utf8');
    expect(gitignoreContent).toContain('.rag');

    // 3. Verify process spawn arguments and environment
    expect(spawnMock).toHaveBeenCalled();
    const [exec, args, opts] = spawnMock.mock.calls[0];
    expect(args).toContain('--transport');
    expect(args).toContain('sse');
    expect(args).toContain('--host');
    expect(args).toContain('127.0.0.1');
    expect(args).toContain('--port');
    expect(args).toContain('8179');
    expect(opts.env.BASE_DIR).toBe(path.join(TEST_WIKI_ROOT, '.rag'));
    expect(opts.env.KNOWLEDGE_RAG_DIR).toBe(path.join(TEST_WIKI_ROOT, '.rag'));
  });

  it('should read config.yml and generate matching config.yaml file', async () => {
    const configYmlContent = `
rag:
  transport: "sse"
  host: "0.0.0.0"
  port: 9000
  rate_limiting:
    enabled: true
    requests_per_minute: 120
    burst: 20
  prometheus:
    enabled: true
    port: 9500
`;
    fs.writeFileSync(path.join(TEST_WIKI_ROOT, 'config', 'config.yml'), configYmlContent, 'utf8');

    await ragWiki(TEST_WIKI_ROOT, {});

    const generatedConfigPath = path.join(TEST_WIKI_ROOT, '.rag', 'config.yaml');
    const generatedYaml = YAML.parse(fs.readFileSync(generatedConfigPath, 'utf8'));
    
    expect(generatedYaml.server.transport).toBe('sse');
    expect(generatedYaml.server.host).toBe('0.0.0.0');
    expect(generatedYaml.server.port).toBe(9000);
    expect(generatedYaml.rate_limiting.requests_per_minute).toBe(120);
    expect(generatedYaml.rate_limiting.burst).toBe(20);
    expect(generatedYaml.prometheus.enabled).toBe(true);
    expect(generatedYaml.prometheus.port).toBe(9500);

    const [exec, args] = spawnMock.mock.calls[0];
    expect(args).toContain('--transport');
    expect(args).toContain('sse');
    expect(args).toContain('--host');
    expect(args).toContain('0.0.0.0');
    expect(args).toContain('--port');
    expect(args).toContain('9000');
  });

  it('should override config.yml options with CLI flags', async () => {
    const configYmlContent = `
rag:
  transport: "sse"
  host: "127.0.0.1"
  port: 8179
  rate_limiting:
    enabled: false
  prometheus:
    enabled: false
`;
    fs.writeFileSync(path.join(TEST_WIKI_ROOT, 'config', 'config.yml'), configYmlContent, 'utf8');

    // Run command with overriding CLI flags
    await ragWiki(TEST_WIKI_ROOT, {
      transport: 'stdio',
      rateLimit: 150,
      prometheusPort: 9090,
      chromadbWal: true
    });

    const generatedConfigPath = path.join(TEST_WIKI_ROOT, '.rag', 'config.yaml');
    const generatedYaml = YAML.parse(fs.readFileSync(generatedConfigPath, 'utf8'));

    expect(generatedYaml.server.transport).toBe('stdio');
    expect(generatedYaml.rate_limiting.requests_per_minute).toBe(150);
    expect(generatedYaml.prometheus.enabled).toBe(true);
    expect(generatedYaml.prometheus.port).toBe(9090);
    expect(generatedYaml.chromadb_wal).toBe(true);

    const [exec, args] = spawnMock.mock.calls[0];
    expect(args).toContain('--transport');
    expect(args).toContain('stdio');
    // stdio transport should NOT append host and port CLI args
    expect(args).not.toContain('--host');
    expect(args).not.toContain('--port');
  });
});
