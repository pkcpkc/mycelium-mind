import * as fs from 'fs';
import * as path from 'path';
import { getVaultDir } from '../utils/fs-utils.js';
import { CliFlags } from '../core/types.js';
import { OpenNotebookClient } from '../utils/open-notebook-client.js';
import {
  NotebookConfig,
  SyncPlanItem,
  SyncPlanResult,
  loadNotebookConfig,
  buildOriginUrl,
  parseOriginUrl,
  extractCardTitle,
  scanMarkdownFiles,
  resolveTargetNotebook,
  planNotebookSync,
  executeSyncMutations,
} from '../core/notebook-sync.js';
import {
  getComposeFilePath,
  isColimaInstalled,
  getColimaStatus,
  startColima,
  stopColima,
  isDockerRunning,
  resolveDockerComposeCmd,
  runDockerCompose,
  getComposeContainersStatus,
} from '../utils/container-runtime.js';
import {
  configureNotebookModels,
  resolveNotebookModelSettings,
  ResolvedNotebookModels,
  ConfiguredNotebookModelsResult,
} from '../core/notebook-config.js';

// Re-export core sync and container utilities for full backward compatibility
export {
  NotebookConfig,
  SyncPlanItem,
  SyncPlanResult,
  loadNotebookConfig,
  buildOriginUrl,
  parseOriginUrl,
  extractCardTitle,
  scanMarkdownFiles,
  resolveTargetNotebook,
  planNotebookSync,
  executeSyncMutations,
  getComposeFilePath,
  isColimaInstalled,
  getColimaStatus,
  startColima,
  stopColima,
  isDockerRunning,
  resolveDockerComposeCmd,
  runDockerCompose,
  getComposeContainersStatus,
  configureNotebookModels,
  resolveNotebookModelSettings,
  ResolvedNotebookModels,
  ConfiguredNotebookModelsResult,
};

/**
 * Pushes Mycelium Mind cards incrementally to Open Notebook.
 */
export async function pushWikiToNotebook(
  wikiPath: string,
  flags: CliFlags
): Promise<void> {
  const vaultRoot = getVaultDir(wikiPath);
  const vaultConfig = loadNotebookConfig(vaultRoot);

  const baseUrl = flags.notebookUrl || vaultConfig.url || process.env.OPEN_NOTEBOOK_URL || 'http://localhost:5055';
  const apiKey = flags.apiKey || vaultConfig.apiKey || vaultConfig.api_key || process.env.OPEN_NOTEBOOK_API_KEY;
  const notebookName = flags.notebook || vaultConfig.name || vaultConfig.target;
  const notebookId = flags.notebookId || vaultConfig.id || vaultConfig.notebook_id;
  const filter = flags.filter || (vaultConfig.filter ? (vaultConfig.filter.summaries === false ? 'collections' : (vaultConfig.filter.collections === false ? 'summaries' : 'all')) : 'all');
  const prune = flags.prune ?? false;
  const dryRun = flags.dryRun ?? false;
  const force = flags.force ?? false;
  const concurrency = flags.concurrency ?? vaultConfig.concurrency ?? 1;

  const client = new OpenNotebookClient({ baseUrl, apiKey });

  console.log(`Checking connection to Open Notebook at ${baseUrl}...`);
  const isHealthy = await client.checkHealth();
  if (!isHealthy) {
    throw new Error(
      `Open Notebook is not reachable at ${baseUrl}.\n` +
      `Ensure Open Notebook is running (e.g. via Docker Compose: 'docker compose -f scripts/docker/open-notebook.docker-compose.yml up -d').`
    );
  }

  const targetNotebook = await resolveTargetNotebook(client, vaultRoot, { notebookName, notebookId });
  console.log(`Target Notebook: "${targetNotebook.name}" (ID: ${targetNotebook.id})`);

  console.log(`Analyzing vault documents (filter: ${filter})...`);
  const plan = await planNotebookSync(
    client,
    targetNotebook.id,
    vaultRoot,
    { filter, force }
  );

  console.log(`\nSync Summary:`);
  console.log(`  • Unchanged: ${plan.unchanged.length} (skipped, zero re-indexing)`);
  console.log(`  • To Add:    ${plan.toAdd.length}`);
  console.log(`  • To Update: ${plan.toUpdate.length}`);
  console.log(`  • Orphaned:  ${plan.toPrune.length} ${prune ? '(will prune)' : '(ignored, pass --prune to delete)'}`);

  if (dryRun) {
    console.log(`\n[DRY RUN] No changes were made.`);
    if (plan.toAdd.length > 0) {
      console.log(`\nFiles to add:`);
      plan.toAdd.forEach((item) => console.log(`  + ${item.relPath} -> "${item.title}"`));
    }
    if (plan.toUpdate.length > 0) {
      console.log(`\nFiles to update:`);
      plan.toUpdate.forEach((item) => console.log(`  ~ ${item.relPath} (old source: ${item.sourceId})`));
    }
    if (prune && plan.toPrune.length > 0) {
      console.log(`\nFiles to prune:`);
      plan.toPrune.forEach((item) => console.log(`  - ${item.relPath} (source: ${item.sourceId})`));
    }
    return;
  }

  await executeSyncMutations(client, targetNotebook.id, plan, vaultRoot, { prune, concurrency });
  console.log(`\n✓ Sync completed successfully!`);
}

/**
 * Lists all available notebooks in Open Notebook.
 */
export async function listNotebooksCommand(wikiPath: string, flags: CliFlags): Promise<void> {
  const vaultRoot = getVaultDir(wikiPath);
  const vaultConfig = loadNotebookConfig(vaultRoot);
  const baseUrl = flags.notebookUrl || vaultConfig.url || process.env.OPEN_NOTEBOOK_URL || 'http://localhost:5055';
  const apiKey = flags.apiKey || vaultConfig.apiKey || vaultConfig.api_key || process.env.OPEN_NOTEBOOK_API_KEY;

  const client = new OpenNotebookClient({ baseUrl, apiKey });
  const healthy = await client.checkHealth();
  if (!healthy) {
    throw new Error(`Open Notebook is not reachable at ${baseUrl}.`);
  }

  const notebooks = await client.listNotebooks();
  console.log(`\nAvailable Notebooks in Open Notebook (${baseUrl}):`);
  if (notebooks.length === 0) {
    console.log(`  (No notebooks found)`);
    return;
  }

  for (const nb of notebooks) {
    let sourceCount = '?';
    try {
      const sources = await client.listSources(nb.id);
      sourceCount = sources.length.toString();
    } catch {
      // ignore
    }
    console.log(`  • ${nb.name} (ID: ${nb.id}) - ${sourceCount} sources`);
  }
  console.log();
}

/**
 * Starts Open Notebook Docker containers (and optionally starts Colima first if needed).
 */
export async function startNotebookService(flags: CliFlags, wikiPath: string = '.'): Promise<void> {
  const composePath = getComposeFilePath();
  if (!fs.existsSync(composePath)) {
    throw new Error(`Docker Compose template not found at: ${composePath}`);
  }

  let dockerActive = isDockerRunning();
  if (!dockerActive) {
    if (isColimaInstalled()) {
      console.log('Docker daemon is not responding. Starting Colima first...');
      startColima();
      dockerActive = isDockerRunning();
    }
  }

  if (!dockerActive) {
    throw new Error(
      'Docker daemon is not running.\n' +
      'If using Colima on macOS, start it with: colima start (or: mm notebook colima start)\n' +
      'If using Docker Desktop, please start the Docker application.'
    );
  }

  console.log('Starting Open Notebook containers...');
  runDockerCompose(composePath, 'up', ['-d']);

  console.log('\n✓ Open Notebook stack started successfully!');
  console.log('  • Frontend UI: http://localhost:8502');
  console.log('  • Backend API: http://localhost:5055');
  console.log('  • API Docs:    http://localhost:5055/docs\n');

  if (flags.configure !== false) {
    const vaultRoot = getVaultDir(wikiPath);
    const vaultConfig = loadNotebookConfig(vaultRoot);
    const baseUrl = flags.notebookUrl || vaultConfig.url || process.env.OPEN_NOTEBOOK_URL || 'http://localhost:5055';
    const apiKey = flags.apiKey || vaultConfig.apiKey || vaultConfig.api_key || process.env.OPEN_NOTEBOOK_API_KEY;
    const client = new OpenNotebookClient({ baseUrl, apiKey });

    console.log('Waiting for Open Notebook API to become ready...');
    const isReady = await client.waitForReady(30000);
    if (isReady) {
      await configureNotebookModels(client, vaultRoot, flags);
    } else {
      console.warn('⚠ Timed out waiting for Open Notebook API. Models were not auto-configured.');
      console.warn('  You can configure models later with: mm notebook configure\n');
    }
  }
}

/**
 * Stops Open Notebook Docker containers (and optionally stops Colima).
 */
export async function stopNotebookService(flags: CliFlags): Promise<void> {
  const composePath = getComposeFilePath();

  if (fs.existsSync(composePath)) {
    console.log('Stopping Open Notebook containers...');
    try {
      runDockerCompose(composePath, 'down');
      console.log('✓ Open Notebook containers stopped.');
    } catch (e: any) {
      console.warn('Notice when stopping containers:', e.message);
    }
  }

  if (flags.colima && isColimaInstalled()) {
    stopColima();
  }
}

/**
 * Direct Colima lifecycle management command.
 */
export async function manageColimaCommand(action?: string): Promise<void> {
  if (!isColimaInstalled()) {
    throw new Error(
      'Colima is not installed on this machine.\n' +
      'Install it on macOS via Homebrew: brew install colima docker docker-compose'
    );
  }

  const act = (action || 'status').toLowerCase();
  if (act === 'start') {
    startColima();
  } else if (act === 'stop') {
    stopColima();
  } else if (act === 'status') {
    const status = getColimaStatus();
    console.log(`Colima Status: ${status.message}`);
  } else {
    throw new Error(`Unknown Colima action '${action}'. Valid options: start, stop, status`);
  }
}

/**
 * Checks connection status to Open Notebook, Docker, and Colima.
 */
export async function statusNotebookCommand(wikiPath: string, flags: CliFlags): Promise<void> {
  const vaultRoot = getVaultDir(wikiPath);
  const vaultConfig = loadNotebookConfig(vaultRoot);
  const baseUrl = flags.notebookUrl || vaultConfig.url || process.env.OPEN_NOTEBOOK_URL || 'http://localhost:5055';
  const apiKey = flags.apiKey || vaultConfig.apiKey || vaultConfig.api_key || process.env.OPEN_NOTEBOOK_API_KEY;

  console.log(`Checking Open Notebook Environment:`);

  // 1. Colima status (if installed)
  if (isColimaInstalled()) {
    const colimaStatus = getColimaStatus();
    console.log(`  • Colima:         ${colimaStatus.running ? '✓ Running' : '✗ Stopped'} (${colimaStatus.message.split('\n')[0]})`);
  } else {
    console.log(`  • Colima:         Not installed (optional)`);
  }

  // 2. Docker daemon status
  const dockerActive = isDockerRunning();
  console.log(`  • Docker Daemon:  ${dockerActive ? '✓ Active' : '✗ Inactive'}`);

  // 3. Docker compose tool
  const composeCmd = resolveDockerComposeCmd();
  console.log(`  • Docker Compose: ${composeCmd ? `✓ Available (${composeCmd})` : '✗ Missing (brew install docker-compose)'}`);

  // 4. Container status
  if (dockerActive && composeCmd) {
    const composePath = getComposeFilePath();
    const containerLines = getComposeContainersStatus(composePath);
    if (containerLines.length > 0) {
      console.log(`  • Containers:`);
      containerLines.forEach((l) => console.log(`      - ${l}`));
    } else {
      console.log(`  • Containers:     Stopped`);
    }
  }

  // 5. HTTP API status
  const client = new OpenNotebookClient({ baseUrl, apiKey });
  const healthy = await client.checkHealth();
  if (healthy) {
    const notebooks = await client.listNotebooks().catch(() => []);
    console.log(`  • HTTP API:       ✓ Online (${baseUrl})`);
    console.log(`  • Notebooks:      ${notebooks.length} found`);
  } else {
    console.log(`  • HTTP API:       ✗ Offline (${baseUrl})`);
  }
}

/**
 * Creates a new notebook in Open Notebook.
 */
export async function createNotebookCommand(
  name: string,
  wikiPath: string,
  flags: CliFlags
): Promise<void> {
  if (!name || !name.trim()) {
    throw new Error('Please specify a notebook name: mm notebook create <name>');
  }
  const vaultRoot = getVaultDir(wikiPath);
  const vaultConfig = loadNotebookConfig(vaultRoot);
  const baseUrl = flags.notebookUrl || vaultConfig.url || process.env.OPEN_NOTEBOOK_URL || 'http://localhost:5055';
  const apiKey = flags.apiKey || vaultConfig.apiKey || vaultConfig.api_key || process.env.OPEN_NOTEBOOK_API_KEY;

  const client = new OpenNotebookClient({ baseUrl, apiKey });
  console.log(`Creating notebook "${name}" at ${baseUrl}...`);
  const created = await client.createNotebook(name.trim());
  console.log(`✓ Created notebook "${created.name}" (ID: ${created.id})`);
}

/**
 * Configures Open Notebook models and credentials from vault config and environment.
 */
export async function configureNotebookCommand(
  wikiPath: string,
  flags: CliFlags
): Promise<void> {
  const vaultRoot = getVaultDir(wikiPath);
  const vaultConfig = loadNotebookConfig(vaultRoot);
  const baseUrl = flags.notebookUrl || vaultConfig.url || process.env.OPEN_NOTEBOOK_URL || 'http://localhost:5055';
  const apiKey = flags.apiKey || vaultConfig.apiKey || vaultConfig.api_key || process.env.OPEN_NOTEBOOK_API_KEY;

  const client = new OpenNotebookClient({ baseUrl, apiKey });
  const healthy = await client.checkHealth();
  if (!healthy) {
    throw new Error(
      `Open Notebook is not reachable at ${baseUrl}.\n` +
      `Ensure Open Notebook is running (e.g. via: mm notebook start).`
    );
  }

  await configureNotebookModels(client, vaultRoot, flags);
}

/**
 * Main dispatcher for the 'mm notebook' command.
 */
export async function manageNotebook(positional: string[], flags: CliFlags): Promise<void> {
  const sub = positional[0];

  if (sub === 'start' || sub === 'up') {
    const wikiPath = positional[1] || '.';
    await startNotebookService(flags, wikiPath);
  } else if (sub === 'stop' || sub === 'down') {
    await stopNotebookService(flags);
  } else if (sub === 'colima') {
    const action = positional[1];
    await manageColimaCommand(action);
  } else if (sub === 'configure') {
    const wikiPath = positional[1] || '.';
    await configureNotebookCommand(wikiPath, flags);
  } else if (sub === 'list') {
    const wikiPath = positional[1] || '.';
    await listNotebooksCommand(wikiPath, flags);
  } else if (sub === 'status') {
    const wikiPath = positional[1] || '.';
    await statusNotebookCommand(wikiPath, flags);
  } else if (sub === 'create') {
    const name = positional[1];
    const wikiPath = positional[2] || '.';
    await createNotebookCommand(name, wikiPath, flags);
  } else if (sub === 'push') {
    const wikiPath = positional[1] || '.';
    await pushWikiToNotebook(wikiPath, flags);
  } else {
    // If first argument is not a known sub-action, treat it as vault path to push
    const wikiPath = sub || '.';
    await pushWikiToNotebook(wikiPath, flags);
  }
}

