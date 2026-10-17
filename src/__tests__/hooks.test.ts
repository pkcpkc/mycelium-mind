import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';
import * as http from 'http';
import { AddressInfo } from 'net';
import { fileURLToPath } from 'url';
import {
  matchesEvent,
  loadHooksConfig,
  signBody,
  initHooks,
  emitEvent,
  flushHooks,
  withRun,
  setHookSink,
  HookEvent,
} from '../core/hooks.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const TEST_ROOT = path.resolve(__dirname, '..', '..', 'temp-cli-tests-vaults');

interface Received {
  headers: http.IncomingHttpHeaders;
  body: string;
}

function writeConfig(vault: string, yaml: string): void {
  fs.mkdirSync(path.join(vault, 'config'), { recursive: true });
  fs.writeFileSync(path.join(vault, 'config', 'config.yml'), yaml, 'utf8');
}

describe('hooks', () => {
  let vault: string;
  let server: http.Server;
  let baseUrl: string;
  let received: Received[];
  // Status codes the server answers with, consumed in order (then 200)
  let responses: number[];

  beforeEach(async () => {
    vault = path.join(TEST_ROOT, `HooksVault_${Math.random().toString(36).slice(2, 11)}`);
    fs.mkdirSync(vault, { recursive: true });
    received = [];
    responses = [];
    server = http.createServer((req, res) => {
      let body = '';
      req.on('data', (c) => (body += c));
      req.on('end', () => {
        received.push({ headers: req.headers, body });
        res.statusCode = responses.shift() ?? 200;
        res.end();
      });
    });
    await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
    baseUrl = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  });

  afterEach(async () => {
    setHookSink(null);
    delete process.env.MM_HOOKS;
    delete process.env.MM_TEST_SECRET;
    await new Promise<void>((resolve) => server.close(() => resolve()));
    fs.rmSync(vault, { recursive: true, force: true });
  });

  it('matches event globs', () => {
    expect(matchesEvent('*', 'entity.created')).toBe(true);
    expect(matchesEvent('entity.*', 'entity.created')).toBe(true);
    expect(matchesEvent('entity.*', 'summary.created')).toBe(false);
    expect(matchesEvent('*.created', 'summary.created')).toBe(true);
    expect(matchesEvent('git.pr.created', 'git.pr.created')).toBe(true);
    expect(matchesEvent('git.pr', 'git.pr.created')).toBe(false);
  });

  it('parses config, interpolates env vars and drops invalid endpoints', () => {
    process.env.MM_TEST_SECRET = 'tok';
    writeConfig(vault, `
hooks:
  timeout_ms: 500
  endpoints:
    - name: a
      url: "${baseUrl}/x"
      headers:
        Authorization: "Bearer \${env:MM_TEST_SECRET}"
    - name: invalid
      url: "${baseUrl}"
      script: "./x.sh"
    - name: b
      script: "./x.sh"
      events: "summary.*"
`);
    const cfg = loadHooksConfig(vault);
    expect(cfg.enabled).toBe(true);
    expect(cfg.timeoutMs).toBe(500);
    expect(cfg.endpoints.map((e) => e.name)).toEqual(['a', 'b']);
    expect(cfg.endpoints[0].headers.Authorization).toBe('Bearer tok');
    expect(cfg.endpoints[0].events).toEqual(['*']);
    expect(cfg.endpoints[1].events).toEqual(['summary.*']);
  });

  it('delivers subscribed events with envelope, headers and HMAC signature', async () => {
    process.env.MM_TEST_SECRET = 's3cret';
    writeConfig(vault, `
hooks:
  endpoints:
    - name: web
      url: "${baseUrl}/hook"
      events: ["entity.*"]
      secret_env: MM_TEST_SECRET
`);
    initHooks(vault);
    emitEvent('summary.created', { path: 'wiki/summaries/a.md' });
    emitEvent('entity.created', { path: 'wiki/collections/persons/b.md' });
    await flushHooks();

    expect(received).toHaveLength(1);
    const event = JSON.parse(received[0].body) as HookEvent;
    expect(event.type).toBe('entity.created');
    expect(event.schema_version).toBe(1);
    expect(event.vault?.root).toBe(path.resolve(vault));
    expect(event.data.path).toBe('wiki/collections/persons/b.md');
    expect(received[0].headers['x-mm-event']).toBe('entity.created');
    expect(received[0].headers['x-mm-delivery']).toBe(event.id);
    expect(received[0].headers['x-mm-signature']).toBe(signBody(received[0].body, 's3cret'));
  });

  it('retries 5xx responses but not 4xx', async () => {
    writeConfig(vault, `
hooks:
  retries: 2
  retry_backoff_ms: 5
  endpoints:
    - name: web
      url: "${baseUrl}/hook"
`);
    initHooks(vault);
    responses = [500, 503];
    emitEvent('run.completed', {});
    await flushHooks();
    expect(received).toHaveLength(3);

    received = [];
    responses = [400];
    emitEvent('run.completed', {});
    await flushHooks();
    expect(received).toHaveLength(1);
  });

  it('never throws when an endpoint is unreachable', async () => {
    writeConfig(vault, `
hooks:
  retries: 0
  timeout_ms: 500
  endpoints:
    - name: dead
      url: "http://127.0.0.1:1/nothing"
`);
    initHooks(vault);
    expect(() => emitEvent('run.completed', {})).not.toThrow();
    await expect(flushHooks()).resolves.toBeUndefined();
  });

  it('respects MM_HOOKS=off', async () => {
    writeConfig(vault, `
hooks:
  endpoints:
    - name: web
      url: "${baseUrl}/hook"
`);
    initHooks(vault);
    process.env.MM_HOOKS = 'off';
    emitEvent('run.completed', {});
    await flushHooks();
    expect(received).toHaveLength(0);
  });

  it('pipes the event JSON to scripts with MM_* env vars', async () => {
    const outFile = path.join(vault, 'out.json');
    const scriptPath = path.join(vault, 'hook.sh');
    fs.writeFileSync(scriptPath, `#!/bin/sh\ncat > "$1"\necho "$MM_EVENT|$MM_COMMAND" > "$1.env"\n`, { mode: 0o755 });
    writeConfig(vault, `
hooks:
  endpoints:
    - name: script
      script: "./hook.sh"
      args: ["${outFile}"]
`);
    await withRun(vault, 'sync', {}, async () => {
      emitEvent('summary.created', { path: 'wiki/summaries/a.md' });
    });
    await flushHooks();

    // run.started, summary.created and run.completed are delivered in order; the last one wins
    const last = JSON.parse(fs.readFileSync(outFile, 'utf8')) as HookEvent;
    expect(last.type).toBe('run.completed');
    expect(last.data.changes.created).toEqual(['wiki/summaries/a.md']);
    expect(fs.readFileSync(`${outFile}.env`, 'utf8').trim()).toBe('run.completed|sync');
  });

  it('reports failing and hanging scripts without throwing', async () => {
    const failing = path.join(vault, 'fail.sh');
    const hanging = path.join(vault, 'hang.sh');
    fs.writeFileSync(failing, '#!/bin/sh\necho boom >&2\nexit 3\n', { mode: 0o755 });
    fs.writeFileSync(hanging, '#!/bin/sh\nsleep 5\n', { mode: 0o755 });
    writeConfig(vault, `
hooks:
  timeout_ms: 300
  endpoints:
    - name: fail
      script: "./fail.sh"
    - name: hang
      script: "./hang.sh"
`);
    const { deliverToEndpoint, getHooksConfig, buildEvent } = await import('../core/hooks.js');
    initHooks(vault);
    const [fail, hang] = getHooksConfig().endpoints;
    const failResult = await deliverToEndpoint(fail, buildEvent('hook.test'));
    expect(failResult.ok).toBe(false);
    expect(failResult.error).toContain('exit code 3: boom');
    const hangResult = await deliverToEndpoint(hang, buildEvent('hook.test'));
    expect(hangResult.ok).toBe(false);
    expect(hangResult.error).toContain('timed out');
  });

  it('tracks run lifecycle, nests inner commands and reports failures', async () => {
    writeConfig(vault, 'hooks:\n  endpoints: []\n');
    const events: HookEvent[] = [];
    setHookSink((e) => events.push(e));

    await withRun(vault, 'sync', { pr: false }, async (run) => {
      run.setResult({ stats: { summariesSuccess: 1 } });
      emitEvent('summary.created', { path: 'wiki/summaries/a.md' });
      await withRun(vault, 'overviews', {}, async () => {
        emitEvent('overview.generated', { path: 'wiki/overviews/t.md', created: false });
      });
      emitEvent('git.committed', { sha: 'abc', message: 'm' });
    });

    expect(events.map((e) => e.type)).toEqual([
      'run.started', 'summary.created', 'overview.generated', 'git.committed', 'run.completed',
    ]);
    const runId = events[0].run?.id;
    expect(events.every((e) => e.run?.id === runId)).toBe(true);
    const completed = events[4].data;
    expect(completed.stats).toEqual({ summariesSuccess: 1 });
    expect(completed.changes).toEqual({ created: ['wiki/summaries/a.md'], updated: ['wiki/overviews/t.md'], deleted: [] });
    expect(completed.commits).toEqual([{ sha: 'abc', message: 'm' }]);

    events.length = 0;
    await expect(withRun(vault, 'resync', {}, async (run) => {
      run.setStage('summaries');
      emitEvent('git.rolled_back', { restored_branch: 'main' });
      throw new Error('model down');
    })).rejects.toThrow('model down');
    const failed = events.find((e) => e.type === 'run.failed')!;
    expect(failed.data.error.message).toBe('model down');
    expect(failed.data.error.stage).toBe('summaries');
    expect(failed.data.rolled_back).toBe(true);

    events.length = 0;
    await withRun(vault, 'sync', {}, async (run) => run.skip('inbox_empty'));
    expect(events.map((e) => e.type)).toEqual(['run.started', 'run.skipped']);
    expect(events[1].data.reason).toBe('inbox_empty');
  });

  it('attributes runs started during watch as child runs', async () => {
    writeConfig(vault, 'hooks:\n  endpoints: []\n');
    const events: HookEvent[] = [];
    setHookSink((e) => events.push(e));

    await withRun(vault, 'watch', {}, async () => {
      await withRun(vault, 'sync', {}, async () => {
        emitEvent('watch.inbox.detected', { file: 'inbox/a.md' }, { scope: 'root' });
      });
    }, { silent: true });

    const started = events.find((e) => e.type === 'run.started')!;
    expect(started.run?.command).toBe('sync');
    expect(started.run?.trigger).toBe('watch');
    const watchEvent = events.find((e) => e.type === 'watch.inbox.detected')!;
    expect(watchEvent.run?.command).toBe('watch');
    expect(started.run?.parent_run_id).toBe(watchEvent.run?.id);
  });
});
