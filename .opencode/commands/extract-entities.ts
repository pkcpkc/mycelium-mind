import { argv, exit } from 'process';
import * as fs from 'fs';
import * as path from 'path';
import YAML from 'yaml';

function extractEntities(summariesDir: string, entityType: 'concepts' | 'persons'): string[] {
  const entities = new Set<string>();

  if (!fs.existsSync(summariesDir) || !fs.statSync(summariesDir).isDirectory()) {
    return [];
  }

  const files = fs.readdirSync(summariesDir).filter(f => f.endsWith('.md'));
  for (const file of files) {
    const filePath = path.join(summariesDir, file);
    try {
      const content = fs.readFileSync(filePath, 'utf8');
      if (!content.startsWith('---')) continue;
      const parts = content.split('---');
      if (parts.length < 3) continue;

      const frontmatter = YAML.parse(parts[1]);
      if (frontmatter && typeof frontmatter === 'object') {
        const entityBlock = frontmatter.entities;
        if (entityBlock && typeof entityBlock === 'object') {
          const items = entityBlock[entityType];
          if (Array.isArray(items)) {
            for (const item of items) {
              if (typeof item === 'string' && item.trim()) {
                entities.add(item.trim());
              }
            }
          }
        }
      }
    } catch (e) {
      // Ignore reading/parsing errors for individual files
    }
  }

  return Array.from(entities).sort();
}

const summariesDir = argv[2];
const entityType = argv[3];

if (!summariesDir || !entityType) {
  console.error(`Usage: node --experimental-strip-types extract-entities.ts <summaries_dir> <entity_type>`);
  exit(1);
}

if (entityType !== 'concepts' && entityType !== 'persons') {
  console.error(`Error: entity_type must be "concepts" or "persons", got "${entityType}"`);
  exit(1);
}

const result = extractEntities(summariesDir, entityType);
for (const entity of result) {
  console.log(entity);
}
