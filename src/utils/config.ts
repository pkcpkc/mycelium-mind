import * as path from 'path';
import * as fs from 'fs';
import { fileURLToPath } from 'url';
import YAML from 'yaml';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Resolve project root (which is 3 levels up from src/utils/config.ts)
export const projectRootDir = path.resolve(__dirname, '..', '..');

// Helper to check environment variables and fallback to .env file
function loadEnv() {
  const cwdEnvPath = path.join(process.cwd(), '.env');
  const packageEnvPath = path.join(projectRootDir, '.env');
  const envPath = fs.existsSync(cwdEnvPath) ? cwdEnvPath : packageEnvPath;
  if (fs.existsSync(envPath)) {
    const envContent = fs.readFileSync(envPath, 'utf8');
    for (const line of envContent.split('\n')) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) continue;
      const separatorIdx = trimmed.indexOf('=');
      if (separatorIdx === -1) continue;
      const key = trimmed.slice(0, separatorIdx).trim();
      const raw = trimmed.slice(separatorIdx + 1).trim();
      let value: string;
      const quoted = raw.match(/^(['"])(.*?)\1/);
      if (quoted) {
        value = quoted[2];
      } else {
        value = raw.replace(/\s+#.*$/, '').trim();
      }
      // Only set in process.env if not already set by host environment
      if (!(key in process.env)) {
        process.env[key] = value;
      }
    }
  }
}

// Helper to load non-sensitive model settings from config/config.yml
function loadYamlConfig() {
  const configPath = path.join(process.cwd(), 'config', 'config.yml');
  if (fs.existsSync(configPath)) {
    try {
      const parsed = YAML.parse(fs.readFileSync(configPath, 'utf8'));
      if (parsed?.models) {
        const m = parsed.models;
        if (m.base || m.base_model) {
          process.env.BASE_MODEL_NAME = m.base || m.base_model;
        }
        if (m.api_url || m.apiUrl) {
          process.env.BASE_MODEL_API_URL = m.api_url || m.apiUrl;
        }
        if (m.ocr || m.ocr_model) {
          process.env.OCR_MODEL_NAME = m.ocr || m.ocr_model;
        }
        if (m.image || m.image_model) {
          process.env.IMAGE_MODEL_NAME = m.image || m.image_model;
        }
        if (m.stt || m.stt_model) {
          process.env.STT_MODEL_NAME = m.stt || m.stt_model;
        }
      }
    } catch {
      // ignore
    }
  }
}

// Load env variables and config.yml
loadEnv();
loadYamlConfig();

// Resolve base model settings
const baseModelName = process.env.BASE_MODEL_NAME || 'agentic';
const baseModelApiUrl = process.env.BASE_MODEL_API_URL || 'http://localhost:8000/v1';
const baseModelApiKey = process.env.BASE_MODEL_API_KEY || 'dummy-key';

export const config = {
  vaultName: process.env.VAULT_NAME || 'LLM-Wiki',
  vaultsRoot: process.env.VAULTS_ROOT || path.join(projectRootDir, 'Vaults'),

  // Base model config
  baseModelName,
  baseModelApiUrl,
  baseModelApiKey,

  // OCR model config
  ocrModelName: process.env.OCR_MODEL_NAME || baseModelName,
  ocrModelApiUrl: process.env.OCR_MODEL_API_URL || baseModelApiUrl,
  ocrModelApiKey: process.env.OCR_MODEL_API_KEY || baseModelApiKey,

  // Image model config
  imageModelName: process.env.IMAGE_MODEL_NAME || baseModelName,
  imageModelApiUrl: process.env.IMAGE_MODEL_API_URL || baseModelApiUrl,
  imageModelApiKey: process.env.IMAGE_MODEL_API_KEY || baseModelApiKey,

  // STT (Speech-to-Text) model config
  sttModelName: process.env.STT_MODEL_NAME || 'stt',
  sttModelApiUrl: process.env.STT_MODEL_API_URL || baseModelApiUrl,
  sttModelApiKey: process.env.STT_MODEL_API_KEY || baseModelApiKey,
};

export interface IngestionSettings {
  concurrency: number;
  inboxChunkSize: number;
  maxSummariesPerEntity: number;
}

/**
 * Loads ingestion configuration from config/config.yml.
 */
export function loadIngestionSettings(absoluteWikiRoot: string): IngestionSettings {
  let concurrency = 4;
  let inboxChunkSize = 10;
  let maxSummariesPerEntity = 5;

  const configPath = path.join(absoluteWikiRoot, 'config', 'config.yml');
  if (fs.existsSync(configPath)) {
    try {
      const parsed = YAML.parse(fs.readFileSync(configPath, 'utf8'));
      if (parsed) {
        if (parsed.parallelPromptExecution === false) {
          concurrency = 1;
        }
        if (parsed.ingestion) {
          if (typeof parsed.ingestion.concurrency === 'number') {
            concurrency = parsed.ingestion.concurrency;
          }
          if (typeof parsed.ingestion.inbox_chunk_size === 'number') {
            inboxChunkSize = parsed.ingestion.inbox_chunk_size;
          } else if (typeof parsed.ingestion.inboxChunkSize === 'number') {
            inboxChunkSize = parsed.ingestion.inboxChunkSize;
          }
          if (typeof parsed.ingestion.max_summaries_per_entity === 'number') {
            maxSummariesPerEntity = parsed.ingestion.max_summaries_per_entity;
          } else if (typeof parsed.ingestion.maxSummariesPerEntity === 'number') {
            maxSummariesPerEntity = parsed.ingestion.maxSummariesPerEntity;
          }
        }
      }
    } catch (e: any) {
      console.warn(`Failed to parse config.yml at ${configPath}:`, e.message);
    }
  }

  return { concurrency, inboxChunkSize, maxSummariesPerEntity };
}

