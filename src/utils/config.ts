import * as path from 'path';
import * as fs from 'fs';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Resolve project root (which is 3 levels up from src/utils/config.ts)
export const projectRootDir = path.resolve(__dirname, '..', '..');

// Helper to check environment variables and fallback to .env file
function loadEnv() {
  const envPath = path.join(projectRootDir, '.env');
  if (fs.existsSync(envPath)) {
    const envContent = fs.readFileSync(envPath, 'utf8');
    for (const line of envContent.split('\n')) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) continue;
      const separatorIdx = trimmed.indexOf('=');
      if (separatorIdx === -1) continue;
      const key = trimmed.slice(0, separatorIdx).trim();
      const value = trimmed.slice(separatorIdx + 1).trim().replace(/^['"]|['"]$/g, '');
      // Only set in process.env if not already set by host environment
      if (!(key in process.env)) {
        process.env[key] = value;
      }
    }
  }
}

// Load env variables
loadEnv();

export const config = {
  vaultName: process.env.VAULT_NAME || 'LLM-Wiki',
  vaultsRoot: process.env.VAULTS_ROOT || path.join(projectRootDir, 'Vaults'),
  apiUrl: process.env.API_URL || 'http://localhost:8000/v1',
  apiKey: process.env.API_KEY || 'dummy-key',
  agenticModelName: process.env.AGENTIC_MODEL_NAME || 'agentic',
  ocrModelName: process.env.OCR_MODEL_NAME || 'ocr',
  imageModelName: process.env.IMAGE_MODEL_NAME || process.env.AGENTIC_MODEL_NAME || 'agentic',
};
