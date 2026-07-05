import * as fs from 'fs';
import * as path from 'path';
import { spawn } from 'child_process';
import YAML from 'yaml';
import { projectRootDir } from '../utils/config.js';

export interface RagFlags {
  transport?: string;
  port?: number;
  host?: string;
  rateLimit?: number;
  prometheusPort?: number;
  chromadbWal?: boolean;
}

/**
 * Spawns the knowledge-rag MCP server with configured parameters.
 */
export async function ragWiki(wikiPath: string, flags: RagFlags): Promise<void> {
  const absolutePath = path.resolve(wikiPath);

  // 1. Read config.yml from wiki
  const configPath = path.join(absolutePath, 'config', 'config.yml');
  let configRag: any = {};
  if (fs.existsSync(configPath)) {
    try {
      const parsed = YAML.parse(fs.readFileSync(configPath, 'utf8'));
      if (parsed && parsed.rag) {
        configRag = parsed.rag;
      }
    } catch (e: any) {
      console.warn(`Failed to parse config.yml at ${configPath}:`, e.message);
    }
  }

  // 2. Resolve flags with config.yml fallback
  const transport = flags.transport || configRag.transport || 'sse';
  const host = flags.host || configRag.host || '127.0.0.1';
  const port = flags.port !== undefined ? flags.port : (configRag.port !== undefined ? configRag.port : 8179);
  const chromadbWal = flags.chromadbWal || configRag.chromadb_wal || false;

  // Rate Limiting settings
  let rateLimitingEnabled = false;
  let requestsPerMinute = 60;
  let burst = 10;
  if (flags.rateLimit !== undefined) {
    rateLimitingEnabled = true;
    requestsPerMinute = flags.rateLimit;
  } else if (configRag.rate_limiting) {
    rateLimitingEnabled = configRag.rate_limiting.enabled ?? false;
    requestsPerMinute = configRag.rate_limiting.requests_per_minute ?? 60;
    burst = configRag.rate_limiting.burst ?? 10;
  }

  // Prometheus metrics settings
  let prometheusEnabled = false;
  let prometheusPort = 9179;
  if (flags.prometheusPort !== undefined) {
    prometheusEnabled = true;
    prometheusPort = flags.prometheusPort;
  } else if (configRag.prometheus) {
    prometheusEnabled = configRag.prometheus.enabled ?? false;
    prometheusPort = configRag.prometheus.port ?? 9179;
  }

  // 3. Prepare config/data folder
  const ragDir = path.join(absolutePath, '.rag');
  const ragDataDir = path.join(ragDir, 'data');
  if (!fs.existsSync(ragDir)) {
    fs.mkdirSync(ragDir, { recursive: true });
  }
  if (!fs.existsSync(ragDataDir)) {
    fs.mkdirSync(ragDataDir, { recursive: true });
  }

  // Add to gitignore if not present
  const gitignorePath = path.join(absolutePath, '.gitignore');
  if (fs.existsSync(gitignorePath)) {
    try {
      let gitignoreContent = fs.readFileSync(gitignorePath, 'utf8');
      if (!gitignoreContent.includes('.rag')) {
        gitignoreContent = gitignoreContent.trimEnd() + '\n\n# RAG data and temporary config\n.rag\n';
        fs.writeFileSync(gitignorePath, gitignoreContent, 'utf8');
      }
    } catch (e: any) {
      console.warn(`Failed to update .gitignore:`, e.message);
    }
  }

  // 4. Generate config.yaml for knowledge-rag
  const generatedConfig: any = {
    documents_dir: path.join(absolutePath, 'wiki'),
    data_dir: ragDataDir,
    server: {
      transport,
      host,
      port,
    }
  };

  if (rateLimitingEnabled) {
    generatedConfig.rate_limiting = {
      requests_per_minute: requestsPerMinute,
      burst,
    };
  }

  if (prometheusEnabled) {
    generatedConfig.prometheus = {
      enabled: true,
      port: prometheusPort,
    };
  }

  if (chromadbWal) {
    generatedConfig.chromadb_wal = true;
  }

  const generatedConfigPath = path.join(ragDir, 'config.yaml');
  fs.writeFileSync(generatedConfigPath, YAML.stringify(generatedConfig), 'utf8');

  // 5. Resolve python virtual environment and knowledge-rag executable
  let executable = '';
  let runArgs: string[] = [];

  const venvBinDir = path.resolve(projectRootDir, '.venv', 'bin');
  const venvKnowledgeRag = path.join(venvBinDir, 'knowledge-rag');
  const venvPython = path.join(venvBinDir, 'python');

  if (fs.existsSync(venvKnowledgeRag)) {
    executable = venvKnowledgeRag;
  } else if (fs.existsSync(venvPython)) {
    executable = venvPython;
    runArgs = ['-m', 'knowledge_rag'];
  } else {
    executable = 'knowledge-rag';
  }

  // Add CLI arguments
  runArgs.push('--transport', transport);
  if (transport !== 'stdio') {
    runArgs.push('--host', host);
    runArgs.push('--port', port.toString());
  }

  console.log(`Starting knowledge-rag MCP server...`);
  console.log(`  Executable: ${executable}`);
  console.log(`  Arguments:  ${runArgs.join(' ')}`);
  console.log(`  Transport:  ${transport}`);
  if (transport !== 'stdio') {
    console.log(`  URL:        http://${host}:${port}`);
    if (prometheusEnabled) {
      console.log(`  Metrics:    http://${host}:${prometheusPort}/metrics`);
    }
  }

  // 6. Spawn process
  const env = {
    ...process.env,
    BASE_DIR: ragDir,
  };

  const child = spawn(executable, runArgs, {
    env,
    stdio: transport === 'stdio' ? ['pipe', 'pipe', 'inherit'] : 'inherit',
  });

  if (transport === 'stdio') {
    process.stdin.pipe(child.stdin!);
    child.stdout!.pipe(process.stdout);
  }

  // Clean up on exit
  const handleSignal = (signal: string) => {
    if (!child.killed) {
      child.kill(signal as any);
    }
    process.exit(0);
  };

  process.on('SIGINT', () => handleSignal('SIGINT'));
  process.on('SIGTERM', () => handleSignal('SIGTERM'));

  child.on('error', (err: any) => {
    console.error('Failed to start knowledge-rag MCP server:', err.message);
    if (err.code === 'ENOENT') {
      console.error('\nEnsure knowledge-rag is installed in your python environment:');
      console.error('  mise exec -- uv pip install knowledge-rag\n');
    }
    process.exit(1);
  });

  child.on('exit', (code) => {
    process.exit(code || 0);
  });
}
