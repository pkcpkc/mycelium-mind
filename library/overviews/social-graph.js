const relationships = [];
const allPersons = new Set();

// Extract relationships defined as attributes on Person entities
const persons = typeof getCollection === 'function' ? getCollection('persons') : [];
for (const p of persons) {
  const personName = (p.title || p.name || '').trim();
  if (!personName) continue;

  const rels = p.relationships;
  if (Array.isArray(rels)) {
    for (const rel of rels) {
      if (rel && typeof rel === 'object') {
        const target = String(rel.person || rel.personB || rel.target || rel.name || '').trim();
        const relation = String(rel.relation || rel.connection || rel.role || 'connected to').trim();
        if (target) {
          relationships.push({
            personA: personName,
            relation: relation,
            personB: target,
            source: personName
          });
        }
      }
    }
  }
}

const relationCountMap = new Map();
for (const rel of relationships) {
  relationCountMap.set(rel.personA, (relationCountMap.get(rel.personA) || 0) + 1);
  relationCountMap.set(rel.personB, (relationCountMap.get(rel.personB) || 0) + 1);
}

for (const [person, count] of relationCountMap.entries()) {
  if (count > 0) {
    allPersons.add(person);
  }
}

const personList = Array.from(allPersons).sort();
const nameToIdMap = new Map();
const usedIds = new Set();

function getInitials(name) {
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

// 1. Generate the Graphic Page (social-graph-graphic.md)
let graphicBody = '# Visual Social Graph\n\n[[social-graph|← Back to Registry View]]\n\n';

if (allPersons.size > 0) {
  graphicBody += '```mermaid\nflowchart LR\n';
  for (const name of personList) {
    const nodeId = nameToIdMap.get(name);
    const safeName = name.replace(/"/g, "'");
    graphicBody += `    ${nodeId}["${safeName}"]\n`;
  }

  const printedEdges = new Set();
  for (const rel of relationships) {
    const idA = nameToIdMap.get(rel.personA);
    const idB = nameToIdMap.get(rel.personB);
    if (idA && idB) {
      const edgeKey = `${idA}-${rel.relation}-${idB}`;
      if (!printedEdges.has(edgeKey)) {
        const safeRelation = rel.relation.replace(/"/g, "'");
        graphicBody += `    ${idA} -- "${safeRelation}" --> ${idB}\n`;
        printedEdges.add(edgeKey);
      }
    }
  }
  graphicBody += '```\n\n';
} else {
  graphicBody += 'No relationships found.\n\n';
}

// 2. Generate the Registry List Page (social-graph.md)
let listBody = '# Social Graph\n\n[[social-graph-graphic|Visual Social Graph ↗]]\n\n';
listBody += '## Relationship Registry\n\n';
if (relationships.length > 0) {
  listBody += '| Person A | Connection | Person B | Context / Source |\n';
  listBody += '| :--- | :--- | :--- | :--- |\n';
  for (const rel of relationships) {
    listBody += `| [[${rel.personA}]] | ${rel.relation} | [[${rel.personB}]] | [[${rel.source}]] |\n`;
  }
} else {
  listBody += 'No explicit relationships found.';
}

writePage('social-graph', {
  title: 'Social Graph',
  description: 'Connection map and relationship registry of all individuals in the vault.'
}, listBody);

writePage('social-graph-graphic', {
  title: 'Visual Social Graph',
  description: 'Interactive social graph connection map.',
  hide: ['navigation', 'toc']
}, graphicBody);
