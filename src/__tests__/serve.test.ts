import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as path from 'path';
import * as fs from 'fs';
import { fileURLToPath } from 'url';
import * as http from 'http';
import { serveWiki } from '../commands/serve.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const TEST_ROOT = path.resolve(__dirname, '..', '..', 'temp-serve-tests');

describe('serve command tests', () => {
  let server: http.Server | null = null;
  const webDir = path.join(TEST_ROOT, 'public');

  beforeEach(() => {
    fs.mkdirSync(webDir, { recursive: true });
    fs.writeFileSync(path.join(webDir, 'index.html'), '<h1>Hello Wiki</h1>', 'utf8');
    fs.writeFileSync(path.join(webDir, 'style.css'), 'body { color: red; }', 'utf8');
    fs.writeFileSync(path.join(webDir, 'some page name with spaces.html'), 'spaces are decoded', 'utf8');
    fs.writeFileSync(path.join(webDir, 'S&P Sovereign Credit Rating Methodology.html'), 'S&P methodology content', 'utf8');
  });

  afterEach(async () => {
    if (server) {
      await new Promise<void>((resolve) => server!.close(() => resolve()));
      server = null;
    }
    fs.rmSync(TEST_ROOT, { recursive: true, force: true });
  });

  it('should serve index.html and style.css on standard port', async () => {
    server = await serveWiki(webDir);
    const address = server.address();
    expect(address).toBeDefined();
    expect(typeof address).not.toBe('string');
    const port = (address as any).port;

    // Fetch index.html
    const indexRes = await new Promise<{ status: number; body: string; contentType: string }>((resolve, reject) => {
      http.get(`http://localhost:${port}/`, (res) => {
        let body = '';
        res.on('data', (chunk) => body += chunk);
        res.on('end', () => resolve({
          status: res.statusCode || 0,
          body,
          contentType: res.headers['content-type'] || '',
        }));
      }).on('error', reject);
    });

    expect(indexRes.status).toBe(200);
    expect(indexRes.body).toBe('<h1>Hello Wiki</h1>');
    expect(indexRes.contentType).toContain('text/html');

    // Fetch style.css
    const cssRes = await new Promise<{ status: number; body: string; contentType: string }>((resolve, reject) => {
      http.get(`http://localhost:${port}/style.css`, (res) => {
        let body = '';
        res.on('data', (chunk) => body += chunk);
        res.on('end', () => resolve({
          status: res.statusCode || 0,
          body,
          contentType: res.headers['content-type'] || '',
        }));
      }).on('error', reject);
    });

    expect(cssRes.status).toBe(200);
    expect(cssRes.body).toBe('body { color: red; }');
    expect(cssRes.contentType).toContain('text/css');

    // Fetch page with spaces
    const spacesRes = await new Promise<{ status: number; body: string }>((resolve, reject) => {
      http.get(`http://localhost:${port}/some%20page%20name%20with%20spaces.html`, (res) => {
        let body = '';
        res.on('data', (chunk) => body += chunk);
        res.on('end', () => resolve({
          status: res.statusCode || 0,
          body,
        }));
      }).on('error', reject);
    });

    expect(spacesRes.status).toBe(200);
    expect(spacesRes.body).toBe('spaces are decoded');

    // Fetch page with ampersand and spaces
    const spRes = await new Promise<{ status: number; body: string }>((resolve, reject) => {
      http.get(`http://localhost:${port}/S%26P%20Sovereign%20Credit%20Rating%20Methodology.html`, (res) => {
        let body = '';
        res.on('data', (chunk) => body += chunk);
        res.on('end', () => resolve({
          status: res.statusCode || 0,
          body,
        }));
      }).on('error', reject);
    });

    expect(spRes.status).toBe(200);
    expect(spRes.body).toBe('S&P methodology content');

    // Fetch 404
    const notFoundRes = await new Promise<{ status: number }>((resolve, reject) => {
      http.get(`http://localhost:${port}/not-found.html`, (res) => {
        res.resume();
        resolve({ status: res.statusCode || 0 });
      }).on('error', reject);
    });

    expect(notFoundRes.status).toBe(404);
  });
});
