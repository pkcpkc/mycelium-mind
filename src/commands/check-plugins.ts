import * as fs from 'fs';
import * as path from 'path';
import YAML from 'yaml';
import { parseSchema } from '../utils/schema-parser.js';

/**
 * Validates a single plugin directory. Throws an Error if validation fails.
 */
export function checkSinglePlugin(pluginPath: string): void {
  const absolutePath = path.resolve(pluginPath);

  if (!fs.existsSync(absolutePath) || !fs.statSync(absolutePath).isDirectory()) {
    throw new Error(`Plugin directory '${absolutePath}' does not exist.`);
  }

  const extensionPath = path.join(absolutePath, 'summary-schema-extension.yml');
  const schemaPath = path.join(absolutePath, 'schema.yml');
  const promptPath = path.join(absolutePath, 'prompt.md');

  const hasExtension = fs.existsSync(extensionPath);
  const hasSchema = fs.existsSync(schemaPath);
  const hasPrompt = fs.existsSync(promptPath);

  // 1. Check at least one file is present
  if (!hasExtension && !hasSchema && !hasPrompt) {
    throw new Error(`Plugin must contain at least one of 'summary-schema-extension.yml', 'schema.yml', or 'prompt.md'.`);
  }

  const validateSchemaFile = (filePath: string) => {
    const content = fs.readFileSync(filePath, 'utf8');
    let parsed: any;
    try {
      parsed = parseSchema(content);
    } catch (err: any) {
      throw new Error(`Failed to parse '${filePath}': ${err.message}`);
    }

    const { meta, fields } = parsed;
    if (!meta || typeof meta !== 'object') {
      throw new Error(`'${filePath}' is missing a '$meta' configuration block.`);
    }

    if (meta.type !== 'Schema') {
      throw new Error(`'${filePath}' $meta 'type' must be 'Schema'. Found: ${meta.type}`);
    }

    if (!meta.title || !meta.title.trim()) {
      console.warn(`Warning: '${filePath}' $meta is missing a 'title'.`);
    }

    if (!meta.description || !meta.description.trim()) {
      console.warn(`Warning: '${filePath}' $meta is missing a 'description'.`);
    }

    let invalidKeysCount = 0;
    for (const field of fields) {
      // Validate key format (ignore nested brackets and array indicators)
      const parts = field.key.split(/\[\]\.?|\./).filter(Boolean);
      const validIdentifierRegex = /^[a-zA-Z_][a-zA-Z0-9_-]*$/;
      for (const part of parts) {
        if (!validIdentifierRegex.test(part)) {
          console.error(`Error: Invalid key/sub-key name '${part}' in field '${field.key}' of '${filePath}'. Key names must be alphanumeric/snake_case and start with a letter or underscore.`);
          invalidKeysCount++;
        }
      }
    }

    if (invalidKeysCount > 0) {
      throw new Error(`Invalid key names found in '${filePath}'.`);
    }
  };

  // 2. Validate schema files if they exist
  if (hasExtension) {
    validateSchemaFile(extensionPath);
  }

  if (hasSchema) {
    validateSchemaFile(schemaPath);
  }

  // 3. Validate prompt.md if it exists
  if (hasPrompt) {
    const promptContentRaw = fs.readFileSync(promptPath, 'utf8');
    let promptContent = promptContentRaw;
    let promptConfig: any = {};
    const frontmatterMatch = promptContentRaw.match(/^---\r?\n([\s\S]*?)\r?\n---(?:\r?\n|$)/);
    if (frontmatterMatch) {
      const frontmatterStr = frontmatterMatch[1];
      try {
        promptConfig = YAML.parse(frontmatterStr) || {};
        promptContent = promptContentRaw.slice(frontmatterMatch[0].length);
      } catch (err: any) {
        throw new Error(`Failed to parse '${promptPath}' frontmatter: ${err.message}`);
      }
    }

    if (promptConfig.fields !== undefined) {
      if (typeof promptConfig.fields !== 'string' && !Array.isArray(promptConfig.fields)) {
        throw new Error(`'${promptPath}' frontmatter 'fields' must be a string or an array of strings.`);
      }
      if (Array.isArray(promptConfig.fields)) {
        for (const field of promptConfig.fields) {
          if (typeof field !== 'string') {
            throw new Error(`All items in '${promptPath}' frontmatter 'fields' array must be strings.`);
          }
        }
      }
    }

    const expectedPlaceholders = [
      '$VALUE',
      '$EXISTING_CONTENT',
      '$SUMMARY_CONTENT',
    ];

    const missingPlaceholders: string[] = [];
    for (const placeholder of expectedPlaceholders) {
      if (!promptContentRaw.includes(placeholder)) {
        missingPlaceholders.push(placeholder);
      }
    }

    if (missingPlaceholders.length > 0) {
      console.warn(`Warning: '${promptPath}' does not use the following placeholders: ${missingPlaceholders.join(', ')}`);
      if (!promptContentRaw.includes('$VALUE')) {
        console.warn(`Warning: Critical placeholder '$VALUE' is missing from '${promptPath}'. This may prevent identifying the entity name.`);
      }
    }
  }

  console.log(`Plugin checks completed successfully for: ${path.basename(absolutePath)}`);
}

/**
 * Checks a plugin's schema and prompt configuration, or scans and checks all plugins if pointing to a wiki root.
 */
export async function checkPlugins(pluginPath: string): Promise<void> {
  const absolutePath = path.resolve(pluginPath);

  // Detect if target is a wiki vault root containing a plugins/ directory
  const pluginsDir = path.join(absolutePath, 'plugins');
  if (fs.existsSync(pluginsDir) && fs.statSync(pluginsDir).isDirectory()) {
    console.log(`Wiki vault root detected. Checking all plugins inside 'plugins/collections/' directory...`);
    const collectionsDir = path.join(pluginsDir, 'collections');
    const pluginDirs: string[] = [];

    if (fs.existsSync(collectionsDir) && fs.statSync(collectionsDir).isDirectory()) {
      const items = fs.readdirSync(collectionsDir);
      for (const item of items) {
        const itemPath = path.join(collectionsDir, item);
        if (fs.statSync(itemPath).isDirectory()) {
          pluginDirs.push(itemPath);
        }
      }
    }

    if (pluginDirs.length === 0) {
      console.log('No collection plugins found under plugins/collections/.');
      return;
    }

    let hasErrors = false;
    for (const dir of pluginDirs) {
      console.log(`\nChecking plugin: ${path.basename(dir)}`);
      try {
        checkSinglePlugin(dir);
      } catch (err: any) {
        console.error(`Error: Validation failed for plugin '${path.basename(dir)}': ${err.message}`);
        hasErrors = true;
      }
    }

    if (hasErrors) {
      console.error('\nError: Some plugin checks failed.');
      process.exit(1);
    }
    console.log('\nAll plugins validated successfully.');
    return;
  }

  // Otherwise, run validation on the single directory target
  try {
    checkSinglePlugin(absolutePath);
  } catch (err: any) {
    console.error(`Error: ${err.message}`);
    process.exit(1);
  }
}

/**
 * Validates all collection plugins registered in plugins/collections/ folder.
 */
export async function validateAllPlugins(wikiRoot: string): Promise<void> {
  const absolutePath = path.resolve(wikiRoot);
  const pluginsCollectionsDir = path.join(absolutePath, 'plugins', 'collections');
  if (fs.existsSync(pluginsCollectionsDir)) {
    const folders = fs.readdirSync(pluginsCollectionsDir).filter(f => fs.statSync(path.join(pluginsCollectionsDir, f)).isDirectory());
    for (const folder of folders) {
      await checkPlugins(path.join(pluginsCollectionsDir, folder));
    }
  }
}

