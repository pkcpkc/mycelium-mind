import { argv, exit } from 'process';
import * as fs from 'fs';
import * as path from 'path';
import { config } from '../utils/config.js';
import { getVaultWikiDir, getAllFrontmatters, toSafeFilename } from '../utils/utils.js';

const vaultName = argv[2] || config.vaultName;
if (!vaultName) {
  console.error("Error: Vault name parameter is required. Usage: concepts-cloud.ts <VaultName|Path>");
  exit(1);
}

const wikiDir = getVaultWikiDir(vaultName);
const conceptsCloudFile = path.join(wikiDir, 'concepts-cloud.md');

console.log(`[wiki-concepts-cloud] Generating concepts cloud for vault: ${vaultName}...`);

interface ConceptNode {
  name: string;
  tags: string[];
  filename: string;
}

interface Edge {
  source: string;
  target: string;
  sharedTags: string[];
}

(async () => {
  // Read concepts frontmatter
  const conceptsFrontmatters = await getAllFrontmatters(wikiDir, 'concepts');
  
  const concepts: ConceptNode[] = [];
  const nameToIdMap = new Map<string, string>();
  
  let conceptIndex = 1;
  for (const item of conceptsFrontmatters) {
    const frontmatter = item.frontmatter;
    if (frontmatter) {
      const rawTags = frontmatter.tags || [];
      const tags = (Array.isArray(rawTags) ? rawTags : [rawTags])
        .map(t => String(t).trim().toLowerCase())
        .filter(t => t.length > 0);
      
      // Hide concepts with less tags than required (at least 2 tags)
      if (tags.length < 2) continue;

      const basename = path.basename(item.filePath);
      concepts.push({
        name: item.title,
        tags,
        filename: basename
      });
      
      nameToIdMap.set(item.title, `c${conceptIndex++}`);
    }
  }

  // Find edges based on shared tags
  const edges: Edge[] = [];
  const seenEdges = new Set<string>();

  for (let i = 0; i < concepts.length; i++) {
    for (let j = i + 1; j < concepts.length; j++) {
      const conceptA = concepts[i];
      const conceptB = concepts[j];
      
      // Calculate intersection of tags
      const shared = conceptA.tags.filter(t => conceptB.tags.includes(t));
      if (shared.length > 1) {
        const idA = nameToIdMap.get(conceptA.name)!;
        const idB = nameToIdMap.get(conceptB.name)!;
        
        // Ensure consistent order to avoid duplicate edges
        const edgeKey = [idA, idB].sort().join('-');
        if (!seenEdges.has(edgeKey)) {
          edges.push({
            source: idA,
            target: idB,
            sharedTags: shared.sort()
          });
          seenEdges.add(edgeKey);
        }
      }
    }
  }

  // Filter out concepts without links
  const connectedConceptIds = new Set<string>();
  for (const edge of edges) {
    connectedConceptIds.add(edge.source);
    connectedConceptIds.add(edge.target);
  }
  const connectedConcepts = concepts.filter(c => connectedConceptIds.has(nameToIdMap.get(c.name)!));

  // Construct Markdown
  const markdownLines = [
    `---`,
    `type: "ConceptsCloud"`,
    `title: "Concepts Cloud"`,
    `description: "Interactive graph linking concepts sharing common tags."`,
    `timestamp: "${new Date().toISOString().replace(/\.\d{3}Z$/, 'Z')}"`,
    `---`,
    `# Concepts Cloud\n`,
    `Interactive visualization of wiki concepts and their relationships based on shared tags. Click on a node to navigate to the concept page.\n`,
    `## Interactive Graph\n`,
  ];

  // Embed Cytoscape container and link to fullscreen
  if (connectedConcepts.length > 0) {
    markdownLines.push(`[[concepts-cloud-fullscreen|Open Fullscreen Interactive Graph ↗]]\n`);
    markdownLines.push(`<div class="graph-search-container"><div class="search-input-wrapper"><input type="text" id="graph-search" placeholder="Search concepts by name or tag..." autocomplete="off"><button id="search-clear" class="search-clear-btn" type="button">&times;</button></div></div>\n`);
    markdownLines.push(`<div id="cy"></div>\n`);
  } else {
    markdownLines.push(`No connected concepts found.\n`);
  }

  // Add Shared Tags Registry
  markdownLines.push(`## Shared Tags Registry\n`);
  if (edges.length > 0) {
    markdownLines.push(`| Concept A | Shared Tags | Concept B |`);
    markdownLines.push(`| :--- | :--- | :--- |`);
    for (const edge of edges) {
      const conceptAName = concepts.find(c => nameToIdMap.get(c.name) === edge.source)!.name;
      const conceptBName = concepts.find(c => nameToIdMap.get(c.name) === edge.target)!.name;
      const linkA = `[[${conceptAName}]]`;
      const linkB = `[[${conceptBName}]]`;
      markdownLines.push(`| ${linkA} | ${edge.sharedTags.join(', ')} | ${linkB} |`);
    }
  } else {
    markdownLines.push(`No concept overlaps found.`);
  }

  markdownLines.push('');

  fs.writeFileSync(conceptsCloudFile, markdownLines.join('\n'), 'utf8');
  console.log(`[wiki-concepts-cloud] Successfully wrote concepts cloud to ${conceptsCloudFile}`);

  // Write fullscreen page
  const conceptsCloudFullscreenFile = path.join(wikiDir, 'concepts-cloud-fullscreen.md');
  const fullscreenMarkdownLines = [
    `---`,
    `type: "ConceptsCloudFullscreen"`,
    `title: "Concepts Cloud (Fullscreen)"`,
    `description: "Fullscreen interactive graph of concepts linked by shared tags."`,
    `timestamp: "${new Date().toISOString().replace(/\.\d{3}Z$/, 'Z')}"`,
    `hide:`,
    `  - navigation`,
    `  - toc`,
    `---`,
    `# Concepts Cloud (Fullscreen)\n`,
    `[[concepts-cloud|← Back to Concepts Cloud]]\n`,
    `<div class="graph-search-container"><div class="search-input-wrapper"><input type="text" id="graph-search" placeholder="Search concepts by name or tag..." autocomplete="off"><button id="search-clear" class="search-clear-btn" type="button">&times;</button></div></div>\n`,
    `<div id="cy-fullscreen"></div>\n`
  ];
  fs.writeFileSync(conceptsCloudFullscreenFile, fullscreenMarkdownLines.join('\n'), 'utf8');
  console.log(`[wiki-concepts-cloud] Successfully wrote concepts cloud fullscreen page to ${conceptsCloudFullscreenFile}`);

  // Add to index.md
  const indexFile = path.join(wikiDir, 'index.md');
  if (fs.existsSync(indexFile)) {
    let indexContent = fs.readFileSync(indexFile, 'utf8');
    if (!indexContent.includes('[[concepts-cloud|Concepts Cloud]]') && !indexContent.includes('[[concepts-cloud]]')) {
      console.log("[wiki-concepts-cloud] Adding Concepts Cloud section to index.md...");
      if (indexContent.includes('## Connection Map')) {
        indexContent = indexContent.replace('## Connection Map', '## Connection Map\n\n- [[concepts-cloud|Concepts Cloud]] - Interactive graph of concepts linked by shared tags.');
      } else {
        indexContent += `\n## Connection Map\n\n- [[concepts-cloud|Concepts Cloud]] - Interactive graph of concepts linked by shared tags.\n`;
      }
      fs.writeFileSync(indexFile, indexContent, 'utf8');
    }
  }
})();
