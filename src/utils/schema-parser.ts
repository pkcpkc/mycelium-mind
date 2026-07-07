import YAML from 'yaml';

export interface SchemaField {
  key: string;
  type: string;
  requirement: string;
  description: string;
}

export interface ParsedSchema {
  meta: {
    type?: string;
    title?: string;
    description?: string;
    [key: string]: any;
  } | undefined;
  cleanSchemaYaml: string;
  fields: SchemaField[];
}

/**
 * Parses a YAML schema content, stripping $meta block and extracting fields metadata.
 */
export function parseSchema(content: string): ParsedSchema {
  const doc = YAML.parseDocument(content);
  if (!doc || !doc.contents) {
    throw new Error('Invalid YAML content');
  }

  // 1. Extract metadata
  const json = doc.toJSON() || {};
  const meta = json.$meta;

  // 2. Remove $meta from AST to get a clean YAML document string for prompt injection
  const cleanDoc = doc.clone();
  if (cleanDoc.contents && YAML.isMap(cleanDoc.contents)) {
    const metaIndex = cleanDoc.contents.items.findIndex(item => item.key && (item.key as any).value === '$meta');
    if (metaIndex !== -1) {
      cleanDoc.contents.items.splice(metaIndex, 1);
    }
  }
  const cleanSchemaYaml = cleanDoc.toString().trim();

  // 3. Recursively extract fields to support validation checks
  const fields: SchemaField[] = [];

  function extractFields(node: any, parentKey = '') {
    if (!node) return;

    if (YAML.isMap(node)) {
      node.items.forEach((pair: any) => {
        if (!pair.key) return;
        const key = pair.key.value;
        if (key === '$meta') return;

        const fullKey = parentKey ? `${parentKey}.${key}` : key;
        const commentStr = pair.value?.comment || pair.value?.commentBefore || '';

        let type = 'Unknown';
        let requirement = 'Optional';
        let description = '';

        if (commentStr) {
          const parts = commentStr.split('|').map((p: string) => p.trim());
          if (parts.length >= 1 && parts[0]) type = parts[0];
          if (parts.length >= 2 && parts[1]) requirement = parts[1];
          if (parts.length >= 3 && parts[2]) description = parts.slice(2).join(' | ');
        }

        fields.push({
          key: fullKey,
          type,
          requirement,
          description
        });

        // Recurse
        if (pair.value) {
          if (YAML.isMap(pair.value)) {
            extractFields(pair.value, fullKey);
          } else if (YAML.isSeq(pair.value)) {
            pair.value.items.forEach((item: any) => {
              if (YAML.isMap(item)) {
                extractFields(item, `${fullKey}[]`);
              }
            });
          }
        }
      });
    }
  }

  extractFields(doc.contents);

  return {
    meta,
    cleanSchemaYaml,
    fields
  };
}

/**
 * Loads a schema YAML file, strips $meta block, auto-injects default keys (timestamp, tags) if missing,
 * and returns the processed YAML string.
 */
export function loadAndInjectSchemaProperties(rawSchemaContent: string, schemaName?: string): string {
  try {
    const doc = YAML.parseDocument(rawSchemaContent);
    if (doc && doc.contents && YAML.isMap(doc.contents)) {
      // Remove $meta
      const metaIndex = doc.contents.items.findIndex(item => item.key && (item.key as any).value === '$meta');
      if (metaIndex !== -1) {
        doc.contents.items.splice(metaIndex, 1);
      }
      // Auto-inject missing system keys
      const keys = doc.contents.items.map(item => item.key && (item.key as any).value);
      if (!keys.includes('timestamp')) {
        const node = doc.createNode('$TIMESTAMP');
        node.comment = ' String | Required | ISO-8601 date of synthesis. Auto-set by the system.';
        doc.set('timestamp', node);
      }
      if (!keys.includes('tags')) {
        const node = doc.createNode(['string'], { flow: true });
        node.comment = ' Array | Optional | Categorization tags.';
        doc.set('tags', node);
      }
      return doc.toString().trim();
    }
  } catch (err: any) {
    const nameInfo = schemaName ? ` for ${schemaName}` : '';
    console.error(`Failed to process schema properties${nameInfo}:`, err.message);
  }
  return rawSchemaContent;
}
