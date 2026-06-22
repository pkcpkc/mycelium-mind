import * as path from 'path';
import { fileURLToPath } from 'url';
import * as fs from 'fs';

// Emulate __dirname for ES Modules
const __filename = fileURLToPath(import.meta.url);
export const __dirname = path.dirname(__filename);

// Resolve project root (which is 3 levels up from scripts/src/utils)
export const projectRootDir = path.resolve(__dirname, '..', '..', '..');

// Load environment variables from .env at root
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
    if (!(key in process.env)) {
      process.env[key] = value;
    }
  }
}

export const config = {
  vaultName: process.env.VAULT_NAME || 'LLM-Wiki',
  vaultsRoot: process.env.VAULTS_ROOT || path.join(projectRootDir, 'Vaults'),
  apiUrl: process.env.API_URL || 'http://localhost:8000/v1',
  apiKey: process.env.API_KEY || 'dummy-key',
  agenticModelName: process.env.AGENTIC_MODEL_NAME || 'agentic',
  ocrModelName: process.env.OCR_MODEL_NAME || 'ocr',
};
