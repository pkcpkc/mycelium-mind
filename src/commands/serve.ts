import * as http from 'http';
import * as fs from 'fs';
import * as path from 'path';
import { getVaultDir } from '../utils/fs-utils.js';
import { projectRootDir } from '../utils/config.js';
import sirv from 'sirv';

/**
 * Spawns a minimal HTTP server serving the compiled static wiki.
 */
export async function serveWiki(targetPath: string): Promise<http.Server> {
  let serveDir = '';
  const resolvedPath = path.resolve(targetPath);

  if (fs.existsSync(resolvedPath)) {
    const stat = fs.statSync(resolvedPath);
    if (stat.isDirectory()) {
      if (fs.existsSync(path.join(resolvedPath, 'index.html'))) {
        serveDir = resolvedPath;
      } else if (fs.existsSync(path.join(resolvedPath, 'wiki'))) {
        const vaultName = path.basename(resolvedPath);
        serveDir = path.resolve(projectRootDir, 'dist', vaultName);
      } else {
        serveDir = resolvedPath;
      }
    } else {
      serveDir = path.dirname(resolvedPath);
    }
  } else {
    try {
      const vaultRoot = getVaultDir(targetPath);
      const vaultName = path.basename(vaultRoot);
      serveDir = path.resolve(projectRootDir, 'dist', vaultName);
    } catch {
      throw new Error(`Path '${targetPath}' does not exist.`);
    }
  }

  if (!fs.existsSync(serveDir) || !fs.statSync(serveDir).isDirectory()) {
    throw new Error(`Resolved serve directory '${serveDir}' does not exist. Did you run publish first?`);
  }

  console.log(`Serving static files from: ${serveDir}`);

  // Create sirv middleware to handle file requests, path decodes, and content types
  const sirvMiddleware = sirv(serveDir, {
    dev: true,
    single: false,
    dotfiles: true,
  });

  const server = http.createServer((req, res) => {
    sirvMiddleware(req, res, () => {
      res.statusCode = 404;
      res.setHeader('Content-Type', 'text/plain; charset=utf-8');
      res.end('404 Not Found');
    });
  });

  const startPort = 8080;
  let port = startPort;

  const listen = (p: number): Promise<void> => {
    return new Promise<void>((resolve, reject) => {
      server.listen(p, () => {
        console.log(`\nWiki static server is running!`);
        console.log(`URL: http://localhost:${p}\n`);
        resolve();
      });

      server.on('error', (err: any) => {
        if (err.code === 'EADDRINUSE') {
          console.log(`Port ${p} is in use, trying next port...`);
          resolve(listen(p + 1));
        } else {
          reject(err);
        }
      });
    });
  };

  await listen(port);
  return server;
}
