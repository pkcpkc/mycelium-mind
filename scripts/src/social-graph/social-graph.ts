import { argv, exit } from 'process';
import * as fs from 'fs';
import * as path from 'path';
import { config } from '../utils/config.js';
import { getVaultWikiDir, getAllFrontmatters, gitCommit } from '../utils/utils.js';

const vaultName = argv[2] || config.vaultName;
if (!vaultName) {
  console.error("Error: Vault name parameter is required. Usage: social-graph.ts <VaultName|Path>");
  exit(1);
}

const wikiDir = getVaultWikiDir(vaultName);
const socialGraphFile = path.join(wikiDir, 'social-graph.md');

console.log(`[wiki-social-graph] Generating social graph for vault: ${vaultName}...`);

interface Relationship {
  personA: string;
  relation: string;
  personB: string;
  source: string;
}

const relationships: Relationship[] = [];
const allPersons = new Set<string>();

(async () => {
  // Read summaries frontmatter to extract relationships
  const summaries = await getAllFrontmatters(wikiDir, 'summaries');
  for (const summary of summaries) {
    const frontmatter = summary.frontmatter;
    if (frontmatter) {
      if (Array.isArray(frontmatter.relationships)) {
        for (const rel of frontmatter.relationships) {
          if (rel && typeof rel === 'object' && rel.personA && rel.relation && rel.personB) {
            const pA = String(rel.personA).trim();
            const pB = String(rel.personB).trim();
            relationships.push({
              personA: pA,
              relation: String(rel.relation).trim(),
              personB: pB,
              source: summary.title
            });
          }
        }
      }
    }
  }

  // Count relationships for each person
  const relationCountMap = new Map<string, number>();
  for (const rel of relationships) {
    relationCountMap.set(rel.personA, (relationCountMap.get(rel.personA) || 0) + 1);
    relationCountMap.set(rel.personB, (relationCountMap.get(rel.personB) || 0) + 1);
  }

  // Only add a person to the social graph if their relationCount > 0
  for (const [person, count] of relationCountMap.entries()) {
    if (count > 0) {
      allPersons.add(person);
    }
  }

  const personList = Array.from(allPersons).sort();
  const nameToIdMap = new Map<string, string>();
  const usedIds = new Set<string>();

  function getInitials(name: string): string {
    const clean = name.replace(/[^a-zA-Z0-9\s_-]/g, "");
    const parts = clean.split(/[\s_-]+/);
    let initials = parts.map(w => w[0]).join("").toUpperCase();
    if (!initials) initials = "P";
    return initials;
  }

  for (const name of personList) {
    let initials = getInitials(name);
    let uniqueId = initials;
    let counter = 1;
    while (usedIds.has(uniqueId)) {
      uniqueId = `${initials}${counter}`;
      counter++;
    }
    usedIds.add(uniqueId);
    nameToIdMap.set(name, uniqueId);
  }

  const markdownLines = [
    `---`,
    `type: "SocialGraph"`,
    `title: "Social Graph"`,
    `description: "Connection map and relationship registry of all individuals in the vault."`,
    `timestamp: "${new Date().toISOString().replace(/\.\d{3}Z$/, 'Z')}"`,
    `---`,
    `# Social Graph\n`,
    `## Connection Map\n`,
  ];

  if (allPersons.size > 0) {
    markdownLines.push(`\`\`\`mermaid`);
    markdownLines.push(`flowchart LR`);

    for (const name of personList) {
      const nodeId = nameToIdMap.get(name)!;
      markdownLines.push(`    ${nodeId}["${name}"]`);
    }

    const printedEdges = new Set<string>();
    for (const rel of relationships) {
      const idA = nameToIdMap.get(rel.personA);
      const idB = nameToIdMap.get(rel.personB);
      if (idA && idB) {
        const edgeKey = `${idA}-${rel.relation}-${idB}`;
        if (!printedEdges.has(edgeKey)) {
          markdownLines.push(`    ${idA} -- "${rel.relation}" --> ${idB}`);
          printedEdges.add(edgeKey);
        }
      }
    }

    markdownLines.push(`\`\`\`\n`);
  } else {
    markdownLines.push(`No relationships found.\n`);
  }

  markdownLines.push(`## Relationship Registry\n`);
  if (relationships.length > 0) {
    markdownLines.push(`| Person A | Connection | Person B | Context / Source |`);
    markdownLines.push(`| :--- | :--- | :--- | :--- |`);
    for (const rel of relationships) {
      const linkA = `[[${rel.personA}]]`;
      const linkB = `[[${rel.personB}]]`;
      const linkSrc = `[[${rel.source}]]`;
      markdownLines.push(`| ${linkA} | ${rel.relation} | ${linkB} | ${linkSrc} |`);
    }
  } else {
    markdownLines.push(`No explicit relationships found.`);
  }

  markdownLines.push('');

  fs.writeFileSync(socialGraphFile, markdownLines.join('\n'), 'utf8');
  gitCommit(socialGraphFile, 'Updated social graph');
  console.log(`[wiki-social-graph] Successfully wrote social graph to ${socialGraphFile}`);

  const indexFile = path.join(wikiDir, 'index.md');
  if (fs.existsSync(indexFile)) {
    let indexContent = fs.readFileSync(indexFile, 'utf8');
    if (!indexContent.includes('[[social-graph|Social Graph]]') && !indexContent.includes('[[social-graph]]')) {
      console.log("[wiki-social-graph] Adding Social Graph section to index.md...");
      if (indexContent.includes('## Connection Map')) {
        indexContent = indexContent.replace('## Connection Map', '## Connection Map\n\n- [[social-graph|Social Graph]] - Connection map and relationship registry of all individuals in this vault.');
      } else {
        indexContent += `\n## Connection Map\n\n- [[social-graph|Social Graph]] - Connection map and relationship registry of all individuals in this vault.\n`;
      }
      fs.writeFileSync(indexFile, indexContent, 'utf8');
      gitCommit(indexFile, 'Updated index with social graph');
    }
  }
})();
