import OpenAI from 'openai';
import { config } from './config.js';

export interface Message {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

let _openai: OpenAI | undefined;

function getOpenAI(): OpenAI {
  if (!_openai) {
    let baseURL = config.baseModelApiUrl;
    if (baseURL.endsWith('/chat/completions')) {
      baseURL = baseURL.slice(0, -17);
    }
    _openai = new OpenAI({
      baseURL: baseURL,
      apiKey: config.baseModelApiKey === 'dummy-key' ? '' : config.baseModelApiKey,
    });
  }
  return _openai;
}

/**
 * Calls the OpenAI-compatible agentic model with messages.
 */
export async function callAgenticModel(messages: Message[]): Promise<string> {
  try {
    const openai = getOpenAI();
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
