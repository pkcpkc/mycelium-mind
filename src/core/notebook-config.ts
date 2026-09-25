import * as path from 'path';
import * as fs from 'fs';
import YAML from 'yaml';
import { CliFlags, NotebookModelEntryConfig, NotebookModelsConfig } from './types.js';
import { loadNotebookConfig } from './notebook-sync.js';
import { OpenNotebookClient } from '../utils/open-notebook-client.js';
import { config } from '../utils/config.js';

export interface ResolvedModelEntry {
  name: string;
  provider: string;
  apiUrl: string;
  apiKey: string;
}

export interface ResolvedNotebookModels {
  chat: ResolvedModelEntry;
  summary: ResolvedModelEntry;
  transformation: ResolvedModelEntry;
  embedding?: ResolvedModelEntry;
  stt?: ResolvedModelEntry;
  tts?: ResolvedModelEntry;
  podcast?: ResolvedModelEntry;
}

export interface ConfiguredNotebookModelsResult {
  configured: ResolvedNotebookModels;
  credentialsCreated: number;
  modelsRegistered: string[];
}

/**
 * Normalizes an API base URL (strips trailing slashes).
 */
function normalizeUrl(url?: string): string {
  if (!url) return '';
  return url.replace(/\/+$/, '');
}

/**
 * Resolves a model slot from vault config, environment overrides, or fallbacks.
 */
function resolveSlot(
  raw: string | NotebookModelEntryConfig | undefined,
  defaultProvider: string,
  defaultApiUrl: string,
  defaultApiKey: string,
  fallbackName?: string,
  envOverride?: string
): ResolvedModelEntry | undefined {
  if (typeof raw === 'string' && raw.trim()) {
    return {
      name: raw.trim(),
      provider: defaultProvider,
      apiUrl: normalizeUrl(defaultApiUrl),
      apiKey: defaultApiKey,
    };
  }

  if (raw && typeof raw === 'object' && raw.name && raw.name.trim()) {
    return {
      name: raw.name.trim(),
      provider: raw.provider || defaultProvider,
      apiUrl: normalizeUrl(raw.apiUrl || raw.api_url || defaultApiUrl),
      apiKey: raw.apiKey || raw.api_key || defaultApiKey,
    };
  }

  const resolvedName = (envOverride && envOverride.trim()) || fallbackName;
  if (resolvedName && resolvedName.trim()) {
    return {
      name: resolvedName.trim(),
      provider: defaultProvider,
      apiUrl: normalizeUrl(defaultApiUrl),
      apiKey: defaultApiKey,
    };
  }

  return undefined;
}

/**
 * Resolves all Open Notebook model settings based on vault config (Option B) and global fallbacks.
 */
export function resolveNotebookModelSettings(
  vaultRoot: string,
  flags?: CliFlags
): ResolvedNotebookModels {
  const vaultConfig = loadNotebookConfig(vaultRoot);

  // Check top-level 'models' block in <vaultRoot>/config/config.yml for single-source-of-truth
  let topModels: any = {};
  const configPath = path.join(vaultRoot, 'config', 'config.yml');
  if (fs.existsSync(configPath)) {
    try {
      const parsed = YAML.parse(fs.readFileSync(configPath, 'utf8'));
      if (parsed?.models && typeof parsed.models === 'object') {
        topModels = parsed.models;
      }
    } catch {
      // ignore
    }
  }

  // Merge notebook.models (if specified) with top-level models block
  const notebookModels = vaultConfig.models || {};
  const defaultProvider =
    notebookModels.provider ||
    vaultConfig.model_provider ||
    vaultConfig.modelProvider ||
    topModels.provider ||
    process.env.NOTEBOOK_MODEL_PROVIDER ||
    'openai';

  const explicitNotebookApiUrl =
    notebookModels.apiUrl ||
    notebookModels.api_url ||
    vaultConfig.model_api_url ||
    vaultConfig.modelApiUrl ||
    vaultConfig.api_url ||
    vaultConfig.apiUrl ||
    process.env.NOTEBOOK_MODEL_API_URL;

  let defaultApiUrl: string;

  if (explicitNotebookApiUrl) {
    // Explicitly configured for Open Notebook: respect verbatim without automatic rewriting
    defaultApiUrl = normalizeUrl(explicitNotebookApiUrl);
  } else {
    // Inherited fallback from top-level models block or global config:
    // For standard Open Notebook Docker containers on Mac, bridge localhost/127.0.0.1 to host.docker.internal
    let fallbackUrl = topModels.apiUrl || topModels.api_url || config.baseModelApiUrl;
    if (/^https?:\/\/(127\.0\.0\.1|localhost)(:\d+)?/i.test(fallbackUrl)) {
      fallbackUrl = fallbackUrl.replace(
        /^https?:\/\/(127\.0\.0\.1|localhost)/i,
        (match: string) => (match.toLowerCase().includes('https') ? 'https://host.docker.internal' : 'http://host.docker.internal')
      );
    }
    defaultApiUrl = normalizeUrl(fallbackUrl);
  }

  const defaultApiKey =
    notebookModels.apiKey ||
    notebookModels.api_key ||
    vaultConfig.model_api_key ||
    vaultConfig.modelApiKey ||
    topModels.apiKey ||
    topModels.api_key ||
    process.env.NOTEBOOK_MODEL_API_KEY ||
    config.baseModelApiKey;

  // 1. Chat model (falls back to top-level base model or config.baseModelName)
  const chatFallback =
    topModels.chat || topModels.base || topModels.base_model || config.baseModelName || 'agentic';
  const chat = resolveSlot(
    notebookModels.chat,
    defaultProvider,
    defaultApiUrl,
    defaultApiKey,
    chatFallback,
    process.env.NOTEBOOK_CHAT_MODEL
  )!;

  // 2. Summary model (falls back to chat model)
  const summaryFallback = notebookModels.summary || topModels.summary || chat.name;
  const summary = resolveSlot(
    summaryFallback,
    defaultProvider,
    defaultApiUrl,
    defaultApiKey,
    chat.name,
    process.env.NOTEBOOK_SUMMARY_MODEL
  )!;

  // 3. Transformation model (falls back to chat model)
  const transformFallback = notebookModels.transformation || topModels.transformation || chat.name;
  const transformation = resolveSlot(
    transformFallback,
    defaultProvider,
    defaultApiUrl,
    defaultApiKey,
    chat.name,
    process.env.NOTEBOOK_TRANSFORMATION_MODEL
  )!;

  // 4. Embedding model (from notebook.models or top-level models.embedding / models.embeddings)
  const embeddingSlot = notebookModels.embedding || topModels.embedding || topModels.embeddings;
  const embedding = resolveSlot(
    embeddingSlot,
    defaultProvider,
    defaultApiUrl,
    defaultApiKey,
    undefined,
    process.env.NOTEBOOK_EMBEDDING_MODEL || process.env.EMBEDDING_MODEL_NAME
  );

  // 5. Speech-to-Text (STT) model (from notebook.models or top-level models.stt)
  const sttSlot = notebookModels.stt || topModels.stt;
  const stt = resolveSlot(
    sttSlot,
    defaultProvider,
    defaultApiUrl,
    defaultApiKey,
    undefined,
    process.env.NOTEBOOK_STT_MODEL || process.env.STT_MODEL_NAME
  );

  // 6. Text-to-Speech (TTS) model (from notebook.models or top-level models.tts)
  const ttsSlot = notebookModels.tts || topModels.tts;
  const tts = resolveSlot(
    ttsSlot,
    defaultProvider,
    defaultApiUrl,
    defaultApiKey,
    undefined,
    process.env.NOTEBOOK_TTS_MODEL || process.env.TTS_MODEL_NAME
  );

  // 7. Podcast model (falls back to TTS model if TTS is configured, otherwise unconfigured)
  const podcastSlot = notebookModels.podcast || topModels.podcast || tts?.name;
  const podcast = resolveSlot(
    podcastSlot,
    defaultProvider,
    defaultApiUrl,
    defaultApiKey,
    tts?.name,
    process.env.NOTEBOOK_PODCAST_MODEL || process.env.PODCAST_MODEL_NAME
  );

  return {
    chat,
    summary,
    transformation,
    embedding,
    stt,
    tts,
    podcast,
  };
}

/**
 * Configures Open Notebook AI provider credentials and default model assignments.
 */
export async function configureNotebookModels(
  client: OpenNotebookClient,
  vaultRoot: string,
  flags?: CliFlags
): Promise<ConfiguredNotebookModelsResult> {
  const vaultConfig = loadNotebookConfig(vaultRoot);
  const resolved = resolveNotebookModelSettings(vaultRoot, flags);

  // Group models by unique provider endpoint
  interface ProviderGroup {
    provider: string;
    apiUrl: string;
    apiKey: string;
    models: Set<string>;
  }

  const groups = new Map<string, ProviderGroup>();

  const activeEntries = [
    resolved.chat,
    resolved.summary,
    resolved.transformation,
    resolved.embedding,
    resolved.stt,
    resolved.tts,
    resolved.podcast,
  ].filter((entry): entry is ResolvedModelEntry => !!entry);

  for (const entry of activeEntries) {
    const key = `${entry.provider}:::${entry.apiUrl}:::${entry.apiKey}`;
    if (!groups.has(key)) {
      groups.set(key, {
        provider: entry.provider,
        apiUrl: entry.apiUrl,
        apiKey: entry.apiKey,
        models: new Set(),
      });
    }
    groups.get(key)!.models.add(entry.name);
  }

  let credentialsCreated = 0;
  const allRegisteredModels: string[] = [];

  // Fetch existing credentials to avoid unnecessary duplicates
  const existingCredentials = await client.listCredentials().catch(() => []);

  const hasExplicitModelUrl = Boolean(
    vaultConfig.models?.apiUrl ||
    vaultConfig.models?.api_url ||
    vaultConfig.model_api_url ||
    vaultConfig.modelApiUrl ||
    vaultConfig.api_url ||
    vaultConfig.apiUrl ||
    process.env.NOTEBOOK_MODEL_API_URL
  );

  /**
   * Checks if two URLs are equivalent.
   * If an explicit model URL is configured, requires an exact match.
   * If using inherited host defaults, treats localhost, 127.0.0.1, and host.docker.internal as equivalent.
   */
  function urlsEquivalent(urlA?: string, urlB?: string): boolean {
    if (!urlA && !urlB) return true;
    if (!urlA || !urlB) return false;
    const normA = normalizeUrl(urlA);
    const normB = normalizeUrl(urlB);
    if (normA === normB) return true;
    if (!hasExplicitModelUrl) {
      const bridgeA = normA.replace(/:\/\/(127\.0\.0\.1|localhost)/i, '://host.docker.internal');
      const bridgeB = normB.replace(/:\/\/(127\.0\.0\.1|localhost)/i, '://host.docker.internal');
      return bridgeA === bridgeB;
    }
    return false;
  }

  for (const group of groups.values()) {
    let credentialId: string | undefined;

    // Find existing credential with matching provider and base_url
    const matching = existingCredentials.find(
      (c: any) =>
        c.provider === group.provider &&
        (urlsEquivalent(c.base_url || c.apiUrl, group.apiUrl) || (!c.base_url && !group.apiUrl))
    );

    if (matching && matching.id) {
      credentialId = matching.id;
    } else {
      const credName = `Mycelium Mind (${group.provider})`;
      try {
        const created = await client.createCredential({
          provider: group.provider,
          name: credName,
          key: group.apiKey,
          base_url: group.apiUrl || undefined,
        });
        credentialId = created.id;
        credentialsCreated++;
      } catch (err: any) {
        console.warn(`[Open Notebook] Notice when registering credential for ${group.provider}: ${err.message}`);
      }
    }

    if (credentialId) {
      // Discover and register models
      try {
        const discovered = await client.discoverModels(credentialId).catch(() => []);
        const toRegister = Array.from(new Set([...discovered, ...group.models]));
        if (toRegister.length > 0) {
          await client.registerModels(credentialId, toRegister).catch(() => {});
          allRegisteredModels.push(...toRegister);
        }
      } catch (err: any) {
        console.warn(`[Open Notebook] Notice during model discovery: ${err.message}`);
      }
    }
  }

  // Set default model slots
  const defaultsPayload: Record<string, string | null> = {
    chat: resolved.chat.name,
    summary: resolved.summary.name,
    transformation: resolved.transformation.name,
    embedding: resolved.embedding ? resolved.embedding.name : null,
    stt: resolved.stt ? resolved.stt.name : null,
    tts: resolved.tts ? resolved.tts.name : null,
    podcast: resolved.podcast ? resolved.podcast.name : null,
  };

  try {
    await client.setDefaultModels(defaultsPayload);
  } catch (err: any) {
    console.warn(`[Open Notebook] Notice when setting default models: ${err.message}`);
  }

  // Friendly console summary
  console.log('\n✓ Open Notebook AI models configured:');
  console.log(`  • Chat:           ${resolved.chat.name}`);
  console.log(`  • Summary:        ${resolved.summary.name}`);
  console.log(`  • Transformation: ${resolved.transformation.name}`);
  console.log(`  • Embeddings:     ${resolved.embedding ? resolved.embedding.name : '(unconfigured)'}`);
  console.log(`  • Speech-to-Text: ${resolved.stt ? resolved.stt.name : '(unconfigured)'}`);
  console.log(`  • Text-to-Speech: ${resolved.tts ? resolved.tts.name : '(unconfigured)'}`);
  if (resolved.podcast) {
    console.log(`  • Podcast:        ${resolved.podcast.name}`);
  }

  return {
    configured: resolved,
    credentialsCreated,
    modelsRegistered: allRegisteredModels,
  };
}
