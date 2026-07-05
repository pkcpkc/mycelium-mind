const summaries = getSummaries();
const events = [];

function normalizeDate(value) {
  if (!value) return '';
  const trimmed = String(value).trim();
  if (!trimmed) return '';
  const matchFull = trimmed.match(/^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})$/);
  if (matchFull) {
    return `${matchFull[1]}-${matchFull[2].padStart(2, '0')}-${matchFull[3].padStart(2, '0')}`;
  }
  const matchYearMonth = trimmed.match(/^(\d{4})[-/.](\d{1,2})$/);
  if (matchYearMonth) {
    return `${matchYearMonth[1]}-${matchYearMonth[2].padStart(2, '0')}`;
  }
  return trimmed;
}

for (const s of summaries) {
  const rawTags = s.tags || [];
  const tags = (Array.isArray(rawTags) ? rawTags : [rawTags])
    .map(t => String(t).trim().toLowerCase())
    .filter(t => t.length > 0);

  const tagCount = tags.length;

  const times = s.times;
  if (Array.isArray(times)) {
    for (const t of times) {
      if (t && typeof t === 'object' && t.date) {
        events.push({
          date: normalizeDate(t.date),
          title: String(t.title || t.event || '').trim(),
          source: s.title || s.name,
          tagCount: tagCount
        });
      } else if (typeof t === 'string') {
        const colonIdx = t.indexOf(':');
        if (colonIdx !== -1) {
          events.push({
            date: normalizeDate(t.slice(0, colonIdx).trim()),
            title: t.slice(colonIdx + 1).trim(),
            source: s.title || s.name,
            tagCount: tagCount
          });
        }
      }
    }
  }
}

if (events.length > 0) {
  events.sort((a, b) => {
    const dComp = a.date.localeCompare(b.date);
    if (dComp !== 0) return dComp;
    return a.title.localeCompare(b.title);
  });

  const grouped = {};
  for (const event of events) {
    let groupKey = event.date;
    if (/^\d{4}/.test(event.date)) {
      groupKey = event.date.slice(0, 4);
    }
    if (!grouped[groupKey]) {
      grouped[groupKey] = [];
    }
    grouped[groupKey].push(event);
  }

  const sortedKeys = Object.keys(grouped).sort();
  const concepts = getConcepts().map(c => c.title || c.name || '');
  const persons = getCollection('person').map(p => p.title || p.name || '');
  const allNames = Array.from(new Set([...concepts, ...persons]))
    .filter(name => name && name.length > 2)
    .sort((a, b) => b.length - a.length);

  function addWikiLinks(text) {
    if (!text || allNames.length === 0) return text;
    const parts = text.split(/(\[\[[^\]]+\]\])/g);
    for (let i = 0; i < parts.length; i++) {
      if (parts[i].startsWith('[[') && parts[i].endsWith(']]')) continue;
      for (const name of allNames) {
        const escaped = name.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&');
        const regex = new RegExp(`\\b${escaped}\\b`, 'gi');
        parts[i] = parts[i].replace(regex, (matched) => {
          return matched === name ? `[[${name}]]` : `[[${name}|${matched}]]`;
        });
      }
    }
    return parts.join('');
  }

  const rawEventsData = events.map(e => ({
    date: e.date,
    title: e.title,
    source: e.source,
    tagCount: e.tagCount
  }));

  let graphicBody = '# Visual Timeline\n\n[[timeline|← Back to List View]]\n\n';

  // Inject search bar and filter dropdown HTML
  graphicBody += '<div class="graph-search-container">' +
    '<div class="search-input-wrapper">' +
    '<input type="text" id="graph-search" placeholder="Search timeline events..." autocomplete="off">' +
    '<button id="search-clear" class="search-clear-btn" type="button">&times;</button>' +
    '</div>' +
    '<div class="filter-dropdown-wrapper">' +
    '<label for="timeline-tag-threshold">Min. tags:</label>' +
    '<select id="timeline-tag-threshold" class="filter-dropdown-select">' +
    '<option value="0">At least 0 tags</option>' +
    '</select>' +
    '</div>' +
    '</div>\n\n';

  // Inject the event data as JSON
  graphicBody += `<div id="timeline-data" data-events="${encodeURIComponent(JSON.stringify(rawEventsData))}"></div>\n\n`;

  // Render mermaid timeline diagram wrapped in container
  graphicBody += '<div id="timeline-graphic-container">\n\n';
  graphicBody += '```mermaid\n%%{init: {\n' +
    '  "themeVariables": {\n' +
    '    "cScale0": "#6B75CC", "cScaleLabel0": "#0f172a",\n' +
    '    "cScale1": "#6B75CC", "cScaleLabel1": "#0f172a",\n' +
    '    "cScale2": "#6B75CC", "cScaleLabel2": "#0f172a",\n' +
    '    "cScale3": "#6B75CC", "cScaleLabel3": "#0f172a",\n' +
    '    "cScale4": "#6B75CC", "cScaleLabel4": "#0f172a",\n' +
    '    "cScale5": "#6B75CC", "cScaleLabel5": "#0f172a",\n' +
    '    "cScale6": "#6B75CC", "cScaleLabel6": "#0f172a",\n' +
    '    "cScale7": "#6B75CC", "cScaleLabel7": "#0f172a",\n' +
    '    "cScale8": "#6B75CC", "cScaleLabel8": "#0f172a",\n' +
    '    "cScale9": "#6B75CC", "cScaleLabel9": "#0f172a",\n' +
    '    "cScale10": "#6B75CC", "cScaleLabel10": "#0f172a",\n' +
    '    "cScale11": "#6B75CC", "cScaleLabel11": "#0f172a"\n' +
    '  }\n' +
    '}}%%\ntimeline\n    title Timeline\n';
  for (const key of sortedKeys) {
    const yearEvents = grouped[key];
    const mermaidEvents = yearEvents.map(event => {
      const label = `${event.date} — ${event.title}`;
      const cleanLabel = label
        .replace(/:/g, ' - ')
        .replace(/"/g, "'")
        .replace(/\(/g, '#40;')
        .replace(/\)/g, '#41;')
        .replace(/\[/g, '#91;')
        .replace(/\]/g, '#93;')
        .replace(/[\r\n]+/g, ' ')
        .trim();
      return cleanLabel;
    });
    const cleanKey = key.replace(/:/g, '-');
    graphicBody += `    ${cleanKey} : ${mermaidEvents.join(' : ')}\n`;
  }
  graphicBody += '```\n\n';
  graphicBody += '</div>\n';

  let listBody = '# Timeline\n\n[[timeline-graphic|Visual Timeline ↗]]\n\n';

  for (const key of sortedKeys) {
    listBody += `## ${key}\n\n`;
    const yearEvents = grouped[key];
    for (const event of yearEvents) {
      const dateLabel = event.date !== key ? `**${event.date}**: ` : '';
      const linkedTitle = addWikiLinks(event.title);
      listBody += `- ${dateLabel}${linkedTitle} ([[${event.source}]])\n`;
    }
    listBody += '\n';
  }

  writePage('timeline', {
    title: 'Timeline',
    description: 'Chronological timeline of all events mentioned in the vault.'
  }, listBody);

  writePage('timeline-graphic', {
    title: 'Visual Timeline',
    description: 'Interactive chronological timeline diagram.',
    hide: ['navigation', 'toc']
  }, graphicBody);
}
