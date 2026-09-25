import { describe, it, expect, vi } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';
import {
  validateAndFormatBaseUrl,
  getOpenAI,
  callOcrModel,
  isNonRecoverableError
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

  describe('Speech-to-Text (STT) Audio Transcription', () => {
    it('should transcribe an audio file using the configured STT model', async () => {
      const { callSttModel } = await import('../utils/openai-api.js');
      const { transcribeAudio } = await import('../core/asset-extractor.js');

      const testAudioPath = path.join(__dirname, 'test-sample.mp3');
      fs.writeFileSync(testAudioPath, 'fake-mp3-audio-bytes', 'utf8');

      const client = getOpenAI(config.sttModelApiUrl, config.sttModelApiKey, 'STT_MODEL_API_URL');
      const transcriptSpy = vi.spyOn(client.audio.transcriptions, 'create').mockResolvedValue({
        text: 'This is the transcribed speech from the audio file.',
      } as any);

      try {
        const text = await transcribeAudio(testAudioPath);
        expect(text).toBe('This is the transcribed speech from the audio file.');
        expect(transcriptSpy).toHaveBeenCalledWith(
          expect.objectContaining({
            model: config.sttModelName,
          })
        );
      } finally {
        if (fs.existsSync(testAudioPath)) {
          fs.unlinkSync(testAudioPath);
        }
        transcriptSpy.mockRestore();
      }
    });

    it('should throw an error if STT response is empty', async () => {
      const { callSttModel } = await import('../utils/openai-api.js');
      const testAudioPath = path.join(__dirname, 'test-empty.mp3');
      fs.writeFileSync(testAudioPath, 'fake-mp3-bytes', 'utf8');

      const client = getOpenAI(config.sttModelApiUrl, config.sttModelApiKey, 'STT_MODEL_API_URL');
      const transcriptSpy = vi.spyOn(client.audio.transcriptions, 'create').mockResolvedValue({
        text: '',
      } as any);

      try {
        await expect(callSttModel(testAudioPath)).rejects.toThrow('Empty STT transcription response');
      } finally {
        if (fs.existsSync(testAudioPath)) {
          fs.unlinkSync(testAudioPath);
        }
        transcriptSpy.mockRestore();
      }
    });

    it('should transcribe audio file and archive it during extractAsset pre-step', async () => {
      const { extractAsset } = await import('../core/asset-extractor.js');

      const tempDir = path.join(__dirname, 'temp-asset-test');
      const processedDir = path.join(tempDir, 'processed');
      const sourcesDir = path.join(tempDir, 'sources');
      fs.mkdirSync(processedDir, { recursive: true });
      fs.mkdirSync(sourcesDir, { recursive: true });

      const audioFilePath = path.join(tempDir, 'interview.m4a');
      const companionMdPath = path.join(tempDir, 'interview.md');
      fs.writeFileSync(audioFilePath, 'fake-m4a-data', 'utf8');
      fs.writeFileSync(companionMdPath, '---\ntitle: Sovereign Rating Interview\n---\nNotes here', 'utf8');

      const client = getOpenAI(config.sttModelApiUrl, config.sttModelApiKey, 'STT_MODEL_API_URL');
      const transcriptSpy = vi.spyOn(client.audio.transcriptions, 'create').mockResolvedValue({
        text: 'Sovereign credit ratings reflect probability of default and fiscal backstop capacity.',
      } as any);

      try {
        const result = await extractAsset(
          audioFilePath,
          {
            processedDir,
            sourcesDir,
            dateToday: '2026-09-24',
            absoluteWikiRoot: tempDir,
          },
          companionMdPath
        );

        expect(result.rawText).toBe('Sovereign credit ratings reflect probability of default and fiscal backstop capacity.');
        expect(result.companionMetadata).toContain('Sovereign Rating Interview');
        expect(result.referencedAssets).toContain('wiki/assets/2026-09-24/processed/interview.m4a');
        expect(result.referencedAssets).toContain('wiki/assets/2026-09-24/sources/interview_transcription.txt');
        expect(result.referencedAssets).toContain('wiki/assets/2026-09-24/processed/interview.md');

        // File checks
        expect(fs.existsSync(path.join(processedDir, 'interview.m4a'))).toBe(true);
        expect(fs.existsSync(path.join(sourcesDir, 'interview_transcription.txt'))).toBe(true);
        const savedText = fs.readFileSync(path.join(sourcesDir, 'interview_transcription.txt'), 'utf8');
        expect(savedText).toBe('Sovereign credit ratings reflect probability of default and fiscal backstop capacity.');
      } finally {
        transcriptSpy.mockRestore();
        fs.rmSync(tempDir, { recursive: true, force: true });
      }
    });
  });

  describe('isNonRecoverableError', () => {
    it('should identify HTTP 401 as non-recoverable', () => {
      expect(isNonRecoverableError({ status: 401, message: '401 Invalid API key' })).toBe(true);
    });

    it('should identify HTTP 403 as non-recoverable', () => {
      expect(isNonRecoverableError({ status: 403, message: 'Forbidden' })).toBe(true);
    });

    it('should identify ECONNREFUSED as non-recoverable', () => {
      expect(isNonRecoverableError({ code: 'ECONNREFUSED', message: 'connect ECONNREFUSED 127.0.0.1:8000' })).toBe(true);
      expect(isNonRecoverableError({ cause: { code: 'ECONNREFUSED' }, message: 'fetch failed' })).toBe(true);
    });

    it('should identify invalid API key message as non-recoverable', () => {
      expect(isNonRecoverableError(new Error('Incorrect API key provided'))).toBe(true);
      expect(isNonRecoverableError(new Error('Unauthorized access'))).toBe(true);
    });

    it('should identify model not found as non-recoverable', () => {
      expect(isNonRecoverableError({ status: 404, message: 'Model not found' })).toBe(true);
    });

    it('should return false for transient errors', () => {
      expect(isNonRecoverableError(new Error('Request timed out after 30000ms'))).toBe(false);
      expect(isNonRecoverableError({ status: 500, message: 'Internal Server Error' })).toBe(false);
      expect(isNonRecoverableError(null)).toBe(false);
    });
  });
});


