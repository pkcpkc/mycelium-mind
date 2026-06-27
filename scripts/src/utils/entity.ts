import { argv } from 'process';
import * as path from 'path';
import { getVaultWikiDir } from './utils.js';
import { generateEntityCard, toSafeFilename } from './utils.js';
import { config, projectRootDir } from './config.js';

export interface EntityScriptOptions {
  type: 'person' | 'concept';
  argIndex: number;
  nameArgIndex: number;
  pathArgIndex: number;
  displayName: string;
}

/**
 * Generic entity card generator CLI runner.
 * Used by persons.ts and concepts.ts to avoid duplication.
 */
export function runEntityScript(opts: EntityScriptOptions): void {
  const vaultName = argv[opts.argIndex] || config.vaultName;
  const entityName = argv[opts.nameArgIndex];
  const referenceSummaryPath = argv[opts.pathArgIndex];

  if (!vaultName || !entityName || !referenceSummaryPath) {
    console.error(
      `Usage: npx tsx scripts/src/entity/${opts.type}s.ts <VaultNameOrPath> <${opts.displayName}> <ReferenceSummaryPath>`
    );
    process.exit(1);
  }

  const wikiDir = getVaultWikiDir(vaultName);

  const promise = (async () => {
    try {
      await generateEntityCard({
        entityName,
        entityType: opts.type,
        vaultName,
        referenceSummaryPath,
        wikiDir,
        projectRootDir,
      });
    } catch (e: any) {
      console.error(`Failed to build ${opts.type} card:`, e.message);
      process.exit(1);
    }
  })();
  (globalThis as any).__entityScriptPromise = promise;
}
