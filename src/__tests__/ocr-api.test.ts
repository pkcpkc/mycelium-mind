import { describe, it, expect, vi } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';
import {
  validateAndFormatBaseUrl,
  getOpenAI,
  callOcrModel
} from '../utils/openai-api.js';
import { config } from '../utils/config.js';
import { ocrImage } from '../core/asset-extractor.js';

describe('OpenAI API & OCR Pipeline Tests', () => {
  describe('validateAndFormatBaseUrl', () => {
    it('should correctly format valid OpenAI base URLs', () => {
      expect(validateAndFormatBaseUrl('http://localhost:8000/v1')).toBe('http://localhost:8000/v1');
      expect(validateAndFormatBaseUrl('https://api.openai.com/v1')).toBe('https://api.openai.com/v1');
    });

    it('should strip trailing slashes and whitespace', () => {
      expect(validateAndFormatBaseUrl('  http://localhost:8000/v1/  ')).toBe('http://localhost:8000/v1');
      expect(validateAndFormatBaseUrl('http://localhost:8000/v1///')).toBe('http://localhost:8000/v1');
    });

    it('should throw an informative error when URL is empty', () => {
      expect(() => validateAndFormatBaseUrl('', 'TEST_URL')).toThrowError(
        'Invalid TEST_URL: URL cannot be empty. Expected an OpenAI Base URL'
      );
    });

    it('should throw an informative error when /chat/completions is provided (enforcing SemVer breaking change)', () => {
      expect(() => validateAndFormatBaseUrl('http://localhost:8000/v1/chat/completions', 'OCR_MODEL_API_URL'))
        .toThrowError(
          'Invalid OCR_MODEL_API_URL: "http://localhost:8000/v1/chat/completions". Expected an OpenAI Base URL (e.g. "http://localhost:8000/v1"), not an endpoint path ending with "/chat/completions".'
        );

      expect(() => validateAndFormatBaseUrl('http://localhost:8000/v1/chat/completions/', 'OCR_MODEL_API_URL'))
        .toThrowError(
          'Invalid OCR_MODEL_API_URL: "http://localhost:8000/v1/chat/completions/". Expected an OpenAI Base URL (e.g. "http://localhost:8000/v1"), not an endpoint path ending with "/chat/completions".'
        );
    });
  });

  describe('getOpenAI client caching', () => {
    it('should cache and return the same client for identical endpoint and key', () => {
      const client1 = getOpenAI('http://localhost:8000/v1', 'test-key');
      const client2 = getOpenAI('http://localhost:8000/v1', 'test-key');
      expect(client1).toBe(client2);
    });

    it('should use dummy-key when API key is empty or dummy-key', () => {
      const client = getOpenAI('http://localhost:9000/v1', '');
      expect(client.apiKey).toBe('dummy-key');

      const clientDummy = getOpenAI('http://localhost:9001/v1', 'dummy-key');
      expect(clientDummy.apiKey).toBe('dummy-key');
    });
  });

  describe('callOcrModel', () => {
    it('should call chat.completions.create with multimodal image payload', async () => {
      const client = getOpenAI(config.ocrModelApiUrl, config.ocrModelApiKey, 'OCR_MODEL_API_URL');
      const createSpy = vi.spyOn(client.chat.completions, 'create').mockResolvedValue({
        choices: [
          {
            message: {
              content: 'Extracted OCR text content',
              role: 'assistant',
            },
          },
        ],
      } as any);

      const result = await callOcrModel('dGVzdA==', 'png');

      expect(createSpy).toHaveBeenCalledWith({
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
                  url: 'data:image/png;base64,dGVzdA==',
                },
              },
            ],
          },
        ],
      });

      expect(result).toBe('Extracted OCR text content');
      createSpy.mockRestore();
    });

    it('should throw an error if OCR response content is empty', async () => {
      const client = getOpenAI(config.ocrModelApiUrl, config.ocrModelApiKey, 'OCR_MODEL_API_URL');
      const createSpy = vi.spyOn(client.chat.completions, 'create').mockResolvedValue({
        choices: [
          {
            message: {
              content: '',
              role: 'assistant',
            },
          },
        ],
      } as any);

      await expect(callOcrModel('dGVzdA==', 'png')).rejects.toThrow('Empty OCR response content');
      createSpy.mockRestore();
    });
  });

  describe('ocrImage integration', () => {
    it('should read file, extract format, and return OCR text', async () => {
      const testImgPath = path.join(__dirname, 'test-sample.jpg');
      fs.writeFileSync(testImgPath, 'fake-jpeg-data', 'utf8');

      const client = getOpenAI(config.ocrModelApiUrl, config.ocrModelApiKey, 'OCR_MODEL_API_URL');
      const createSpy = vi.spyOn(client.chat.completions, 'create').mockResolvedValue({
        choices: [
          {
            message: {
              content: 'Decoded JPEG OCR result',
              role: 'assistant',
            },
          },
        ],
      } as any);

      try {
        const text = await ocrImage(testImgPath);
        expect(text).toBe('Decoded JPEG OCR result');
        expect(createSpy).toHaveBeenCalledWith(
          expect.objectContaining({
            messages: [
              expect.objectContaining({
                content: expect.arrayContaining([
                  expect.objectContaining({
                    type: 'image_url',
                    image_url: {
                      url: expect.stringMatching(/^data:image\/jpeg;base64,/),
                    },
                  }),
                ]),
              }),
            ],
          })
        );
      } finally {
        if (fs.existsSync(testImgPath)) {
          fs.unlinkSync(testImgPath);
        }
        createSpy.mockRestore();
      }
    });
  });
});
