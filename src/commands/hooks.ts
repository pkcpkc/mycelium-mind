import * as path from 'path';
import {
  initHooks,
  getHooksConfig,
  buildEvent,
  deliverToEndpoint,
  HookEndpoint,
} from '../core/hooks.js';

function describeTarget(endpoint: HookEndpoint): string {
  if (endpoint.script) return `script ${endpoint.script}${endpoint.args.length ? ' ' + endpoint.args.join(' ') : ''}`;
  try {
    // Hide query strings, which often carry tokens
    const url = new URL(endpoint.url!);
    return `url    ${url.origin}${url.pathname}${url.search ? '?…' : ''}`;
  } catch {
    return `url    ${endpoint.url}`;
  }
}

/**
 * Lists configured hook endpoints and their event subscriptions.
 */
export async function listHooks(wikiPath: string): Promise<void> {
  initHooks(path.resolve(wikiPath));
  const cfg = getHooksConfig();
  if (cfg.endpoints.length === 0) {
    console.log('No hooks configured. Add a `hooks.endpoints` list to config/config.yml.');
    return;
  }
  const state = !cfg.enabled ? ' (disabled in config)' : process.env.MM_HOOKS === 'off' ? ' (disabled via MM_HOOKS=off)' : '';
  console.log(`Hooks${state} — timeout ${cfg.timeoutMs}ms, ${cfg.retries} retries for URLs\n`);
  for (const endpoint of cfg.endpoints) {
    console.log(`• ${endpoint.name}`);
    console.log(`    ${describeTarget(endpoint)}`);
    console.log(`    events: ${endpoint.events.join(', ')}`);
    if (endpoint.url) {
      const secret = endpoint.secretEnv
        ? `${endpoint.secretEnv} (${process.env[endpoint.secretEnv] ? 'set' : 'NOT SET'})`
        : 'none';
      console.log(`    signing secret: ${secret}`);
    }
  }
}

/**
 * Sends a test event to every (or one named) endpoint and reports the outcome.
 * Delivers even when hooks are disabled, so endpoints can be checked before enabling them.
 */
export async function testHooks(wikiPath: string, opts: { name?: string; event?: string }): Promise<void> {
  initHooks(path.resolve(wikiPath));
  const cfg = getHooksConfig();
  const endpoints = cfg.endpoints.filter((e) => !opts.name || e.name === opts.name);
  if (endpoints.length === 0) {
    console.error(opts.name ? `No hook named '${opts.name}'.` : 'No hooks configured.');
    process.exitCode = 1;
    return;
  }

  const type = opts.event || 'hook.test';
  const event = buildEvent(type, {
    message: 'Test delivery from `mm hooks test`',
    sample: type !== 'hook.test',
  });

  for (const endpoint of endpoints) {
    const result = await deliverToEndpoint(endpoint, event, cfg);
    if (result.ok) {
      console.log(`✓ ${endpoint.name}: delivered ${type} in ${result.ms}ms`);
    } else {
      console.log(`✗ ${endpoint.name}: ${result.error} (${result.ms}ms)`);
      process.exitCode = 1;
    }
  }
}
