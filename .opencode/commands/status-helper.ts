import * as fs from 'fs';
import * as path from 'path';

const statusFilePath = path.resolve(process.cwd(), '.opencode', 'command-hooks-status.json');

export function updateStatus(message: string, progress?: string) {
  try {
    fs.mkdirSync(path.dirname(statusFilePath), { recursive: true });
    fs.writeFileSync(statusFilePath, JSON.stringify({ message, progress, timestamp: Date.now() }), 'utf8');
  } catch (e) {
    // Ignore error
  }
}

export function cleanStatus() {
  try {
    if (fs.existsSync(statusFilePath)) {
      fs.unlinkSync(statusFilePath);
    }
  } catch (e) {
    // Ignore error
  }
}
