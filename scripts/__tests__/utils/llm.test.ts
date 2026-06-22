import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('openai', () => {
  const createMock = vi.fn();
  (globalThis as any).__mockCreate = createMock;
  return {
    default: vi.fn().mockImplementation(function() {
      return {
        chat: {
          completions: {
            create: createMock
          }
        }
      };
    })
  };
});

const mockCreate = (globalThis as any).__mockCreate;

import { callAgenticModel } from '../../src/utils/llm.js';

describe('llm.ts Tests', () => {
  beforeEach(() => {
    mockCreate.mockReset();
  });

  it('should successfully return content on 200 OK via OpenAI SDK', async () => {
    mockCreate.mockResolvedValue({
      choices: [
        {
          message: {
            content: 'Hello, I am the OpenAI SDK response.'
          }
        }
      ]
    });

    const result = await callAgenticModel([{ role: 'user', content: 'hello' }]);
    expect(result).toBe('Hello, I am the OpenAI SDK response.');
    expect(mockCreate).toHaveBeenCalledTimes(1);
  });

  it('should throw an error on API failure', async () => {
    mockCreate.mockRejectedValue(new Error('API failure'));

    await expect(callAgenticModel([{ role: 'user', content: 'hello' }])).rejects.toThrow('API failure');
  });
});
