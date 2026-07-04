import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import * as path from 'path';
import * as fs from 'fs';
import { fileURLToPath } from 'url';
import { checkPlugins } from '../commands/check-plugins.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const TEST_ROOT = path.resolve(__dirname, '..', '..', 'temp-plugin-tests');

describe('check-plugins command tests', () => {
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
    await expect(checkPlugins(path.join(TEST_ROOT, 'non-existent'))).rejects.toThrow('process.exit called');
    expect(exitSpy).toHaveBeenCalledWith(1);
    expect(errorSpy).toHaveBeenCalledWith(expect.stringContaining('does not exist'));
  });

  it('should exit with 1 if all schema/prompt files are missing', async () => {
    fs.mkdirSync(pluginPath);

    await expect(checkPlugins(pluginPath)).rejects.toThrow('process.exit called');
    expect(exitSpy).toHaveBeenCalledWith(1);
    expect(errorSpy).toHaveBeenCalledWith(expect.stringContaining("Plugin must contain at least one of"));
  });

  it('should pass if only schema.yml is present and valid', async () => {
    fs.mkdirSync(pluginPath);
    fs.writeFileSync(
      path.join(pluginPath, 'schema.yml'),
      `$meta:
  type: Schema
  title: Test Schema
  description: Test Desc

test_key: string # String | Optional | Valid
`
    );

    await checkPlugins(pluginPath);
    expect(exitSpy).not.toHaveBeenCalled();
    expect(logSpy).toHaveBeenCalledWith(expect.stringContaining('completed successfully'));
  });

  it('should pass if only prompt.md is present and valid', async () => {
    fs.mkdirSync(pluginPath);
    fs.writeFileSync(
      path.join(pluginPath, 'prompt.md'),
      `---
fields:
  - project
  - campaign
---
Prompt with $SCHEMA, $VALUE, $TIMESTAMP, $EXISTING_CONTENT, $SUMMARY_CONTENT
`
    );

    await checkPlugins(pluginPath);
    expect(exitSpy).not.toHaveBeenCalled();
    expect(logSpy).toHaveBeenCalledWith(expect.stringContaining('completed successfully'));
  });

  it('should exit with 1 if prompt.md frontmatter fields has invalid types', async () => {
    fs.mkdirSync(pluginPath);
    fs.writeFileSync(
      path.join(pluginPath, 'prompt.md'),
      `---
fields:
  - 123
---
Prompt content
`
    );

    await expect(checkPlugins(pluginPath)).rejects.toThrow('process.exit called');
    expect(exitSpy).toHaveBeenCalledWith(1);
    expect(errorSpy).toHaveBeenCalledWith(expect.stringContaining("fields' array must be strings"));
  });

  it('should exit with 1 if schema.yml lacks metadata block', async () => {
    fs.mkdirSync(pluginPath);
    fs.writeFileSync(path.join(pluginPath, 'schema.yml'), 'test_key: string');
    fs.writeFileSync(path.join(pluginPath, 'prompt.md'), 'some prompt');

    await expect(checkPlugins(pluginPath)).rejects.toThrow('process.exit called');
    expect(exitSpy).toHaveBeenCalledWith(1);
    expect(errorSpy).toHaveBeenCalledWith(expect.stringContaining("is missing a '$meta' configuration block"));
  });

  it('should exit with 1 if frontmatter is invalid YAML', async () => {
    fs.mkdirSync(pluginPath);
    fs.writeFileSync(
      path.join(pluginPath, 'schema.yml'),
      `$meta:
  type: Schema
  title: [unclosed list`
    );
    fs.writeFileSync(path.join(pluginPath, 'prompt.md'), 'some prompt');

    await expect(checkPlugins(pluginPath)).rejects.toThrow('process.exit called');
    expect(exitSpy).toHaveBeenCalledWith(1);
    expect(errorSpy).toHaveBeenCalledWith(expect.stringContaining("Failed to parse"));
  });

  it('should exit with 1 if frontmatter type is not Schema', async () => {
    fs.mkdirSync(pluginPath);
    fs.writeFileSync(
      path.join(pluginPath, 'schema.yml'),
      `$meta:
  type: SomethingElse
  title: Test Title
  description: Test Desc
test_key: string`
    );
    fs.writeFileSync(path.join(pluginPath, 'prompt.md'), 'some prompt');

    await expect(checkPlugins(pluginPath)).rejects.toThrow('process.exit called');
    expect(exitSpy).toHaveBeenCalledWith(1);
    expect(errorSpy).toHaveBeenCalledWith(expect.stringContaining("$meta 'type' must be 'Schema'"));
  });

  it('should pass silently if schema.yml contains no properties', async () => {
    fs.mkdirSync(pluginPath);
    fs.writeFileSync(
      path.join(pluginPath, 'schema.yml'),
      `$meta:
  type: Schema
  title: Test Schema
  description: Test Desc`
    );
    fs.writeFileSync(path.join(pluginPath, 'prompt.md'), '$VALUE $EXISTING_CONTENT $SUMMARY_CONTENT');

    await checkPlugins(pluginPath);
    expect(exitSpy).not.toHaveBeenCalled();
  });

  it('should exit with 1 if schema contains invalid keys', async () => {
    fs.mkdirSync(pluginPath);
    fs.writeFileSync(
      path.join(pluginPath, 'schema.yml'),
      `$meta:
  type: Schema
  title: Test Schema
  description: Test Desc

invalid key: string # String | Optional | Has spaces
`
    );
    fs.writeFileSync(path.join(pluginPath, 'prompt.md'), 'some prompt');

    await expect(checkPlugins(pluginPath)).rejects.toThrow('process.exit called');
    expect(exitSpy).toHaveBeenCalledWith(1);
    expect(errorSpy).toHaveBeenCalledWith(expect.stringContaining("Invalid key/sub-key name"));
  });

  it('should successfully pass verification with warnings for missing placeholders', async () => {
    fs.mkdirSync(pluginPath);
    fs.writeFileSync(
      path.join(pluginPath, 'schema.yml'),
      `$meta:
  type: Schema
  title: Test Schema
  description: Test Desc

test_key: string # String | Optional | Valid
`
    );
    // prompt has some placeholders but not all
    fs.writeFileSync(path.join(pluginPath, 'prompt.md'), 'Prompt with $SCHEMA and $VALUE');

    await checkPlugins(pluginPath);
    expect(exitSpy).not.toHaveBeenCalled();
    expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining('does not use the following placeholders'));
    expect(logSpy).toHaveBeenCalledWith(expect.stringContaining('completed successfully'));
  });

  it('should successfully pass verification with no warnings when all placeholders and metadata are correct', async () => {
    fs.mkdirSync(pluginPath);
    fs.writeFileSync(
      path.join(pluginPath, 'schema.yml'),
      `$meta:
  type: Schema
  title: Test Schema
  description: Test Desc

test_key: string # String | Optional | Valid
`
    );
    // prompt has all placeholders
    fs.writeFileSync(
      path.join(pluginPath, 'prompt.md'),
      'Prompt with $VALUE, $EXISTING_CONTENT, $SUMMARY_CONTENT'
    );

    await checkPlugins(pluginPath);
    expect(exitSpy).not.toHaveBeenCalled();
    expect(warnSpy).not.toHaveBeenCalled();
    expect(logSpy).toHaveBeenCalledWith(expect.stringContaining('completed successfully'));
  });
});
