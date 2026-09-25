import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import * as path from 'path';
import * as fs from 'fs';
import * as crypto from 'crypto';
import { fileURLToPath } from 'url';
import {
  OpenNotebookClient,
  NotebookItem,
  SourceItem,
} from '../utils/open-notebook-client.js';
import {
  buildOriginUrl,
  parseOriginUrl,
  extractCardTitle,
  loadNotebookConfig,
  resolveTargetNotebook,
  planNotebookSync,
  pushWikiToNotebook,
  listNotebooksCommand,
  statusNotebookCommand,
  createNotebookCommand,
} from '../commands/notebook.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const TEST_VAULT = path.resolve(__dirname, '..', '..', 'temp-notebook-tests-vault');

describe('Open Notebook Integration Tests', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    if (fs.existsSync(TEST_VAULT)) {
      fs.rmSync(TEST_VAULT, { recursive: true, force: true });
    }
    fs.mkdirSync(path.join(TEST_VAULT, 'config'), { recursive: true });
    fs.mkdirSync(path.join(TEST_VAULT, 'wiki', 'collections', 'concepts'), { recursive: true });
    fs.mkdirSync(path.join(TEST_VAULT, 'wiki', 'summaries'), { recursive: true });
  });

  afterEach(() => {
    if (fs.existsSync(TEST_VAULT)) {
      fs.rmSync(TEST_VAULT, { recursive: true, force: true });
    }
  });

  describe('Origin URL & Metadata Helpers', () => {
    it('should build and parse origin URL signatures correctly', () => {
      const relPath = 'wiki/collections/concepts/mycelium.md';
      const hash = 'a1b2c3d4e5f6';
      const url = buildOriginUrl(relPath, hash);
      expect(url).toBe('mycelium://wiki/collections/concepts/mycelium.md#sha256:a1b2c3d4e5f6');

      const parsed = parseOriginUrl(url);
      expect(parsed).toEqual({
        relPath: 'wiki/collections/concepts/mycelium.md',
        sha256: 'a1b2c3d4e5f6',
      });
    });

    it('should normalize Windows backslashes in origin URLs', () => {
      const relPath = 'wiki\\collections\\concepts\\mycelium.md';
      const url = buildOriginUrl(relPath, '12345');
      expect(url).toBe('mycelium://wiki/collections/concepts/mycelium.md#sha256:12345');
    });

    it('should return null for non-mycelium or malformed URLs', () => {
      expect(parseOriginUrl('https://example.com')).toBeNull();
      expect(parseOriginUrl('mycelium://some/file.md')).toBeNull();
      expect(parseOriginUrl(undefined)).toBeNull();
    });

    it('should extract card titles with category prefixes', () => {
      const conceptContent = `---
title: Mycelium Networks
---
# Content here`;
      const title = extractCardTitle(
        path.join(TEST_VAULT, 'wiki/collections/concepts/mycelium.md'),
        'wiki/collections/concepts/mycelium.md',
        conceptContent
      );
      expect(title).toBe('[Concept] Mycelium Networks');

      const summaryContent = `---
title: Research Study 2026
---
Summary text`;
      const summaryTitle = extractCardTitle(
        path.join(TEST_VAULT, 'wiki/summaries/paper.md'),
        'wiki/summaries/paper.md',
        summaryContent
      );
      expect(summaryTitle).toBe('[Summary] Research Study 2026');

      const fallbackTitle = extractCardTitle(
        path.join(TEST_VAULT, 'wiki/collections/concepts/simple-note.md'),
        'wiki/collections/concepts/simple-note.md',
        'No frontmatter'
      );
      expect(fallbackTitle).toBe('[Concept] simple-note');
    });
  });

  describe('OpenNotebookClient Unit Tests', () => {
    it('should check health successfully', async () => {
      const mockFetch = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
      } as any);

      const client = new OpenNotebookClient({
        baseUrl: 'http://localhost:5055',
        fetchFn: mockFetch,
      });

      const isHealthy = await client.checkHealth();
      expect(isHealthy).toBe(true);
      expect(mockFetch).toHaveBeenCalledWith(
        'http://localhost:5055/health',
        expect.objectContaining({ method: 'GET' })
      );
    });

    it('should handle offline server gracefully in checkHealth', async () => {
      const mockFetch = vi.fn().mockRejectedValue(new Error('Connection refused'));

      const client = new OpenNotebookClient({
        baseUrl: 'http://localhost:5055',
        fetchFn: mockFetch,
      });

      const isHealthy = await client.checkHealth();
      expect(isHealthy).toBe(false);
    });

    it('should list notebooks correctly', async () => {
      const notebooks: NotebookItem[] = [
        { id: 'notebook:1', name: 'Notebook One' },
        { id: 'notebook:2', name: 'Notebook Two' },
      ];

      const mockFetch = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => notebooks,
      } as any);

      const client = new OpenNotebookClient({ fetchFn: mockFetch });
      const result = await client.listNotebooks();
      expect(result).toEqual(notebooks);
    });

    it('should create a notebook via POST', async () => {
      const newNotebook: NotebookItem = { id: 'notebook:new', name: 'My New Notebook' };
      const mockFetch = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => newNotebook,
      } as any);

      const client = new OpenNotebookClient({ fetchFn: mockFetch });
      const result = await client.createNotebook('My New Notebook', 'A description');
      expect(result).toEqual(newNotebook);
      expect(mockFetch).toHaveBeenCalledWith(
        'http://localhost:5055/api/notebooks',
        expect.objectContaining({
          method: 'POST',
          body: JSON.stringify({ name: 'My New Notebook', description: 'A description' }),
        })
      );
    });

    it('should list sources and create sources with origin metadata', async () => {
      const mockFetch = vi.fn()
        .mockResolvedValueOnce({
          ok: true,
          status: 200,
          json: async () => [{ id: 'source:1', title: 'Test Source' }],
        } as any)
        .mockResolvedValueOnce({
          ok: true,
          status: 200,
          json: async () => ({ id: 'source:new', title: 'New Source' }),
        } as any)
        .mockResolvedValueOnce({
          ok: true,
          status: 200,
          text: async () => '',
        } as any);

      const client = new OpenNotebookClient({ fetchFn: mockFetch });

      const sources = await client.listSources('notebook:1');
      expect(sources).toHaveLength(1);

      const created = await client.createSource({
        notebookId: 'notebook:1',
        title: 'New Source',
        text: 'Body text',
        url: 'mycelium://file.md#sha256:123',
      });
      expect(created.id).toBe('source:new');
      expect(mockFetch).toHaveBeenCalledWith(
        'http://localhost:5055/api/sources/json',
        expect.objectContaining({
          method: 'POST',
          body: JSON.stringify({
            type: 'text',
            title: 'New Source',
            content: 'Body text',
            notebooks: ['notebook:1'],
            async_processing: false,
            url: 'mycelium://file.md#sha256:123',
          }),
        })
      );

      const deleted = await client.deleteSource('source:1');
      expect(deleted).toBe(true);
    });
  });

  describe('Push & Incremental Sync Engine', () => {
    it('should plan adds, updates, skips, and prunes with stateless origin diffing', async () => {
      // 1. Create local files in vault
      const unchangedFile = path.join(TEST_VAULT, 'wiki/collections/concepts/fungi.md');
      const modifiedFile = path.join(TEST_VAULT, 'wiki/collections/concepts/spores.md');
      const newFile = path.join(TEST_VAULT, 'wiki/collections/concepts/hyphae.md');

      fs.writeFileSync(unchangedFile, '---\ntitle: Fungi\n---\nFungi kingdom content');
      fs.writeFileSync(modifiedFile, '---\ntitle: Spores\n---\nUpdated spore content');
      fs.writeFileSync(newFile, '---\ntitle: Hyphae\n---\nBrand new hyphae content');

      const unchangedHash = crypto.createHash('sha256').update(fs.readFileSync(unchangedFile)).digest('hex');

      // 2. Mock remote sources in Open Notebook
      const mockRemoteSources: SourceItem[] = [
        // Source 1: identical content (should SKIP)
        {
          id: 'source:fungi-id',
          title: '[Concept] Fungi',
          url: buildOriginUrl('wiki/collections/concepts/fungi.md', unchangedHash),
        },
        // Source 2: old content hash (should UPDATE)
        {
          id: 'source:spores-id',
          title: '[Concept] Spores',
          url: buildOriginUrl('wiki/collections/concepts/spores.md', 'outdated-hash-1234'),
        },
        // Source 3: deleted locally (should PRUNE)
        {
          id: 'source:deleted-id',
          title: '[Concept] OldDeletedCard',
          url: buildOriginUrl('wiki/collections/concepts/deleted-card.md', 'some-hash'),
        },
      ];

      const mockFetch = vi.fn().mockImplementation(async (url: string) => {
        if (url.includes('/sources?notebook_id=')) {
          return {
            ok: true,
            status: 200,
            json: async () => mockRemoteSources,
          };
        }
        return { ok: true, status: 200, json: async () => ({}) };
      });

      const client = new OpenNotebookClient({ fetchFn: mockFetch });
      const plan = await planNotebookSync(client, 'notebook:test', TEST_VAULT, { filter: 'all' });

      // Verifications:
      expect(plan.unchanged).toHaveLength(1);
      expect(plan.unchanged[0].relPath).toBe('wiki/collections/concepts/fungi.md');

      expect(plan.toUpdate).toHaveLength(1);
      expect(plan.toUpdate[0].relPath).toBe('wiki/collections/concepts/spores.md');
      expect(plan.toUpdate[0].sourceId).toBe('source:spores-id');

      expect(plan.toAdd).toHaveLength(1);
      expect(plan.toAdd[0].relPath).toBe('wiki/collections/concepts/hyphae.md');

      expect(plan.toPrune).toHaveLength(1);
      expect(plan.toPrune[0].relPath).toBe('wiki/collections/concepts/deleted-card.md');
      expect(plan.toPrune[0].sourceId).toBe('source:deleted-id');
    });

    it('should execute end-to-end push with auto-creation of notebook and delta upload', async () => {
      // Create local file
      const cardPath = path.join(TEST_VAULT, 'wiki/collections/concepts/mycelium.md');
      fs.writeFileSync(cardPath, '---\ntitle: Mycelium\n---\nMycelium description');

      const mockFetch = vi.fn().mockImplementation(async (url: string, opts: any = {}) => {
        const method = opts.method || 'GET';
        if (url.endsWith('/health')) {
          return { ok: true, status: 200 };
        }
        if (url.includes('/api/notebooks') && method === 'GET') {
          return { ok: true, status: 200, json: async () => [] }; // no existing notebooks
        }
        if (url.includes('/api/notebooks') && method === 'POST') {
          const body = JSON.parse(opts.body);
          return { ok: true, status: 200, json: async () => ({ id: 'notebook:auto-created', name: body.name }) };
        }
        if (url.includes('/api/sources') && method === 'GET') {
          return { ok: true, status: 200, json: async () => [] }; // no existing sources
        }
        if (url.includes('/api/sources') && method === 'POST') {
          const body = JSON.parse(opts.body);
          return { ok: true, status: 200, json: async () => ({ id: 'source:created-1', title: body.title }) };
        }
        return { ok: true, status: 200, json: async () => ({}) };
      });

      // Intercept global fetch
      const originalFetch = globalThis.fetch;
      globalThis.fetch = mockFetch;

      try {
        await pushWikiToNotebook(TEST_VAULT, {
          pr: false,
          verbose: false,
          force: false,
        });

        // Notebook was created
        expect(mockFetch).toHaveBeenCalledWith(
          'http://localhost:5055/api/notebooks',
          expect.objectContaining({ method: 'POST' })
        );

        // Source was added
        expect(mockFetch).toHaveBeenCalledWith(
          'http://localhost:5055/api/sources/json',
          expect.objectContaining({
            method: 'POST',
            body: expect.stringContaining('[Concept] Mycelium'),
          })
        );
      } finally {
        globalThis.fetch = originalFetch;
      }
    });

    it('should respect dry-run flag and not perform mutations', async () => {
      const cardPath = path.join(TEST_VAULT, 'wiki/collections/concepts/dry.md');
      fs.writeFileSync(cardPath, '---\ntitle: Dry Run\n---\nContent');

      const mockFetch = vi.fn().mockImplementation(async (url: string, opts: any = {}) => {
        const method = opts.method || 'GET';
        if (url.endsWith('/health')) return { ok: true, status: 200 };
        if (url.includes('/api/notebooks') && method === 'GET') {
          return { ok: true, status: 200, json: async () => [{ id: 'notebook:existing', name: `[MM] ${path.basename(TEST_VAULT)}` }] };
        }
        if (url.includes('/api/sources') && method === 'GET') {
          return { ok: true, status: 200, json: async () => [] };
        }
        if (method === 'POST' || method === 'DELETE') {
          throw new Error(`Mutation should not be called in dry-run: ${method} ${url}`);
        }
        return { ok: true, status: 200, json: async () => ({}) };
      });

      const originalFetch = globalThis.fetch;
      globalThis.fetch = mockFetch;

      try {
        await pushWikiToNotebook(TEST_VAULT, {
          pr: false,
          verbose: false,
          force: false,
          dryRun: true,
        });
      } finally {
        globalThis.fetch = originalFetch;
      }
    });
  });

  describe('Management Commands', () => {
    it('should list notebooks cleanly', async () => {
      const mockFetch = vi.fn().mockImplementation(async (url: string) => {
        if (url.endsWith('/health')) return { ok: true, status: 200 };
        if (url.includes('/api/notebooks')) {
          return {
            ok: true,
            status: 200,
            json: async () => [{ id: 'notebook:1', name: 'Test NB' }],
          };
        }
        if (url.includes('/api/sources')) {
          return { ok: true, status: 200, json: async () => [{ id: 's1' }, { id: 's2' }] };
        }
        return { ok: true, status: 200 };
      });

      const originalFetch = globalThis.fetch;
      globalThis.fetch = mockFetch;

      try {
        await listNotebooksCommand(TEST_VAULT, { pr: false, verbose: false, force: false });
        expect(mockFetch).toHaveBeenCalledWith('http://localhost:5055/api/notebooks', expect.anything());
      } finally {
        globalThis.fetch = originalFetch;
      }
    });

    it('should report status of connection', async () => {
      const mockFetch = vi.fn().mockImplementation(async (url: string) => {
        if (url.endsWith('/health')) return { ok: true, status: 200 };
        if (url.includes('/api/notebooks')) return { ok: true, status: 200, json: async () => [] };
        return { ok: true, status: 200 };
      });

      const originalFetch = globalThis.fetch;
      globalThis.fetch = mockFetch;

      try {
        await statusNotebookCommand(TEST_VAULT, { pr: false, verbose: false, force: false });
        expect(mockFetch).toHaveBeenCalledWith('http://localhost:5055/health', expect.anything());
      } finally {
        globalThis.fetch = originalFetch;
      }
    });

    it('should create a notebook via create command', async () => {
      const mockFetch = vi.fn().mockImplementation(async (url: string, opts: any) => {
        if (url.includes('/api/notebooks') && opts?.method === 'POST') {
          return {
            ok: true,
            status: 200,
            json: async () => ({ id: 'notebook:new123', name: 'Target Notebook' }),
          };
        }
        return { ok: true, status: 200 };
      });

      const originalFetch = globalThis.fetch;
      globalThis.fetch = mockFetch;

      try {
        await createNotebookCommand('Target Notebook', TEST_VAULT, { pr: false, verbose: false, force: false });
        expect(mockFetch).toHaveBeenCalledWith(
          'http://localhost:5055/api/notebooks',
          expect.objectContaining({ method: 'POST' })
        );
      } finally {
        globalThis.fetch = originalFetch;
      }
    });

    it('should test colima and service lifecycle handlers', async () => {
      const {
        isColimaInstalled,
        getColimaStatus,
        resolveDockerComposeCmd,
        getComposeFilePath,
        manageColimaCommand,
      } = await import('../commands/notebook.js');

      expect(typeof isColimaInstalled()).toBe('boolean');
      expect(typeof getColimaStatus()).toBe('object');
      expect(getComposeFilePath()).toContain('open-notebook.docker-compose.yml');

      // Test manageColimaCommand invalid action
      if (isColimaInstalled()) {
        await expect(manageColimaCommand('invalid_action')).rejects.toThrow(/Unknown Colima action/);
      }
    });
  });

  describe('Model Configuration & Auto-Provisioning (Option B)', () => {
    it('should poll in waitForReady until healthy or timed out', async () => {
      let callCount = 0;
      const mockFetch = vi.fn().mockImplementation(async () => {
        callCount++;
        if (callCount < 3) {
          return { ok: false, status: 503 };
        }
        return { ok: true, status: 200 };
      });

      const client = new OpenNotebookClient({ baseUrl: 'http://localhost:5055', fetchFn: mockFetch });
      const ready = await client.waitForReady(1000, 50);
      expect(ready).toBe(true);
      expect(callCount).toBe(3);

      // Test timeout failure
      const alwaysFailingFetch = vi.fn().mockResolvedValue({ ok: false, status: 503 });
      const failingClient = new OpenNotebookClient({ baseUrl: 'http://localhost:5055', fetchFn: alwaysFailingFetch });
      const timedOut = await failingClient.waitForReady(150, 50);
      expect(timedOut).toBe(false);
    });

    it('should support credential CRUD, discovery, and default models API', async () => {
      const mockFetch = vi.fn().mockImplementation(async (url: string, opts: any = {}) => {
        const method = opts.method || 'GET';
        if (url.includes('/discover') && method === 'POST') {
          return { ok: true, status: 200, json: async () => ['gemma-12b', 'text-embedding-3-small'] };
        }
        if (url.includes('/register-models') && method === 'POST') {
          return { ok: true, status: 200, json: async () => ({ status: 'success' }) };
        }
        if (url.includes('/models/defaults') && method === 'GET') {
          return { ok: true, status: 200, json: async () => ({ chat: 'gemma-12b' }) };
        }
        if (url.includes('/models/defaults') && method === 'PUT') {
          return { ok: true, status: 200, json: async () => JSON.parse(opts.body) };
        }
        if (url.includes('/api/credentials') && method === 'GET') {
          return { ok: true, status: 200, json: async () => [{ id: 'cred-1', provider: 'openai', base_url: 'http://localhost:8000/v1' }] };
        }
        if (url.includes('/api/credentials') && method === 'POST') {
          return { ok: true, status: 200, json: async () => ({ id: 'cred-new', provider: 'openai' }) };
        }
        return { ok: true, status: 200, json: async () => ({}) };
      });

      const client = new OpenNotebookClient({ baseUrl: 'http://localhost:5055', fetchFn: mockFetch });

      // List credentials
      const creds = await client.listCredentials();
      expect(creds).toHaveLength(1);

      // Create credential
      const createdCred = await client.createCredential({ provider: 'openai', name: 'Test', key: 'sk-123' });
      expect(createdCred.id).toBe('cred-new');

      // Discover models
      const discovered = await client.discoverModels('cred-1');
      expect(discovered).toEqual(['gemma-12b', 'text-embedding-3-small']);

      // Register models
      const reg = await client.registerModels('cred-1', ['gemma-12b']);
      expect(reg.status).toBe('success');

      // Get & Set default models
      const defs = await client.getDefaultModels();
      expect(defs.chat).toBe('gemma-12b');

      const updated = await client.setDefaultModels({ chat: 'gemma-12b', summary: 'gemma-12b' });
      expect(updated.chat).toBe('gemma-12b');
    });

    it('should resolve models from vault config.yml (Option B) with unconfigured TTS/STT when omitted', async () => {
      const { resolveNotebookModelSettings } = await import('../core/notebook-config.js');

      // 1. Vault config with only chat and embedding (no TTS or STT)
      const configYaml = `
notebook:
  models:
    chat: "custom-chat-model"
    embedding: "custom-embed-model"
`;
      fs.writeFileSync(path.join(TEST_VAULT, 'config', 'config.yml'), configYaml, 'utf8');

      const resolved = resolveNotebookModelSettings(TEST_VAULT);
      expect(resolved.chat.name).toBe('custom-chat-model');
      expect(resolved.summary.name).toBe('custom-chat-model'); // falls back to chat
      expect(resolved.transformation.name).toBe('custom-chat-model'); // falls back to chat
      expect(resolved.embedding?.name).toBe('custom-embed-model');
      expect(resolved.stt).toBeUndefined(); // Per user request: unconfigured if not specified
      expect(resolved.tts).toBeUndefined(); // Per user request: unconfigured if not specified
      expect(resolved.podcast).toBeUndefined();
    });

    it('should resolve models with explicit TTS and STT from config.yml', async () => {
      const { resolveNotebookModelSettings } = await import('../core/notebook-config.js');

      const configYaml = `
notebook:
  models:
    chat: "gemma-12b"
    embedding: "text-embedding-3-small"
    stt: "whisper-1"
    tts: "tts-1"
    podcast: "tts-1"
`;
      fs.writeFileSync(path.join(TEST_VAULT, 'config', 'config.yml'), configYaml, 'utf8');

      const resolved = resolveNotebookModelSettings(TEST_VAULT);
      expect(resolved.chat.name).toBe('gemma-12b');
      expect(resolved.embedding?.name).toBe('text-embedding-3-small');
      expect(resolved.stt?.name).toBe('whisper-1');
      expect(resolved.tts?.name).toBe('tts-1');
      expect(resolved.podcast?.name).toBe('tts-1');
    });

    it('should resolve Open Notebook models directly from single centralized top-level models block without duplication', async () => {
      const { resolveNotebookModelSettings } = await import('../core/notebook-config.js');

      // Top-level models block only (notebook block has no models section)
      const configYaml = `
models:
  base: "agentic"                 # lmstudio-community/Qwen3.6-35B-A3B-MLX-4bit
  ocr: "ocr"                      # DeepSeek-OCR-2-bf16
  image: "agentic"                # lmstudio-community/Qwen3.6-35B-A3B-MLX-4bit
  embedding: "embeddings"         # mlx-community/bge-m3-mlx-fp16
  stt: "stt"                      # mlx-community/whisper-large-v3-turbo
  tts: "tts"                      # mlx-community/Kokoro-82M-bf16
  api_url: "http://127.0.0.1:8000/v1"

notebook:
  target: "[MM] Sovereign Credit Rating"
  url: "http://localhost:5055"
  concurrency: 1
`;
      fs.writeFileSync(path.join(TEST_VAULT, 'config', 'config.yml'), configYaml, 'utf8');

      const resolved = resolveNotebookModelSettings(TEST_VAULT);
      expect(resolved.chat.name).toBe('agentic');
      expect(resolved.summary.name).toBe('agentic');
      expect(resolved.transformation.name).toBe('agentic');
      expect(resolved.embedding?.name).toBe('embeddings');
      expect(resolved.stt?.name).toBe('stt');
      expect(resolved.tts?.name).toBe('tts');
      expect(resolved.podcast?.name).toBe('tts');
      // Automatically bridged for Docker container
      expect(resolved.chat.apiUrl).toBe('http://host.docker.internal:8000/v1');
    });

    it('should respect explicitly configured notebook model API URL verbatim without Docker rewriting', async () => {
      const { resolveNotebookModelSettings } = await import('../core/notebook-config.js');

      const configYaml = `
models:
  base: "agentic"
  api_url: "http://127.0.0.1:8000/v1"

notebook:
  target: "[MM] Sovereign Credit Rating"
  url: "http://localhost:5055"
  model_api_url: "http://127.0.0.1:8000/v1"
`;
      fs.writeFileSync(path.join(TEST_VAULT, 'config', 'config.yml'), configYaml, 'utf8');

      const resolved = resolveNotebookModelSettings(TEST_VAULT);
      expect(resolved.chat.apiUrl).toBe('http://127.0.0.1:8000/v1');
    });

    it('should respect notebook.models.api_url override verbatim', async () => {
      const { resolveNotebookModelSettings } = await import('../core/notebook-config.js');

      const configYaml = `
models:
  base: "agentic"
  api_url: "http://127.0.0.1:8000/v1"

notebook:
  url: "http://localhost:5055"
  models:
    chat: "custom-chat"
    api_url: "http://192.168.1.100:8000/v1"
`;
      fs.writeFileSync(path.join(TEST_VAULT, 'config', 'config.yml'), configYaml, 'utf8');

      const resolved = resolveNotebookModelSettings(TEST_VAULT);
      expect(resolved.chat.name).toBe('custom-chat');
      expect(resolved.chat.apiUrl).toBe('http://192.168.1.100:8000/v1');
    });

    it('should auto-configure models, reuse existing credentials, and set defaults', async () => {
      const { configureNotebookModels } = await import('../core/notebook-config.js');

      const configYaml = `
notebook:
  models:
    chat: "gemma-12b"
    embedding: "text-embedding-3-small"
    stt: "whisper-1"
    tts: "tts-1"
`;
      fs.writeFileSync(path.join(TEST_VAULT, 'config', 'config.yml'), configYaml, 'utf8');

      let defaultModelsPayload: any = null;
      let registeredModels: any = null;

      const mockFetch = vi.fn().mockImplementation(async (url: string, opts: any = {}) => {
        const method = opts.method || 'GET';
        if (url.includes('/api/credentials') && method === 'GET') {
          // Simulate an existing credential for the base URL
          return {
            ok: true,
            status: 200,
            json: async () => [
              { id: 'cred:existing', provider: 'openai', base_url: 'http://127.0.0.1:8000/v1' },
            ],
          };
        }
        if (url.includes('/discover') && method === 'POST') {
          return { ok: true, status: 200, json: async () => ['gemma-12b'] };
        }
        if (url.includes('/register-models') && method === 'POST') {
          registeredModels = JSON.parse(opts.body).model_ids;
          return { ok: true, status: 200, json: async () => ({ status: 'success' }) };
        }
        if (url.includes('/models/defaults') && method === 'PUT') {
          defaultModelsPayload = JSON.parse(opts.body);
          return { ok: true, status: 200, json: async () => defaultModelsPayload };
        }
        return { ok: true, status: 200, json: async () => ({}) };
      });

      const client = new OpenNotebookClient({ baseUrl: 'http://localhost:5055', fetchFn: mockFetch });
      const result = await configureNotebookModels(client, TEST_VAULT);

      expect(result.credentialsCreated).toBe(0); // Reused existing
      expect(registeredModels).toContain('gemma-12b');
      expect(registeredModels).toContain('whisper-1');
      expect(registeredModels).toContain('tts-1');

      expect(defaultModelsPayload).toEqual({
        chat: 'gemma-12b',
        summary: 'gemma-12b',
        transformation: 'gemma-12b',
        embedding: 'text-embedding-3-small',
        stt: 'whisper-1',
        tts: 'tts-1',
        podcast: 'tts-1', // defaults to tts
      });
    });

    it('should execute configureNotebookCommand via CLI command', async () => {
      const { configureNotebookCommand } = await import('../commands/notebook.js');

      const configYaml = `
notebook:
  models:
    chat: "agentic-test"
`;
      fs.writeFileSync(path.join(TEST_VAULT, 'config', 'config.yml'), configYaml, 'utf8');

      let defaultsSet = false;
      const mockFetch = vi.fn().mockImplementation(async (url: string, opts: any = {}) => {
        const method = opts.method || 'GET';
        if (url.endsWith('/health')) return { ok: true, status: 200 };
        if (url.includes('/api/credentials') && method === 'GET') {
          return { ok: true, status: 200, json: async () => [] };
        }
        if (url.includes('/api/credentials') && method === 'POST') {
          return { ok: true, status: 200, json: async () => ({ id: 'cred:new' }) };
        }
        if (url.includes('/discover') && method === 'POST') {
          return { ok: true, status: 200, json: async () => ['agentic-test'] };
        }
        if (url.includes('/register-models') && method === 'POST') {
          return { ok: true, status: 200, json: async () => ({ status: 'success' }) };
        }
        if (url.includes('/models/defaults') && method === 'PUT') {
          defaultsSet = true;
          return { ok: true, status: 200, json: async () => ({}) };
        }
        return { ok: true, status: 200, json: async () => ({}) };
      });

      const originalFetch = globalThis.fetch;
      globalThis.fetch = mockFetch;

      try {
        await configureNotebookCommand(TEST_VAULT, {
          pr: false,
          verbose: false,
          force: false,
        });
        expect(defaultsSet).toBe(true);
      } finally {
        globalThis.fetch = originalFetch;
      }
    });
  });
});


