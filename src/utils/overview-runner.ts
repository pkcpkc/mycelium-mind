import * as fs from 'fs';
import * as path from 'path';
import vm from 'node:vm';
import YAML from 'yaml';
import { readFrontmatter } from './fs-utils.js';
import { gitCommit } from './git.js';

export interface EntityMetadata {
  name: string;
  type: string;
  timestamp: string;
  tags: string[];
  properties: Record<string, any>;
  filePath: string;
}

// Recursively find files
function walkSync(dir: string, ext: string): string[] {
  let results: string[] = [];
  if (!fs.existsSync(dir)) return results;
  const list = fs.readdirSync(dir);
  for (const file of list) {
    const filePath = path.join(dir, file);
    const stat = fs.statSync(filePath);
    if (stat && stat.isDirectory()) {
      results = results.concat(walkSync(filePath, ext));
    } else if (file.endsWith(ext)) {
      results.push(filePath);
    }
  }
  return results;
}

/**
 * Builds the session graph in memory from summaries and collections.
 */
export async function buildSessionGraph(wikiPath: string): Promise<EntityMetadata[]> {
  const graph: EntityMetadata[] = [];
  
  // Find markdown files in summaries/ and collections/
  const summariesDir = path.join(wikiPath, 'summaries');
  const collectionsDir = path.join(wikiPath, 'collections');

  const summaryFiles = walkSync(summariesDir, '.md');
  const collectionFiles = walkSync(collectionsDir, '.md');
  const allFiles = [...summaryFiles, ...collectionFiles];

  for (const file of allFiles) {
    const metadata = await readFrontmatter(file);
    const basenameNoExt = path.basename(file, '.md');
    
    // Normalize tags
    let tags: string[] = [];
    if (metadata.tags) {
      tags = Array.isArray(metadata.tags)
        ? metadata.tags.map((t: any) => String(t).trim())
        : [String(metadata.tags).trim()];
    }

    const entity: EntityMetadata = {
      name: metadata.title || metadata.name || basenameNoExt,
      type: metadata.type || '',
      timestamp: metadata.timestamp || '',
      tags,
      properties: metadata,
      filePath: path.relative(wikiPath, file).replace(/\\/g, '/')
    };
    graph.push(entity);
  }

  return graph;
}

/**
 * Expose helper to evaluate filters.
 */
function applyFilter(entities: EntityMetadata[], filter?: Record<string, any>): EntityMetadata[] {
  if (!filter || Object.keys(filter).length === 0) {
    return entities;
  }
  return entities.filter(entity => {
    for (const key of Object.keys(filter)) {
      const targetVal = filter[key];
      // Check in top-level entity properties first, then under properties
      const actualVal = (entity as any)[key] !== undefined ? (entity as any)[key] : entity.properties[key];
      
      if (Array.isArray(actualVal)) {
        if (Array.isArray(targetVal)) {
          if (!targetVal.every(v => actualVal.includes(v))) return false;
        } else {
          if (!actualVal.includes(targetVal)) return false;
        }
      } else {
        if (actualVal !== targetVal) return false;
      }
    }
    return true;
  });
}

/**
 * Executes a JavaScript overview script inside a VM sandbox.
 */
export async function runOverviewScript(
  scriptPath: string,
  wikiPath: string,
  sessionGraph: EntityMetadata[]
): Promise<void> {
  const scriptContent = fs.readFileSync(scriptPath, 'utf8');
  const basename = path.basename(scriptPath);

  let timeoutVal = 5000;
  const configDir = path.join(path.dirname(wikiPath), 'config');
  const configPath = path.join(configDir, 'config.yml');
  if (fs.existsSync(configPath)) {
    try {
      const parsed = YAML.parse(fs.readFileSync(configPath, 'utf8'));
      if (
        parsed &&
        parsed.overviews &&
        typeof parsed.overviews.script_timeout_ms === 'number' &&
        parsed.overviews.script_timeout_ms > 0
      ) {
        timeoutVal = parsed.overviews.script_timeout_ms;
      }
    } catch (e: any) {
      console.warn(`Failed to parse config.yml at ${configPath}:`, e.message);
    }
  }

  const context = {
    // API Implementation
    getCollection: (key: string, filter?: any) => {
      const normalizedKey = key.toLowerCase();
      const singular = normalizedKey.replace(/s$/, '');
      const plural = singular + 's';
      const list = sessionGraph.filter(entity => {
        return entity.filePath.startsWith(`collections/${singular}/`) || 
               entity.filePath.startsWith(`collections/${plural}/`) || 
               entity.type.toLowerCase() === singular || 
               entity.type.toLowerCase() === plural;
      });
      return applyFilter(list, filter).map(e => ({ name: e.name, type: e.type, tags: e.tags, ...e.properties }));
    },
    getSummaries: (filter?: any) => {
      const list = sessionGraph.filter(entity => {
        return entity.filePath.startsWith('summaries/') || entity.type.toLowerCase() === 'summary';
      });
      return applyFilter(list, filter).map(e => ({ name: e.name, type: e.type, tags: e.tags, ...e.properties }));
    },
    getConcepts: (filter?: any) => {
      return context.getCollection('concepts', filter);
    },
    getPagesByTag: (tag: string, filter?: any) => {
      const searchTag = tag.toLowerCase();
      const list = sessionGraph.filter(entity => {
        return entity.tags.some(t => t.toLowerCase() === searchTag);
      });
      return applyFilter(list, filter).map(e => ({ name: e.name, type: e.type, tags: e.tags, ...e.properties }));
    },
    writePage: (pageName: string, frontmatter: Record<string, any>, markdownBody: string) => {
      try {
        const cleanName = pageName.endsWith('.md') ? pageName : `${pageName}.md`;
        const overviewsDir = path.join(wikiPath, 'overviews');
        if (!fs.existsSync(overviewsDir)) {
          fs.mkdirSync(overviewsDir, { recursive: true });
        }
        const targetPath = path.join(overviewsDir, cleanName);

        // Auto-inject base metadata properties
        const finalFrontmatter = {
          type: 'Overview',
          ...frontmatter,
          timestamp: new Date().toISOString().replace(/\.\d{3}Z$/, 'Z'),
        };

        const content = `---\n${YAML.stringify(finalFrontmatter)}---\n${markdownBody}`;
        fs.writeFileSync(targetPath, content, 'utf8');
        gitCommit(targetPath, `Generated overview: ${pageName}`);
        return true;
      } catch (e: any) {
        console.error(`Failed to write overview page ${pageName}:`, e.message);
        return false;
      }
    },
    console,
  };

  // Expose both as global functions and on a 'wiki' namespace object for absolute safety
  const sandbox = {
    ...context,
    wiki: context,
  };

  vm.createContext(sandbox);
  try {
    vm.runInContext(scriptContent, sandbox, { filename: basename, timeout: timeoutVal });
  } catch (e: any) {
    console.error(`Error executing overview script '${basename}':`, e.stack || e.message);
    throw e;
  }
}
