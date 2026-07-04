import * as fs from 'fs';
import * as path from 'path';
import { projectRootDir } from '../utils/config.js';

// Determine the built-in library path:
const compiledLibPath = path.join(projectRootDir, 'build/library');
const useCompiled = fs.existsSync(compiledLibPath);
export const defaultLibPath = useCompiled ? compiledLibPath : path.join(projectRootDir, 'library');

/**
 * Resolves the source library path based on optional custom source input.
 */
export function getSourceLibraryPath(customFrom?: string): string {
  if (customFrom) {
    const resolved = path.resolve(customFrom);
    if (!fs.existsSync(resolved) || !fs.statSync(resolved).isDirectory()) {
      console.error(`Error: Custom library path '${customFrom}' does not exist or is not a directory.`);
      process.exit(1);
    }
    return resolved;
  }
  return defaultLibPath;
}

/**
 * Programmatically copies a collection from library to wiki path.
 */
export function copyCollection(
  name: string,
  targetWikiPath: string,
  sourceLibPath: string
): void {
  const collectionsDir = path.join(sourceLibPath, 'collections');
  const sourceDir = path.join(collectionsDir, name);
  const targetDir = path.join(targetWikiPath, 'plugins', 'collections', name);

  if (!fs.existsSync(sourceDir) || !fs.statSync(sourceDir).isDirectory()) {
    throw new Error(`Collection '${name}' not found at ${sourceDir}`);
  }

  if (!fs.existsSync(targetDir)) {
    fs.mkdirSync(targetDir, { recursive: true });
  }

  const files = fs.readdirSync(sourceDir);
  for (const file of files) {
    const srcFile = path.join(sourceDir, file);
    const destFile = path.join(targetDir, file);
    fs.copyFileSync(srcFile, destFile);
  }
}

/**
 * Programmatically copies an overview script from library to wiki path.
 */
export function copyOverview(
  name: string,
  targetWikiPath: string,
  sourceLibPath: string
): void {
  const overviewsDir = path.join(sourceLibPath, 'overviews');
  const sourceFile = path.join(overviewsDir, `${name}.js`);
  const targetDir = path.join(targetWikiPath, 'plugins', 'overviews');
  const destFile = path.join(targetDir, `${name}.js`);

  if (!fs.existsSync(sourceFile)) {
    throw new Error(`Overview script '${name}.js' not found at ${sourceFile}`);
  }

  if (!fs.existsSync(targetDir)) {
    fs.mkdirSync(targetDir, { recursive: true });
  }

  fs.copyFileSync(sourceFile, destFile);
}

/**
 * CLI Command: Collection
 */
export async function manageCollection(
  wikiPath: string,
  name?: string,
  options?: { force?: boolean; from?: string }
): Promise<void> {
  const libPath = getSourceLibraryPath(options?.from);
  const collectionsDir = path.join(libPath, 'collections');

  const availableCollections = fs.existsSync(collectionsDir)
    ? fs.readdirSync(collectionsDir).filter(f => fs.statSync(path.join(collectionsDir, f)).isDirectory())
    : [];

  if (!name) {
    console.log('Available collections:');
    if (availableCollections.length === 0) {
      console.log('  (none found)');
    } else {
      for (const c of availableCollections) {
        console.log(`  - ${c}`);
      }
    }
    return;
  }

  if (!availableCollections.includes(name)) {
    console.error(`Error: Collection '${name}' not found in the library.`);
    process.exit(1);
  }

  const absoluteWikiPath = path.resolve(wikiPath);
  const targetDir = path.join(absoluteWikiPath, 'plugins', 'collections', name);

  if (fs.existsSync(targetDir) && !options?.force) {
    console.error(`Error: Collection '${name}' already exists in target wiki at:`);
    console.error(`  ${targetDir}`);
    console.error('Use --force or --overwrite to overwrite existing files.');
    process.exit(1);
  }

  try {
    copyCollection(name, absoluteWikiPath, libPath);
    console.log(`Successfully installed collection '${name}' to ${targetDir}`);
  } catch (err: any) {
    console.error(`Failed to install collection: ${err.message}`);
    process.exit(1);
  }
}

/**
 * CLI Command: Overview
 */
export async function manageOverview(
  wikiPath: string,
  name?: string,
  options?: { force?: boolean; from?: string }
): Promise<void> {
  const libPath = getSourceLibraryPath(options?.from);
  const overviewsDir = path.join(libPath, 'overviews');

  const availableOverviews = fs.existsSync(overviewsDir)
    ? fs.readdirSync(overviewsDir).filter(f => f.endsWith('.js')).map(f => f.slice(0, -3))
    : [];

  if (!name) {
    console.log('Available overviews:');
    if (availableOverviews.length === 0) {
      console.log('  (none found)');
    } else {
      for (const o of availableOverviews) {
        console.log(`  - ${o}`);
      }
    }
    return;
  }

  if (!availableOverviews.includes(name)) {
    console.error(`Error: Overview '${name}' not found in the library.`);
    process.exit(1);
  }

  const absoluteWikiPath = path.resolve(wikiPath);
  const targetDir = path.join(absoluteWikiPath, 'plugins', 'overviews');
  const destFile = path.join(targetDir, `${name}.js`);

  if (fs.existsSync(destFile) && !options?.force) {
    console.error(`Error: Overview script '${name}.js' already exists in target wiki at:`);
    console.error(`  ${destFile}`);
    console.error('Use --force or --overwrite to overwrite.');
    process.exit(1);
  }

  try {
    copyOverview(name, absoluteWikiPath, libPath);
    console.log(`Successfully installed overview '${name}' to ${targetDir}`);
  } catch (err: any) {
    console.error(`Failed to install overview: ${err.message}`);
    process.exit(1);
  }
}
