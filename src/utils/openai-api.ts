import OpenAI from 'openai';
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
