import * as fs from 'fs';
import * as path from 'path';
import * as crypto from 'crypto';
import YAML from 'yaml';
import matter from 'gray-matter';
import { asyncPool } from '../utils/async-pool.js';
import { OpenNotebookClient, NotebookItem } from '../utils/open-notebook-client.js';
import { NotebookModelsConfig } from './types.js';

export interface NotebookConfig {
  url?: string;
  api_key?: string;
  apiKey?: string;
  name?: string;
  target?: string;
  id?: string;
  notebook_id?: string;
  filter?: {
    collections?: boolean;
    summaries?: boolean;
    overviews?: boolean;
  };
  concurrency?: number;
  model_api_url?: string;
  modelApiUrl?: string;
  model_api_key?: string;
  modelApiKey?: string;
  model_provider?: string;
  modelProvider?: string;
  api_url?: string;
  apiUrl?: string;
  models?: NotebookModelsConfig;
}

export interface SyncPlanItem {
  type: 'add' | 'update' | 'skip' | 'prune';
  relPath: string;
  fullPath?: string;
  title: string;
  sha256?: string;
  sourceId?: string;
  content?: string;
}

export interface SyncPlanResult {
  toAdd: SyncPlanItem[];
  toUpdate: SyncPlanItem[];
  unchanged: SyncPlanItem[];
  toPrune: SyncPlanItem[];
}

export interface LocalSyncState {
  notebookId?: string;
  sources: Record<string, { id: string; sha256: string; title: string }>;
}

/**
 * Loads notebook configuration from <vault>/config/config.yml if present.
 */
export function loadNotebookConfig(vaultRoot: string): NotebookConfig {
  const configPath = path.join(vaultRoot, 'config', 'config.yml');
  if (fs.existsSync(configPath)) {
    try {
      const parsed = YAML.parse(fs.readFileSync(configPath, 'utf8'));
      if (parsed && parsed.notebook) {
        return parsed.notebook as NotebookConfig;
      }
    } catch (e: any) {
      console.warn(`Failed to parse config.yml at ${configPath}:`, e.message);
    }
  }
  return {};
}

/**
 * Loads the local sync state cache from <vault>/.notebook-sync.json.
 */
export function loadSyncState(vaultRoot: string): LocalSyncState {
  const statePath = path.join(vaultRoot, '.notebook-sync.json');
  if (fs.existsSync(statePath)) {
    try {
      return JSON.parse(fs.readFileSync(statePath, 'utf8'));
    } catch {
      // ignore
    }
  }
  return { sources: {} };
}

/**
 * Saves the local sync state cache to <vault>/.notebook-sync.json.
 */
export function saveSyncState(vaultRoot: string, state: LocalSyncState): void {
  const statePath = path.join(vaultRoot, '.notebook-sync.json');
  try {
    fs.writeFileSync(statePath, JSON.stringify(state, null, 2), 'utf8');
  } catch {
    // ignore
  }
}

/**
 * Constructs an origin URL signature encoding relative path and content sha256.
 */
export function buildOriginUrl(relPath: string, sha256: string): string {
  const normalizedPath = relPath.replace(/\\/g, '/');
  return `mycelium://${normalizedPath}#sha256:${sha256}`;
}

/**
 * Parses an origin URL signature to extract relative path and content sha256.
 */
export function parseOriginUrl(url?: string): { relPath: string; sha256: string } | null {
  if (!url || !url.startsWith('mycelium://')) return null;
  const match = url.match(/^mycelium:\/\/([^#]+)#sha256:([a-zA-Z0-9_-]+)$/);
  if (!match) return null;
  return {
    relPath: match[1],
    sha256: match[2],
  };
}

/**
 * Generates a clean human-readable title for an Open Notebook source.
 */
export function extractCardTitle(fullPath: string, relPath: string, fileContent: string): string {
  let title = '';
  try {
    const parsed = matter(fileContent);
    if (parsed.data) {
      title = parsed.data.title || parsed.data.name || '';
    }
  } catch {
    // fallback if matter parsing fails
  }

  if (!title) {
    title = path.basename(fullPath, path.extname(fullPath));
  }

  // Prepend category prefix based on relative directory
  const normalized = relPath.replace(/\\/g, '/');
  if (normalized.startsWith('wiki/collections/')) {
    const parts = normalized.split('/');
    if (parts.length >= 3) {
      const collectionName = parts[2]; // e.g. "concepts", "persons"
      const singular = collectionName.endsWith('s') ? collectionName.slice(0, -1) : collectionName;
      const formatted = singular.charAt(0).toUpperCase() + singular.slice(1);
      return `[${formatted}] ${title}`;
    }
  } else if (normalized.startsWith('wiki/summaries/')) {
    return `[Summary] ${title}`;
  }

  return title;
}

/**
 * Recursively scans markdown files under a directory.
 */
export function scanMarkdownFiles(dir: string, baseVaultDir: string): string[] {
  if (!fs.existsSync(dir)) return [];
  const results: string[] = [];

  function walk(current: string) {
    const entries = fs.readdirSync(current, { withFileTypes: true });
    for (const entry of entries) {
      if (entry.name.startsWith('.')) continue; // skip hidden files
      const full = path.join(current, entry.name);
      if (entry.isDirectory()) {
        walk(full);
      } else if (entry.isFile() && entry.name.endsWith('.md')) {
        results.push(full);
      }
    }
  }

  walk(dir);
  return results;
}

/**
 * Discovers and/or provisions the target notebook in Open Notebook.
 */
export async function resolveTargetNotebook(
  client: OpenNotebookClient,
  vaultRoot: string,
  options: { notebookName?: string; notebookId?: string }
): Promise<NotebookItem> {
  // 1. Explicit ID
  if (options.notebookId) {
    const existing = await client.getNotebook(options.notebookId);
    if (!existing) {
      throw new Error(`Target notebook with ID '${options.notebookId}' was not found in Open Notebook.`);
    }
    return existing;
  }

  // 2. Explicit or default name
  const vaultName = path.basename(vaultRoot);
  const targetName = options.notebookName || `[MM] ${vaultName}`;

  const found = await client.findNotebookByName(targetName);
  if (found) {
    return found;
  }

  // 3. Create notebook automatically if it doesn't exist
  console.log(`Notebook "${targetName}" does not exist in Open Notebook. Creating it...`);
  const created = await client.createNotebook(
    targetName,
    `Synthesized knowledge vault for Mycelium Mind (${vaultName})`
  );
  console.log(`Created notebook "${targetName}" (ID: ${created.id})`);
  return created;
}

/**
 * Computes the sync plan comparing local vault files to remote sources.
 */
export async function planNotebookSync(
  client: OpenNotebookClient,
  targetNotebookId: string,
  vaultRoot: string,
  options: {
    filter?: string;
    force?: boolean;
  }
): Promise<SyncPlanResult> {
  const wikiDir = path.join(vaultRoot, 'wiki');
  const collectionsDir = path.join(wikiDir, 'collections');
  const summariesDir = path.join(wikiDir, 'summaries');

  const filterMode = (options.filter || 'all').toLowerCase();
  let localFilePaths: string[] = [];

  if (filterMode === 'all' || filterMode === 'collections') {
    localFilePaths.push(...scanMarkdownFiles(collectionsDir, vaultRoot));
  }
  if (filterMode === 'all' || filterMode === 'summaries') {
    localFilePaths.push(...scanMarkdownFiles(summariesDir, vaultRoot));
  }

  // 1. Fetch remote sources for this notebook
  const remoteSources = await client.listSources(targetNotebookId);
  const syncState = loadSyncState(vaultRoot);

  const remoteByRelPath = new Map<string, { id: string; sha256: string; title: string }>();
  const remoteById = new Map<string, any>();
  const remoteByTitle = new Map<string, any>();

  for (const src of remoteSources) {
    remoteById.set(src.id, src);
    if (src.title) {
      remoteByTitle.set(src.title, src);
    }
    const parsed = parseOriginUrl(src.url);
    if (parsed) {
      remoteByRelPath.set(parsed.relPath, {
        id: src.id,
        sha256: parsed.sha256,
        title: src.title,
      });
    }
  }

  const toAdd: SyncPlanItem[] = [];
  const toUpdate: SyncPlanItem[] = [];
  const unchanged: SyncPlanItem[] = [];
  const matchedRemoteSourceIds = new Set<string>();

  // 2. Compare local files against remote sources
  for (const fullPath of localFilePaths) {
    const relPath = path.relative(vaultRoot, fullPath).replace(/\\/g, '/');
    const content = fs.readFileSync(fullPath, 'utf8');
    const sha256 = crypto.createHash('sha256').update(content).digest('hex');
    const title = extractCardTitle(fullPath, relPath, content);

    // Matching precedence:
    // A. URL signature (if present from parsed url)
    // B. Local sync cache .notebook-sync.json (verified present on remote)
    // C. Title matching (adopt existing source if matching title)
    let matchedRemoteId: string | undefined;
    let knownRemoteSha256: string | undefined;

    const fromUrl = remoteByRelPath.get(relPath);
    if (fromUrl) {
      matchedRemoteId = fromUrl.id;
      knownRemoteSha256 = fromUrl.sha256;
    } else {
      const cached = syncState.sources[relPath];
      if (cached && remoteById.has(cached.id)) {
        matchedRemoteId = cached.id;
        knownRemoteSha256 = cached.sha256;
      } else if (remoteByTitle.has(title)) {
        matchedRemoteId = remoteByTitle.get(title).id;
      }
    }

    if (matchedRemoteId) {
      matchedRemoteSourceIds.add(matchedRemoteId);
    }

    if (!matchedRemoteId) {
      toAdd.push({
        type: 'add',
        relPath,
        fullPath,
        title,
        sha256,
        content,
      });
    } else if (knownRemoteSha256 === sha256 && !options.force) {
      unchanged.push({
        type: 'skip',
        relPath,
        fullPath,
        title,
        sha256,
        sourceId: matchedRemoteId,
      });
    } else {
      toUpdate.push({
        type: 'update',
        relPath,
        fullPath,
        title,
        sha256,
        sourceId: matchedRemoteId,
        content,
      });
    }
  }

  // 3. Find remote sources that no longer exist locally (for potential pruning)
  const toPrune: SyncPlanItem[] = [];
  for (const src of remoteSources) {
    if (!matchedRemoteSourceIds.has(src.id)) {
      const parsed = parseOriginUrl(src.url);
      toPrune.push({
        type: 'prune',
        relPath: parsed ? parsed.relPath : (src.title || src.id),
        title: src.title,
        sourceId: src.id,
      });
    }
  }

  return { toAdd, toUpdate, unchanged, toPrune };
}

/**
 * Executes the plan mutations against Open Notebook and updates local state.
 */
export async function executeSyncMutations(
  client: OpenNotebookClient,
  targetNotebookId: string,
  plan: SyncPlanResult,
  vaultRoot: string,
  options: {
    prune?: boolean;
    concurrency?: number;
  } = {}
): Promise<void> {
  const concurrency = options.concurrency ?? 1;
  const prune = options.prune ?? false;
  const syncState = loadSyncState(vaultRoot);
  syncState.notebookId = targetNotebookId;

  // 1. Prune removed sources if requested
  if (prune && plan.toPrune.length > 0) {
    console.log(`\nPruning ${plan.toPrune.length} orphaned source(s)...`);
    await asyncPool(concurrency, plan.toPrune, async (item) => {
      if (item.sourceId) {
        await client.deleteSource(item.sourceId);
        console.log(`  - Deleted orphaned source: ${item.title}`);
        // Remove from local cache
        for (const [k, v] of Object.entries(syncState.sources)) {
          if (v.id === item.sourceId) {
            delete syncState.sources[k];
          }
        }
        saveSyncState(vaultRoot, syncState);
      }
    });
    saveSyncState(vaultRoot, syncState);
  }

  // 2. Update modified sources (delete old, upload new)
  if (plan.toUpdate.length > 0) {
    console.log(`\nUpdating ${plan.toUpdate.length} modified document(s)...`);
    await asyncPool(concurrency, plan.toUpdate, async (item) => {
      if (item.sourceId) {
        await client.deleteSource(item.sourceId).catch(() => {});
      }
      const originUrl = buildOriginUrl(item.relPath, item.sha256!);
      const bodyWithOrigin = (item.content || '') + `\n\n<!-- mm-origin: ${originUrl} -->\n`;
      const created = await client.createSource({
        notebookId: targetNotebookId,
        title: item.title,
        text: bodyWithOrigin,
        url: originUrl,
      });
      syncState.sources[item.relPath] = {
        id: created.id,
        sha256: item.sha256!,
        title: item.title,
      };
      saveSyncState(vaultRoot, syncState);
      console.log(`  ~ Updated: ${item.relPath} (source: ${created.id})`);
    });
    saveSyncState(vaultRoot, syncState);
  }

  // 3. Add new sources
  if (plan.toAdd.length > 0) {
    console.log(`\nAdding ${plan.toAdd.length} new document(s)...`);
    await asyncPool(concurrency, plan.toAdd, async (item) => {
      const originUrl = buildOriginUrl(item.relPath, item.sha256!);
      const bodyWithOrigin = (item.content || '') + `\n\n<!-- mm-origin: ${originUrl} -->\n`;
      const created = await client.createSource({
        notebookId: targetNotebookId,
        title: item.title,
        text: bodyWithOrigin,
        url: originUrl,
      });
      syncState.sources[item.relPath] = {
        id: created.id,
        sha256: item.sha256!,
        title: item.title,
      };
      saveSyncState(vaultRoot, syncState);
      console.log(`  + Added: ${item.relPath} (source: ${created.id})`);
    });
    saveSyncState(vaultRoot, syncState);
  }
}
