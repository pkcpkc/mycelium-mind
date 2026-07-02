import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import * as path from 'path';
import * as fs from 'fs';
import { fileURLToPath } from 'url';
import { checkPlugin } from '../commands/check-plugin.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const TEST_ROOT = path.resolve(__dirname, '..', '..', 'temp-plugin-tests');

describe('check-plugin command tests', () => {
  const pluginPath = path.join(TEST_ROOT, 'test-plugin');
  let exitSpy: any;
  let errorSpy: any;
  let warnSpy: any;
  let logSpy: any;

  beforeEach(() => {
    fs.mkdirSync(TEST_ROOT, { recursive: true });
    exitSpy = vi.spyOn(process, 'exit').mockImplementation(() => {
      throw new Error('process.exit called');
    });
    errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
  });

  afterEach(() => {
    fs.rmSync(TEST_ROOT, { recursive: true, force: true });
    vi.restoreAllMocks();
  });

  it('should exit with 1 if plugin directory does not exist', async () => {
    await expect(checkPlugin(path.join(TEST_ROOT, 'non-existent'))).rejects.toThrow('process.exit called');
    expect(exitSpy).toHaveBeenCalledWith(1);
    expect(errorSpy).toHaveBeenCalledWith(expect.stringContaining('does not exist'));
  });

  it('should exit with 1 if schema.md is missing', async () => {
    fs.mkdirSync(pluginPath);
    fs.writeFileSync(path.join(pluginPath, 'prompt.md'), 'some prompt');

    await expect(checkPlugin(pluginPath)).rejects.toThrow('process.exit called');
    expect(exitSpy).toHaveBeenCalledWith(1);
    expect(errorSpy).toHaveBeenCalledWith(expect.stringContaining("Required file 'schema.md' is missing"));
  });

  it('should exit with 1 if prompt.md is missing', async () => {
    fs.mkdirSync(pluginPath);
    fs.writeFileSync(path.join(pluginPath, 'schema.md'), 'some schema');

    await expect(checkPlugin(pluginPath)).rejects.toThrow('process.exit called');
    expect(exitSpy).toHaveBeenCalledWith(1);
    expect(errorSpy).toHaveBeenCalledWith(expect.stringContaining("Required file 'prompt.md' is missing"));
  });

  it('should exit with 1 if schema.md lacks frontmatter delimiters', async () => {
    fs.mkdirSync(pluginPath);
    fs.writeFileSync(path.join(pluginPath, 'schema.md'), 'type: Schema\ntitle: Test');
    fs.writeFileSync(path.join(pluginPath, 'prompt.md'), 'some prompt');

    await expect(checkPlugin(pluginPath)).rejects.toThrow('process.exit called');
    expect(exitSpy).toHaveBeenCalledWith(1);
    expect(errorSpy).toHaveBeenCalledWith(expect.stringContaining("frontmatter is missing or not enclosed"));
  });

  it('should exit with 1 if frontmatter is invalid YAML', async () => {
    fs.mkdirSync(pluginPath);
    fs.writeFileSync(
      path.join(pluginPath, 'schema.md'),
      `---
type: Schema
title: [unclosed list
---`
    );
    fs.writeFileSync(path.join(pluginPath, 'prompt.md'), 'some prompt');

    await expect(checkPlugin(pluginPath)).rejects.toThrow('process.exit called');
    expect(exitSpy).toHaveBeenCalledWith(1);
    expect(errorSpy).toHaveBeenCalledWith(expect.stringContaining("Failed to parse 'schema.md' frontmatter"));
  });

  it('should exit with 1 if frontmatter type is not Schema', async () => {
    fs.mkdirSync(pluginPath);
    fs.writeFileSync(
      path.join(pluginPath, 'schema.md'),
      `---
type: SomethingElse
title: Test Title
description: Test Desc
---`
    );
    fs.writeFileSync(path.join(pluginPath, 'prompt.md'), 'some prompt');

    await expect(checkPlugin(pluginPath)).rejects.toThrow('process.exit called');
    expect(exitSpy).toHaveBeenCalledWith(1);
    expect(errorSpy).toHaveBeenCalledWith(expect.stringContaining("frontmatter 'type' must be 'Schema'"));
  });

  it('should exit with 1 if schema.md properties table is missing', async () => {
    fs.mkdirSync(pluginPath);
    fs.writeFileSync(
      path.join(pluginPath, 'schema.md'),
      `---
type: Schema
title: Test Schema
description: Test Desc
---
No table here.`
    );
    fs.writeFileSync(path.join(pluginPath, 'prompt.md'), 'some prompt');

    await expect(checkPlugin(pluginPath)).rejects.toThrow('process.exit called');
    expect(exitSpy).toHaveBeenCalledWith(1);
    expect(errorSpy).toHaveBeenCalledWith(expect.stringContaining("must contain a properties markdown table"));
  });

  it('should exit with 1 if schema table contains invalid keys', async () => {
    fs.mkdirSync(pluginPath);
    fs.writeFileSync(
      path.join(pluginPath, 'schema.md'),
      `---
type: Schema
title: Test Schema
description: Test Desc
---
| Key | Type | Requirement | Description |
|---|---|---|---|
| invalid key | String | Optional | Has spaces |
`
    );
    fs.writeFileSync(path.join(pluginPath, 'prompt.md'), 'some prompt');

    await expect(checkPlugin(pluginPath)).rejects.toThrow('process.exit called');
    expect(exitSpy).toHaveBeenCalledWith(1);
    expect(errorSpy).toHaveBeenCalledWith(expect.stringContaining("Invalid key name 'invalid key'"));
  });

  it('should successfully pass verification with warnings for missing placeholders', async () => {
    fs.mkdirSync(pluginPath);
    fs.writeFileSync(
      path.join(pluginPath, 'schema.md'),
      `---
type: Schema
title: Test Schema
description: Test Desc
---
| Key | Type | Requirement | Description |
|---|---|---|---|
| test_key | String | Optional | Valid |
`
    );
    // prompt has some placeholders but not all
    fs.writeFileSync(path.join(pluginPath, 'prompt.md'), 'Prompt with $SCHEMA and $VALUE');

    await checkPlugin(pluginPath);
    expect(exitSpy).not.toHaveBeenCalled();
    expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining('does not use the following placeholders'));
    expect(logSpy).toHaveBeenCalledWith(expect.stringContaining('completed successfully'));
  });

  it('should successfully pass verification with no warnings when all placeholders and metadata are correct', async () => {
    fs.mkdirSync(pluginPath);
    fs.writeFileSync(
      path.join(pluginPath, 'schema.md'),
      `---
type: Schema
title: Test Schema
description: Test Desc
---
| Key | Type | Requirement | Description |
|---|---|---|---|
| test_key | String | Optional | Valid |
`
    );
    // prompt has all placeholders
    fs.writeFileSync(
      path.join(pluginPath, 'prompt.md'),
      'Prompt with $SCHEMA, $VALUE, $TIMESTAMP, $EXISTING_CONTENT, $SUMMARY_CONTENT'
    );

    await checkPlugin(pluginPath);
    expect(exitSpy).not.toHaveBeenCalled();
    expect(warnSpy).not.toHaveBeenCalled();
    expect(logSpy).toHaveBeenCalledWith(expect.stringContaining('completed successfully'));
  });
});
