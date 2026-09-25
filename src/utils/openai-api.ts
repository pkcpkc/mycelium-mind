import * as fs from 'fs';
import * as path from 'path';
import OpenAI, { toFile } from 'openai';
import { config } from './config.js';

export interface Message {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

const _clients = new Map<string, OpenAI>();

/**
 * Validates and formats the OpenAI base URL.
 * Strictly requires the base URL (e.g. "http://localhost:8000/v1") without endpoint paths like "/chat/completions".
 */
export function validateAndFormatBaseUrl(url: string, varName: string = 'API_URL'): string {
  if (!url) {
    throw new Error(`Invalid ${varName}: URL cannot be empty. Expected an OpenAI Base URL (e.g. "http://localhost:8000/v1").`);
  }
  const trimmed = url.trim().replace(/\/+$/, '');
  if (trimmed.endsWith('/chat/completions')) {
    throw new Error(
      `Invalid ${varName}: "${url}". Expected an OpenAI Base URL (e.g. "http://localhost:8000/v1"), not an endpoint path ending with "/chat/completions".`
    );
  }
  return trimmed;
}

/**
 * Returns a cached OpenAI client instance for the specified API URL and key.
 */
export function getOpenAI(
  apiUrl: string = config.baseModelApiUrl,
  apiKey: string = config.baseModelApiKey,
  varName: string = 'BASE_MODEL_API_URL'
): OpenAI {
  const baseURL = validateAndFormatBaseUrl(apiUrl, varName);
  const safeApiKey = !apiKey || apiKey === 'dummy-key' ? 'dummy-key' : apiKey;
  const cacheKey = `${baseURL}:::${safeApiKey}`;

  let client = _clients.get(cacheKey);
  if (!client) {
    client = new OpenAI({
      baseURL,
      apiKey: safeApiKey,
    });
    _clients.set(cacheKey, client);
  }
  return client;
}

/**
 * Detects whether an API error is non-recoverable (invalid credentials, connection refused, model not found).
 */
export function isNonRecoverableError(e: any): boolean {
  if (!e) return false;
  const status = e.status || e.statusCode || e.response?.status;
  if (status === 401 || status === 403 || status === 404) {
    return true;
  }
  const code = e.code || e.cause?.code;
  if (code === 'ECONNREFUSED' || code === 'ENOTFOUND') {
    return true;
  }
  const msg = String(e.message || '').toLowerCase();
  if (
    msg.includes('401') ||
    msg.includes('invalid api key') ||
    msg.includes('incorrect api key') ||
    msg.includes('unauthorized') ||
    msg.includes('forbidden') ||
    msg.includes('econnrefused') ||
    msg.includes('enotfound') ||
    msg.includes('account_deactivated') ||
    msg.includes('model not found')
  ) {
    return true;
  }
  return false;
}

/**
 * Performs a lightweight preflight check against the model endpoint.
 * Throws a fatal error if credentials or connection are non-recoverable.
 */
export async function preflightModelCheck(): Promise<void> {
  if (process.env.NODE_ENV === 'test' || process.env.VITEST === 'true') {
    return;
  }
  try {
    const openai = getOpenAI(config.baseModelApiUrl, config.baseModelApiKey, 'BASE_MODEL_API_URL');
    await openai.chat.completions.create({
      model: config.baseModelName,
      messages: [{ role: 'user', content: 'ping' }],
      max_tokens: 1,
    });
  } catch (e: any) {
    if (isNonRecoverableError(e)) {
      throw new Error(`Model preflight check failed: ${e.message}. Check your models config and BASE_MODEL_API_KEY in .env.`);
    }
  }
}

/**
 * Calls the OpenAI-compatible agentic model with messages.
 */
export async function callAgenticModel(messages: Message[]): Promise<string> {
  try {
    const openai = getOpenAI(config.baseModelApiUrl, config.baseModelApiKey, 'BASE_MODEL_API_URL');
    const response = await openai.chat.completions.create({
      model: config.baseModelName,
      messages: messages as any[],
    });

    const content = response.choices[0]?.message?.content;
    if (content === undefined || content === null) {
      throw new Error('Invalid LLM response: empty message content');
    }
    return content;
  } catch (e: any) {
    console.error('LLM API call failed via OpenAI SDK:', e.message);
    throw e;
  }
}

/**
 * Calls the OpenAI-compatible OCR model with an image.
 */
export async function callOcrModel(base64Img: string, format: string): Promise<string> {
  try {
    const openai = getOpenAI(config.ocrModelApiUrl, config.ocrModelApiKey, 'OCR_MODEL_API_URL');
    const response = await openai.chat.completions.create({
      model: config.ocrModelName,
      messages: [
        {
          role: 'user',
          content: [
            {
              type: 'text',
              text: 'Perform OCR on this image and return the text. Do not include markdown code block wraps.',
            },
            {
              type: 'image_url',
              image_url: {
                url: `data:image/${format};base64,${base64Img}`,
              },
            },
          ],
        },
      ],
    });

    const content = response.choices[0]?.message?.content;
    if (!content) {
      throw new Error('Empty OCR response content');
    }
    return content.trim();
  } catch (e: any) {
    console.error('OCR API call failed via OpenAI SDK:', e.message);
    throw e;
  }
}

/**
 * Calls the OpenAI-compatible Speech-to-Text (STT) model to transcribe an audio file.
 */
export async function callSttModel(audioFilePath: string): Promise<string> {
  try {
    const openai = getOpenAI(config.sttModelApiUrl, config.sttModelApiKey, 'STT_MODEL_API_URL');
    const fileBuffer = fs.readFileSync(audioFilePath);
    const file = await toFile(fileBuffer, path.basename(audioFilePath));
    const response = await openai.audio.transcriptions.create({
      model: config.sttModelName,
      file,
    });

    const text = typeof response === 'string' ? response : response.text;
    if (!text || !text.trim()) {
      throw new Error('Empty STT transcription response');
    }
    return text.trim();
  } catch (e: any) {
    console.error('STT API call failed via OpenAI SDK:', e.message);
    throw e;
  }
}

