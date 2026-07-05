import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRootDir = path.resolve(__dirname, '..');

function run(cmd, opts = {}) {
  try {
    execSync(cmd, { stdio: 'inherit', cwd: projectRootDir, ...opts });
    return true;
  } catch (e) {
    return false;
  }
}

console.log('Setting up Python virtual environment and dependencies...');

// 1. Check if .venv exists, if not, create it
const venvPath = path.join(projectRootDir, '.venv');
if (!fs.existsSync(venvPath)) {
  console.log('Creating virtual environment (.venv)...');
  let created = false;
  
  // Try uv venv first, then fallback to python -m venv
  if (run('uv venv')) {
    created = true;
  } else if (run('python3 -m venv .venv') || run('python -m venv .venv')) {
    created = true;
  }

  if (!created) {
    console.warn('Warning: Could not create Python virtual environment. Please install python3-venv or uv.');
    process.exit(0);
  }
}

// 2. Install dependencies from requirements.txt
console.log('Installing dependencies from requirements.txt...');
let installed = false;

// Try uv pip install via mise, then uv globally, then fall back to standard pip
if (run('mise exec -- uv pip install -r requirements.txt')) {
  installed = true;
} else if (run('uv pip install -r requirements.txt')) {
  installed = true;
} else {
  const pipPath = process.platform === 'win32'
    ? path.join(venvPath, 'Scripts', 'pip.exe')
    : path.join(venvPath, 'bin', 'pip');
  
  if (fs.existsSync(pipPath)) {
    if (run(`"${pipPath}" install -r requirements.txt`)) {
      installed = true;
    }
  } else {
    if (run('python3 -m pip install -r requirements.txt') || run('python -m pip install -r requirements.txt')) {
      installed = true;
    }
  }
}

if (installed) {
  console.log('Python environment setup completed successfully!');
} else {
  console.warn('Warning: Failed to install Python dependencies. Please run "pip install -r requirements.txt" manually.');
}
