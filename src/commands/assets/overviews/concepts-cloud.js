const concepts = getConcepts();
const list = [];
const nameToIdMap = new Map();
const MIN_SHARED_TAGS = 1;

let conceptIndex = 1;
for (const item of concepts) {
  const rawTags = item.tags || [];
  const tags = (Array.isArray(rawTags) ? rawTags : [rawTags])
    .map(t => String(t).trim().toLowerCase())
    .filter(t => t.length > 0);

  if (tags.length < 2) continue;

  list.push({
    name: item.title || item.name,
    tags,
    filename: item.title || item.name
  });
  nameToIdMap.set(item.title || item.name, `c${conceptIndex++}`);
}

const edges = [];
const seenEdges = new Set();

for (let i = 0; i < list.length; i++) {
  for (let j = i + 1; j < list.length; j++) {
    const conceptA = list[i];
    const conceptB = list[j];
    const shared = conceptA.tags.filter(t => conceptB.tags.includes(t));
    if (shared.length > MIN_SHARED_TAGS) {
      const idA = nameToIdMap.get(conceptA.name);
      const idB = nameToIdMap.get(conceptB.name);
      const edgeKey = [idA, idB].sort().join("-");
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

const connectedIds = new Set();
for (const edge of edges) {
  connectedIds.add(edge.source);
  connectedIds.add(edge.target);
}
const connectedConcepts = list.filter(c => connectedIds.has(nameToIdMap.get(c.name)));

let body = '# Concepts Relation Cloud\n\nInteractive visualization of wiki concepts and their relationships based on shared tags. Click on a node to navigate to the concept page.\n\n';
if (connectedConcepts.length > 0) {
  body += '<div class="graph-search-container"><div class="search-input-wrapper"><input type="text" id="graph-search" placeholder="Search concepts by name or tag..." autocomplete="off"><button id="search-clear" class="search-clear-btn" type="button">&times;</button></div></div>\n\n';
  body += '<div id="cy-fullscreen"></div>\n\n';
  body += `<p class="graph-hint">💡 Note: Only showing concepts with more than ${MIN_SHARED_TAGS} shared tags.</p>\n\n`;
} else {
  body += 'No connected concepts found.\n\n';
}

body += '## Shared Tags Registry\n\n';
if (edges.length > 0) {
  body += '| Concept A | Shared Tags | Concept B |\n';
  body += '| :--- | :--- | :--- |\n';
  for (const edge of edges) {
    const cA = list.find(c => nameToIdMap.get(c.name) === edge.source).name;
    const cB = list.find(c => nameToIdMap.get(c.name) === edge.target).name;
    body += `| [[${cA}]] | ${edge.sharedTags.join(', ')} | [[${cB}]] |\n`;
  }
} else {
  body += 'No concept overlaps found.';
}

writePage('concepts-cloud', {
  title: 'Concepts Relation Cloud',
  description: 'Interactive graph linking concepts sharing common tags.',
  hide: ['navigation', 'toc']
}, body);
