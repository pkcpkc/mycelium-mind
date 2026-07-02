const summaries = getSummaries();
const relationships = [];
const allPersons = new Set();

for (const s of summaries) {
  const rels = s.relationships;
  if (Array.isArray(rels)) {
    for (const rel of rels) {
      if (rel && typeof rel === 'object' && rel.personA && rel.relation && rel.personB) {
        relationships.push({
          personA: String(rel.personA).trim(),
          relation: String(rel.relation).trim(),
          personB: String(rel.personB).trim(),
          source: s.title || s.name
        });
      } else if (typeof rel === 'string') {
        const parts = rel.split(',').map(p => p.trim());
        if (parts.length >= 3) {
          relationships.push({
            personA: parts[0],
            relation: parts[1],
            personB: parts[2],
            source: s.title || s.name
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

let body = '# Social Graph\n\n## Connection Map\n\n';

if (allPersons.size > 0) {
  body += '```mermaid\nflowchart LR\n';
  for (const name of personList) {
    const nodeId = nameToIdMap.get(name);
    body += `    ${nodeId}["${name}"]\n`;
  }

  const printedEdges = new Set();
  for (const rel of relationships) {
    const idA = nameToIdMap.get(rel.personA);
    const idB = nameToIdMap.get(rel.personB);
    if (idA && idB) {
      const edgeKey = `${idA}-${rel.relation}-${idB}`;
      if (!printedEdges.has(edgeKey)) {
        body += `    ${idA} -- "${rel.relation}" --> ${idB}\n`;
        printedEdges.add(edgeKey);
      }
    }
  }
  body += '```\n\n';
} else {
  body += 'No relationships found.\n\n';
}

body += '## Relationship Registry\n\n';
if (relationships.length > 0) {
  body += '| Person A | Connection | Person B | Context / Source |\n';
  body += '| :--- | :--- | :--- | :--- |\n';
  for (const rel of relationships) {
    body += `| [[${rel.personA}]] | ${rel.relation} | [[${rel.personB}]] | [[${rel.source}]] |\n`;
  }
} else {
  body += 'No explicit relationships found.';
}

writePage('social-graph', {
  title: 'Social Graph',
  description: 'Connection map and relationship registry of all individuals in the vault.'
}, body);
