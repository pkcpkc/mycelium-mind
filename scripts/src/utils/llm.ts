import OpenAI from 'openai';
import { config } from './config.js';

export interface Message {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

// Clean API URL for OpenAI SDK compatibility (ensure it is the base path, not the full chat endpoint)
let baseURL = config.apiUrl;
if (baseURL.endsWith('/chat/completions')) {
  baseURL = baseURL.slice(0, -17);
}

const openai = new OpenAI({
  baseURL: baseURL,
  apiKey: config.apiKey === 'dummy-key' ? '' : config.apiKey,
});

/**
 * Calls the OpenAI-compatible agentic model with messages using the official OpenAI SDK.
 */
export async function callAgenticModel(messages: Message[]): Promise<string> {
  try {
    const response = await openai.chat.completions.create({
      model: config.agenticModelName,
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
