import { argv, exit } from 'process';
import * as fs from 'fs';
import * as path from 'path';
import { config } from '../utils/config.js';
import { getVaultWikiDir, getAllFrontmatters, fromSafeFilename, gitCommit } from '../utils/utils.js';

const vaultName = argv[2] || config.vaultName;
if (!vaultName) {
  console.error("Error: Vault name parameter is required. Usage: timeline.ts <VaultName|Path>");
  exit(1);
}

const wikiDir = getVaultWikiDir(vaultName);
const timelineFile = path.join(wikiDir, 'timeline.md');

const getNamesFromDir = (dirPath: string): string[] => {
  if (!fs.existsSync(dirPath)) {
    return [];
  }
  try {
    const files = fs.readdirSync(dirPath);
    return files
      .filter(f => f.endsWith('.md') && f !== 'index.md')
      .map(f => fromSafeFilename(f));
  } catch {
    return [];
  }
};

function addWikiLinks(text: string, names: string[]): string {
  if (!text || names.length === 0) {
    return text;
  }

  // Split text by wikilinks to avoid matching inside brackets
  const regex = /(\[\[[^\]]+\]\])/g;
  const parts = text.split(regex);

  for (let i = 0; i < parts.length; i++) {
    if (parts[i].startsWith('[[') && parts[i].endsWith(']]')) {
      continue;
    }

    for (const name of names) {
      const escapedName = name.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&');
      const nameRegex = new RegExp(`\\b${escapedName}\\b`, 'gi');
      parts[i] = parts[i].replace(nameRegex, (matched) => {
        if (matched === name) {
          return `[[${name}]]`;
        } else {
          return `[[${name}|${matched}]]`;
        }
      });
    }
  }

  return parts.join('');
}

console.log(`[wiki-timeline] Generating timeline for vault: ${vaultName}...`);

(async () => {
  // Use shared utility to get all summaries that have a non-empty 'times' frontmatter field
  const summaries = await getAllFrontmatters(wikiDir, 'summaries', ['times']);

  interface TimelineEvent {
    date: string;
    title: string;
    source: string;
  }

  const normalizeDate = (value: unknown): string => {
    if (value instanceof Date) {
      const y = value.getFullYear();
      const m = String(value.getMonth() + 1).padStart(2, '0');
      const d = String(value.getDate()).padStart(2, '0');
      return `${y}-${m}-${d}`;
    }
    if (value === null || value === undefined) {
      return '';
    }
    const trimmed = String(value).trim();
    if (!trimmed) {
      return '';
    }

    const matchFull = trimmed.match(/^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})$/);
    if (matchFull) {
      const [, year, month, day] = matchFull;
      return `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
    }

    const matchYearMonth = trimmed.match(/^(\d{4})[-/.](\d{1,2})$/);
    if (matchYearMonth) {
      const [, year, month] = matchYearMonth;
      return `${year}-${month.padStart(2, '0')}`;
    }

    return trimmed;
  };

  const events: TimelineEvent[] = [];

  for (const summary of summaries) {
    const times = summary.frontmatter.times;
    if (Array.isArray(times)) {
      for (const t of times) {
        if (t && typeof t === 'object' && 'date' in t) {
          events.push({
            date: normalizeDate((t as any).date),
            title: String((t as any).title || (t as any).event || '').trim(),
            source: summary.title
          });
        } else if (typeof t === 'string') {
          const colonIdx = t.indexOf(':');
          if (colonIdx !== -1) {
            events.push({
              date: normalizeDate(t.slice(0, colonIdx).trim()),
              title: t.slice(colonIdx + 1).trim(),
              source: summary.title
            });
          }
        }
      }
    }
  }

  if (events.length === 0) {
    console.log("[wiki-timeline] No events found in summary frontmatters.");
    return;
  }

  events.sort((a, b) => {
    const dateCompare = a.date.localeCompare(b.date);
    if (dateCompare !== 0) {
      return dateCompare;
    }

    return a.title.localeCompare(b.title);
  });

  const grouped: Record<string, TimelineEvent[]> = {};
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

  const conceptNames = getNamesFromDir(path.join(wikiDir, 'concepts'));
  const personNames = getNamesFromDir(path.join(wikiDir, 'persons'));
  const allNames = Array.from(new Set([...conceptNames, ...personNames]))
    .filter(name => name.length > 2)
    .sort((a, b) => b.length - a.length);

  const markdownLines = [
    `---`,
    `type: "Timeline"`,
    `title: "Timeline"`,
    `description: "Chronological timeline of all events mentioned in the vault."`,
    `timestamp: "${new Date().toISOString().replace(/\.\d{3}Z$/, 'Z')}"`,
    `---`,
    `# Timeline\n`
  ];

  for (const key of sortedKeys) {
    markdownLines.push(`## ${key}\n`);
    const yearEvents = grouped[key].sort((a, b) => {
      const dateCompare = a.date.localeCompare(b.date);
      if (dateCompare !== 0) {
        return dateCompare;
      }

      return a.title.localeCompare(b.title);
    });
    for (const event of yearEvents) {
      const dateLabel = event.date !== key ? `**${event.date}**: ` : '';
      const linkedTitle = addWikiLinks(event.title, allNames);
      markdownLines.push(`- ${dateLabel}${linkedTitle} ([[${event.source}]])`);
    }
    markdownLines.push('');
  }

  fs.writeFileSync(timelineFile, markdownLines.join('\n'), 'utf8');
  gitCommit(timelineFile, 'Updated timeline');
  console.log(`[wiki-timeline] Successfully wrote timeline to ${timelineFile}`);

  const indexFile = path.join(wikiDir, 'index.md');
  if (fs.existsSync(indexFile)) {
    let indexContent = fs.readFileSync(indexFile, 'utf8');
    if (!indexContent.includes('[[timeline|Timeline]]') && !indexContent.includes('[[timeline]]')) {
      console.log("[wiki-timeline] Adding Timeline section to index.md...");
      if (indexContent.includes('## Timeline')) {
        indexContent = indexContent.replace('## Timeline', '## Timeline\n\n- [[timeline|Timeline]] - Chronological timeline of all events mentioned in this vault.');
      } else {
        indexContent += `\n## Timeline\n\n- [[timeline|Timeline]] - Chronological timeline of all events mentioned in this vault.\n`;
      }
      fs.writeFileSync(indexFile, indexContent, 'utf8');
      gitCommit(indexFile, 'Updated index with timeline');
    }
  }
})();
