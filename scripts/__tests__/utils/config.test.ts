import { describe, it, expect } from 'vitest';
import { config, projectRootDir } from '../../src/utils/config.js';
import * as path from 'path';

describe('config.ts Tests', () => {
  it('should resolve projectRootDir successfully', () => {
    expect(projectRootDir).toBeDefined();
    expect(path.isAbsolute(projectRootDir)).toBe(true);
  });

  it('should load config variables with sensible defaults or loaded values', () => {
    expect(config.vaultName).toBeDefined();
    expect(config.vaultsRoot).toBeDefined();
    expect(config.apiUrl).toBeDefined();
    expect(config.agenticModelName).toBeDefined();
    expect(config.ocrModelName).toBeDefined();
  });
});
