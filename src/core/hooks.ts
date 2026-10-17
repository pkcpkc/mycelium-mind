/**
 * Event hooks: notifies user-registered URLs and scripts about wiki status changes.
 *
 * Hooks are notify-only observers. `emitEvent` never throws and never blocks the
 * pipeline; deliveries run on one FIFO queue per endpoint (so each endpoint sees
 * events in order) and `flushHooks` waits for them before the process exits.
 *
 * Runs: every top-level command (sync, resync, overrides, ...) is wrapped in
 * `withRun`, which emits run.started / run.completed / run.failed / run.skipped
 * and aggregates the pages, commits, branch and PR produced by the run. Commands
 * nested inside a run (e.g. overviews inside sync) attach to the outer run; runs
 * started while `watch` is active become its children.
 */
import * as fs from 'fs';
import * as path from 'path';
import * as crypto from 'crypto';
import * as childProcess from 'child_process';
import { createRequire } from 'module';
import YAML from 'yaml';
import { config as modelConfig } from '../utils/config.js';

const require = createRequire(import.meta.url);
const { version: mmVersion } = require('../../package.json');

export const HOOK_SCHEMA_VERSION = 1;

export interface HookEndpoint {
  name: string;
  url?: string;
  script?: string;
  args: string[];
  events: string[];
  headers: Record<string, string>;
  secretEnv?: string;
}

export interface HooksConfig {
  enabled: boolean;
  timeoutMs: number;
  retries: number;
  retryBackoffMs: number;
  endpoints: HookEndpoint[];
}

export interface HookRunInfo {
  id: string;
  command: string;
  trigger: 'cli' | 'watch';
  parent_run_id?: string;
  branch?: string;
  options: Record<string, unknown>;
  mm_version: string;
  models: { base: string; api_url: string };
}

export interface HookEvent {
  id: string;
  type: string;
  schema_version: number;
  timestamp: string;
  vault: { root: string; name: string } | null;
  run: HookRunInfo | null;
  data: Record<string, any>;
}

export type RunStage = 'preflight' | 'summaries' | 'entities' | 'overrides' | 'overviews' | 'publish' | 'notebook' | 'git';

export interface RunHandle {
  readonly id: string;
  /** Marks the pipeline stage, reported as error.stage if the run fails. */
  setStage(stage: RunStage): void;
  /** Extra data merged into the run.completed payload (e.g. stats). */
  setResult(data: Record<string, unknown>): void;
  /** Ends the run early with run.skipped instead of run.completed. */
  skip(reason: string): void;
}

interface RunState {
  info: HookRunInfo;
  silent: boolean;
  startedAt: number;
  stage?: RunStage;
  result: Record<string, unknown>;
  created: Set<string>;
  updated: Set<string>;
  deleted: Set<string>;
  commits: { sha: string; message: string }[];
  prUrl?: string;
  rolledBack: boolean;
  skipped?: string;
  childRuns: number;
  /** Vault-relative pages that existed when the run started (see pageExisted). */
  baseline: Set<string>;
}

const DEFAULT_CONFIG: HooksConfig = { enabled: false, timeoutMs: 10000, retries: 3, retryBackoffMs: 1000, endpoints: [] };

let vaultRoot: string | null = null;
let hooksConfig: HooksConfig = DEFAULT_CONFIG;
const runStack: RunState[] = [];
const queues = new Map<string, Promise<void>>();
let sink: ((event: HookEvent) => void) | null = null;

function isDisabledByEnv(): boolean {
  const flag = (process.env.MM_HOOKS || '').toLowerCase();
  return flag === 'off' || flag === '0' || flag === 'false';
}

function interpolateEnv(value: string): string {
  return value.replace(/\$\{env:([A-Za-z_][A-Za-z0-9_]*)\}/g, (_, name) => process.env[name] ?? '');
}

/**
 * Parses the `hooks:` block of <vault>/config/config.yml. Invalid endpoints are
 * reported and dropped rather than failing the command.
 */
export function loadHooksConfig(root: string): HooksConfig {
  const configPath = path.join(root, 'config', 'config.yml');
  if (!fs.existsSync(configPath)) return { ...DEFAULT_CONFIG, endpoints: [] };

  let raw: any;
  try {
    raw = YAML.parse(fs.readFileSync(configPath, 'utf8'))?.hooks;
  } catch (e: any) {
    console.warn(`[hooks] Failed to parse ${configPath}:`, e.message);
    return { ...DEFAULT_CONFIG, endpoints: [] };
  }
  if (!raw || typeof raw !== 'object') return { ...DEFAULT_CONFIG, endpoints: [] };

  const endpoints: HookEndpoint[] = [];
  const list = Array.isArray(raw.endpoints) ? raw.endpoints : [];
  list.forEach((entry: any, idx: number) => {
    const name = String(entry?.name || `hook-${idx + 1}`);
    const hasUrl = typeof entry?.url === 'string' && entry.url.trim() !== '';
    const hasScript = typeof entry?.script === 'string' && entry.script.trim() !== '';
    if (hasUrl === hasScript) {
      console.warn(`[hooks] Endpoint '${name}' must define exactly one of 'url' or 'script'; ignoring it.`);
      return;
    }
    const events = entry.events === undefined ? ['*'] : (Array.isArray(entry.events) ? entry.events : [entry.events]).map(String);
    const headers: Record<string, string> = {};
    if (entry.headers && typeof entry.headers === 'object') {
      for (const [key, val] of Object.entries(entry.headers)) headers[key] = interpolateEnv(String(val));
    }
    endpoints.push({
      name,
      url: hasUrl ? interpolateEnv(entry.url.trim()) : undefined,
      script: hasScript ? entry.script.trim() : undefined,
      args: Array.isArray(entry.args) ? entry.args.map((a: any) => interpolateEnv(String(a))) : [],
      events,
      headers,
      secretEnv: entry.secret_env || entry.secretEnv,
    });
  });

  const num = (v: any, fallback: number) => (typeof v === 'number' && v >= 0 ? v : fallback);
  return {
    enabled: raw.enabled !== false,
    timeoutMs: num(raw.timeout_ms ?? raw.timeoutMs, DEFAULT_CONFIG.timeoutMs),
    retries: num(raw.retries, DEFAULT_CONFIG.retries),
    retryBackoffMs: num(raw.retry_backoff_ms ?? raw.retryBackoffMs, DEFAULT_CONFIG.retryBackoffMs),
    endpoints,
  };
}

/**
 * Loads the hooks config for a vault; a no-op when that vault is already active.
 */
export function initHooks(root: string): void {
  const resolved = path.resolve(root);
  if (vaultRoot === resolved) return;
  vaultRoot = resolved;
  hooksConfig = loadHooksConfig(resolved);
}

/**
 * Test seam: receives every emitted event regardless of configured endpoints.
 */
export function setHookSink(fn: ((event: HookEvent) => void) | null): void {
  sink = fn;
}

/**
 * Matches an event type against a subscription glob (`*`, `entity.*`, `git.pr.created`).
 */
export function matchesEvent(pattern: string, type: string): boolean {
  if (pattern === '*' || pattern === type) return true;
  const regex = new RegExp('^' + pattern.split('*').map((p) => p.replace(/[.+?^${}()|[\]\\]/g, '\\$&')).join('.*') + '$');
  return regex.test(type);
}

/**
 * Converts an absolute path to a vault-relative POSIX path (as used in event payloads).
 */
export function toVaultPath(filePath: string): string {
  const abs = path.resolve(filePath);
  const rel = vaultRoot ? path.relative(vaultRoot, abs) : abs;
  return (rel.startsWith('..') ? abs : rel).split(path.sep).join('/');
}

function currentRun(): RunState | undefined {
  return runStack[runStack.length - 1];
}

/**
 * True when a page existed on disk now or at the start of the current run.
 * Lets emitters report `updated` (not `created`) for pages a resync wiped and regenerated.
 */
export function pageExisted(filePath: string): boolean {
  if (fs.existsSync(filePath)) return true;
  const run = currentRun();
  return !!run && run.baseline.has(toVaultPath(filePath));
}

/**
 * Records the pages that existed before a run started wiping folders.
 */
export function setRunBaseline(pages: Iterable<string>): void {
  const run = currentRun();
  if (run) run.baseline = new Set(pages);
}

function trackChanges(run: RunState, type: string, data: Record<string, any>): void {
  const p = typeof data.path === 'string' ? data.path : undefined;
  if (type === 'git.committed' && data.sha) {
    run.commits.push({ sha: data.sha, message: data.message });
  } else if (type === 'git.branch.created') {
    run.info.branch = data.branch;
  } else if (type === 'git.pr.created') {
    run.prUrl = data.url;
  } else if (type === 'git.rolled_back') {
    run.rolledBack = true;
  }
  if (!p) return;
  if (type === 'page.deleted') {
    run.created.delete(p);
    run.updated.delete(p);
    run.deleted.add(p);
  } else if (type.endsWith('.created') || (type === 'overview.generated' && data.created)) {
    run.deleted.delete(p);
    run.created.add(p);
  } else if (type.endsWith('.updated') || type === 'override.applied' || type === 'overview.generated') {
    run.deleted.delete(p);
    if (!run.created.has(p)) run.updated.add(p);
  }
}

/**
 * Builds a full event envelope for the given type and payload.
 */
export function buildEvent(type: string, data: Record<string, any> = {}, run: RunState | undefined = currentRun()): HookEvent {
  return {
    id: `evt_${crypto.randomUUID()}`,
    type,
    schema_version: HOOK_SCHEMA_VERSION,
    timestamp: new Date().toISOString().replace(/\.\d{3}Z$/, 'Z'),
    vault: vaultRoot ? { root: vaultRoot, name: path.basename(vaultRoot) } : null,
    run: run ? { ...run.info, options: { ...run.info.options } } : null,
    data,
  };
}

/**
 * Emits an event to the test sink and every subscribed endpoint. Never throws.
 * `scope: 'root'` attributes the event to the outermost run (used for watch.* events
 * that fire while a child run is in flight).
 */
export function emitEvent(type: string, data: Record<string, any> = {}, opts?: { scope?: 'root' }): void {
  try {
    const run = opts?.scope === 'root' ? runStack[0] : currentRun();
    if (run) trackChanges(run, type, data);
    const event = buildEvent(type, data, run);
    if (sink) sink(event);
    if (!hooksConfig.enabled || isDisabledByEnv()) return;
    for (const endpoint of hooksConfig.endpoints) {
      if (endpoint.events.some((pattern) => matchesEvent(pattern, type))) enqueue(endpoint, event);
    }
  } catch (e: any) {
    console.warn(`[hooks] Failed to emit ${type}:`, e.message);
  }
}

function enqueue(endpoint: HookEndpoint, event: HookEvent): void {
  const prev = queues.get(endpoint.name) ?? Promise.resolve();
  const next = prev.then(async () => {
    const result = await deliverToEndpoint(endpoint, event);
    if (!result.ok) console.warn(`[hooks] ${endpoint.name} ${event.type} failed: ${result.error}`);
  });
  queues.set(endpoint.name, next);
}

/**
 * Waits until every queued delivery has finished (successfully or not).
 */
export async function flushHooks(): Promise<void> {
  while (queues.size > 0) {
    const pending = [...queues.values()];
    await Promise.allSettled(pending);
    // Drop queues that did not grow while we waited
    for (const [name, promise] of queues) {
      if (pending.includes(promise)) queues.delete(name);
    }
  }
}

class NonRetryableError extends Error {}

/**
 * HMAC-SHA256 signature sent as `X-MM-Signature: sha256=<hex>`.
 */
export function signBody(body: string, secret: string): string {
  return 'sha256=' + crypto.createHmac('sha256', secret).update(body).digest('hex');
}

async function deliverUrl(endpoint: HookEndpoint, event: HookEvent, body: string, cfg: HooksConfig): Promise<void> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    'User-Agent': `mycelium-mind/${mmVersion}`,
    'X-MM-Event': event.type,
    'X-MM-Delivery': event.id,
    ...endpoint.headers,
  };
  const secret = endpoint.secretEnv ? process.env[endpoint.secretEnv] : undefined;
  if (secret) headers['X-MM-Signature'] = signBody(body, secret);

  let lastError = '';
  for (let attempt = 0; attempt <= cfg.retries; attempt++) {
    try {
      const res = await fetch(endpoint.url!, {
        method: 'POST',
        headers,
        body,
        signal: AbortSignal.timeout(cfg.timeoutMs),
      });
      if (res.ok) return;
      lastError = `HTTP ${res.status}`;
      if (res.status < 500 && res.status !== 429) throw new NonRetryableError(lastError);
    } catch (e: any) {
      if (e instanceof NonRetryableError) throw e;
      lastError = e?.name === 'TimeoutError' ? `timed out after ${cfg.timeoutMs}ms` : (e?.cause?.message || e?.message || String(e));
    }
    if (attempt < cfg.retries) {
      await new Promise((resolve) => setTimeout(resolve, cfg.retryBackoffMs * 2 ** attempt));
    }
  }
  throw new Error(`${lastError} (after ${cfg.retries + 1} attempts)`);
}

function deliverScript(endpoint: HookEndpoint, event: HookEvent, body: string, cfg: HooksConfig): Promise<void> {
  const root = vaultRoot ?? process.cwd();
  const scriptPath = path.isAbsolute(endpoint.script!) ? endpoint.script! : path.resolve(root, endpoint.script!);
  return new Promise((resolve, reject) => {
    const child = childProcess.spawn(scriptPath, endpoint.args, {
      cwd: root,
      stdio: ['pipe', 'ignore', 'pipe'],
      // Own process group, so a timeout also kills grandchildren holding the pipes open
      detached: process.platform !== 'win32',
      env: {
        ...process.env,
        MM_EVENT: event.type,
        MM_EVENT_ID: event.id,
        MM_RUN_ID: event.run?.id ?? '',
        MM_COMMAND: event.run?.command ?? '',
        MM_VAULT_ROOT: root,
      },
    });
    let stderr = '';
    let settled = false;
    const settle = (err?: Error) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      if (err) reject(err);
      else resolve();
    };
    const timer = setTimeout(() => {
      try {
        if (child.pid && process.platform !== 'win32') process.kill(-child.pid, 'SIGKILL');
        else child.kill('SIGKILL');
      } catch {
        // already exited
      }
      settle(new Error(`timed out after ${cfg.timeoutMs}ms`));
    }, cfg.timeoutMs);
    child.stderr?.on('data', (chunk) => {
      if (stderr.length < 2000) stderr += chunk.toString();
    });
    child.on('error', (err) => settle(err));
    child.on('close', (code) => {
      if (code === 0) settle();
      else settle(new Error(`exit code ${code}${stderr.trim() ? `: ${stderr.trim()}` : ''}`));
    });
    // Scripts that never read stdin close the pipe early; that is not a failure
    child.stdin?.on('error', () => {});
    child.stdin?.end(body);
  });
}

/**
 * Delivers one event to one endpoint, reporting the outcome instead of throwing.
 */
export async function deliverToEndpoint(
  endpoint: HookEndpoint,
  event: HookEvent,
  cfg: HooksConfig = hooksConfig
): Promise<{ ok: boolean; ms: number; error?: string }> {
  const start = Date.now();
  const body = JSON.stringify(event);
  try {
    if (endpoint.url) await deliverUrl(endpoint, event, body, cfg);
    else await deliverScript(endpoint, event, body, cfg);
    return { ok: true, ms: Date.now() - start };
  } catch (e: any) {
    return { ok: false, ms: Date.now() - start, error: e?.message || String(e) };
  }
}

function changesOf(run: RunState) {
  return {
    created: [...run.created].sort(),
    updated: [...run.updated].sort(),
    deleted: [...run.deleted].sort(),
  };
}

function startRun(command: string, options: Record<string, unknown>, silent: boolean): RunState {
  const parent = runStack[0];
  const fromWatch = parent?.info.command === 'watch';
  if (fromWatch) parent.childRuns++;
  const run: RunState = {
    info: {
      id: `run_${crypto.randomUUID()}`,
      command,
      trigger: fromWatch ? 'watch' : 'cli',
      parent_run_id: fromWatch ? parent.info.id : undefined,
      options,
      mm_version: mmVersion,
      models: { base: modelConfig.baseModelName, api_url: modelConfig.baseModelApiUrl },
    },
    silent,
    startedAt: Date.now(),
    result: {},
    created: new Set(),
    updated: new Set(),
    deleted: new Set(),
    commits: [],
    rolledBack: false,
    childRuns: 0,
    baseline: new Set(),
  };
  runStack.push(run);
  return run;
}

/**
 * Runs a command inside a hook run, emitting its lifecycle events. When another
 * (non-watch) run is already active, `fn` simply joins it.
 *
 * `silent` suppresses run.* lifecycle events (used by watch, which emits watch.*).
 */
export async function withRun<T>(
  root: string,
  command: string,
  options: Record<string, unknown>,
  fn: (run: RunHandle) => Promise<T>,
  opts?: { silent?: boolean; startData?: () => Record<string, unknown> }
): Promise<T> {
  initHooks(root);
  const active = currentRun();
  if (active && active.info.command !== 'watch') {
    return fn({ id: active.info.id, setStage: () => {}, setResult: () => {}, skip: () => {} });
  }

  const run = startRun(command, options, !!opts?.silent);
  const handle: RunHandle = {
    id: run.info.id,
    setStage: (stage) => { run.stage = stage; },
    setResult: (data) => { Object.assign(run.result, data); },
    skip: (reason) => { run.skipped = reason; },
  };

  if (!run.silent) emitEvent('run.started', { command, options, ...opts?.startData?.() });
  try {
    const value = await fn(handle);
    const durationMs = Date.now() - run.startedAt;
    if (run.silent) {
      // watch reports its own lifecycle
    } else if (run.skipped) {
      emitEvent('run.skipped', { reason: run.skipped, duration_ms: durationMs });
    } else {
      emitEvent('run.completed', {
        duration_ms: durationMs,
        ...run.result,
        changes: changesOf(run),
        commits: run.commits,
        branch: run.info.branch ?? null,
        pr_url: run.prUrl ?? null,
      });
    }
    return value;
  } catch (err: any) {
    if (!run.silent) {
      emitEvent('run.failed', {
        duration_ms: Date.now() - run.startedAt,
        error: {
          message: err?.message || String(err),
          stage: run.stage ?? null,
          code: err?.code ?? err?.cause?.code ?? null,
          status: err?.status ?? err?.response?.status ?? null,
        },
        rolled_back: run.rolledBack,
        partial: { ...run.result, changes: changesOf(run), commits: run.commits },
      });
    }
    throw err;
  } finally {
    const idx = runStack.indexOf(run);
    if (idx !== -1) runStack.splice(idx, 1);
  }
}

/**
 * Uptime and child-run count of the active watch run (for watch.stopped).
 */
export function watchRunStats(): { uptime_ms: number; runs_count: number } {
  const run = runStack[0];
  return run ? { uptime_ms: Date.now() - run.startedAt, runs_count: run.childRuns } : { uptime_ms: 0, runs_count: 0 };
}

/**
 * Configured endpoints of the active vault (for `mm hooks list|test`).
 */
export function getHooksConfig(): HooksConfig {
  return hooksConfig;
}
