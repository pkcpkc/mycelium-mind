import * as fs from 'fs';
import * as path from 'path';
import YAML from 'yaml';

/**
 * Checks a plugin's schema and prompt configuration for completeness and validity.
 */
export async function checkPlugin(pluginPath: string): Promise<void> {
  const absolutePath = path.resolve(pluginPath);
  console.log(`Checking plugin at: ${absolutePath}`);

  if (!fs.existsSync(absolutePath) || !fs.statSync(absolutePath).isDirectory()) {
    console.error(`Error: Plugin directory '${absolutePath}' does not exist.`);
    process.exit(1);
  }

  const schemaPath = path.join(absolutePath, 'schema.md');
  const promptPath = path.join(absolutePath, 'prompt.md');

  // 1. Check all required files are present
  let hasMissingFiles = false;
  if (!fs.existsSync(schemaPath)) {
    console.error(`Error: Required file 'schema.md' is missing in the plugin directory.`);
    hasMissingFiles = true;
  }
  if (!fs.existsSync(promptPath)) {
    console.error(`Error: Required file 'prompt.md' is missing in the plugin directory.`);
    hasMissingFiles = true;
  }
  if (hasMissingFiles) {
    process.exit(1);
  }

  // 2. Check schema.md frontmatter is parseable and valid
  const schemaContent = fs.readFileSync(schemaPath, 'utf8');
  const frontmatterMatch = schemaContent.match(/^---\r?\n([\s\S]*?)\r?\n---(?:\r?\n|$)/);
  if (!frontmatterMatch) {
    console.error(`Error: 'schema.md' frontmatter is missing or not enclosed in '---' delimiters.`);
    process.exit(1);
  }

  const frontmatterStr = frontmatterMatch[1];
  let frontmatter: any;
  try {
    frontmatter = YAML.parse(frontmatterStr);
  } catch (err: any) {
    console.error(`Error: Failed to parse 'schema.md' frontmatter: ${err.message}`);
    process.exit(1);
  }

  if (!frontmatter || typeof frontmatter !== 'object') {
    console.error(`Error: 'schema.md' frontmatter is empty or invalid.`);
    process.exit(1);
  }

  if (frontmatter.type !== 'Schema') {
    console.error(`Error: 'schema.md' frontmatter 'type' must be 'Schema'. Found: ${frontmatter.type}`);
    process.exit(1);
  }

  if (!frontmatter.title || !frontmatter.title.trim()) {
    console.warn(`Warning: 'schema.md' frontmatter is missing a 'title'.`);
  }

  if (!frontmatter.description || !frontmatter.description.trim()) {
    console.warn(`Warning: 'schema.md' frontmatter is missing a 'description'.`);
  }

  // 3. Check schema table format and keys
  const lines = schemaContent.split('\n');
  let hasTable = false;
  let invalidKeysCount = 0;
  let tableRowsCount = 0;

  for (const line of lines) {
    const trimmed = line.trim();
    if (trimmed.startsWith('|')) {
      if (trimmed.includes('---')) continue;
      if (trimmed.toLowerCase().includes('key') && trimmed.toLowerCase().includes('type')) {
        hasTable = true;
        continue;
      }
      const parts = trimmed.split('|').map(c => c.trim()).filter((_, idx, arr) => idx > 0 && idx < arr.length - 1);
      if (parts.length >= 3) {
        tableRowsCount++;
        const key = parts[0].replace(/`/g, '').trim();
        // Check if key is a valid identifier (no spaces, starts with letter/underscore)
        const validIdentifierRegex = /^[a-zA-Z_][a-zA-Z0-9_-]*$/;
        if (!validIdentifierRegex.test(key)) {
          console.error(`Error: Invalid key name '${key}' in schema table. Key names must be alphanumeric/snake_case and start with a letter or underscore.`);
          invalidKeysCount++;
        }
      }
    }
  }

  if (!hasTable) {
    console.error(`Error: 'schema.md' must contain a properties markdown table with a 'Key' column.`);
    process.exit(1);
  }

  if (tableRowsCount === 0) {
    console.error(`Error: 'schema.md' properties table contains no fields/rows.`);
    process.exit(1);
  }

  if (invalidKeysCount > 0) {
    process.exit(1);
  }

  // 4. Check prompt placeholders
  const promptContent = fs.readFileSync(promptPath, 'utf8');
  const expectedPlaceholders = [
    '$SCHEMA',
    '$VALUE',
    '$TIMESTAMP',
    '$EXISTING_CONTENT',
    '$SUMMARY_CONTENT',
  ];

  const missingPlaceholders: string[] = [];
  for (const placeholder of expectedPlaceholders) {
    if (!promptContent.includes(placeholder)) {
      missingPlaceholders.push(placeholder);
    }
  }

  if (missingPlaceholders.length > 0) {
    console.warn(`Warning: 'prompt.md' does not use the following placeholders: ${missingPlaceholders.join(', ')}`);
    
    // Check critical ones
    if (!promptContent.includes('$SCHEMA')) {
      console.warn(`Warning: Critical placeholder '$SCHEMA' is missing from 'prompt.md'. This may prevent injecting the custom fields schema.`);
    }
    if (!promptContent.includes('$VALUE')) {
      console.warn(`Warning: Critical placeholder '$VALUE' is missing from 'prompt.md'. This may prevent identifying the entity name.`);
    }
  }

  console.log(`Plugin checks completed successfully for: ${path.basename(absolutePath)}`);
}
