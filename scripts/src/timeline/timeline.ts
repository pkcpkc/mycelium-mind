import { argv, exit } from 'process';
import * as fs from 'fs';
import * as path from 'path';
import { config } from '../utils/config.js';
import { getVaultWikiDir, getAllFrontmatters } from '../utils/utils.js';

const vaultName = argv[2] || config.vaultName;
if (!vaultName) {
  console.error("Error: Vault name parameter is required. Usage: timeline.ts <VaultName|Path>");
  exit(1);
}

const wikiDir = getVaultWikiDir(vaultName);
const timelineFile = path.join(wikiDir, 'timeline.md');

console.log(`[wiki-timeline] Generating timeline for vault: ${vaultName}...`);

(async () => {
  // Use shared utility to get all summaries that have a non-empty 'times' frontmatter field
  const summaries = await getAllFrontmatters(wikiDir, 'summaries', ['times']);

  interface TimelineEvent {
    date: string;
    title: string;
    source: string;
  }

  const events: TimelineEvent[] = [];

  for (const summary of summaries) {
    const times = summary.frontmatter.times;
    if (Array.isArray(times)) {
      for (const t of times) {
        if (t && typeof t === 'object' && t.date) {
          events.push({
            date: String(t.date).trim(),
            title: String(t.title || t.event || '').trim(),
            source: summary.title
          });
        } else if (typeof t === 'string') {
          const colonIdx = t.indexOf(':');
          if (colonIdx !== -1) {
            events.push({
              date: t.slice(0, colonIdx).trim(),
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
    exit(0);
  }

  events.sort((a, b) => a.date.localeCompare(b.date));

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
    const yearEvents = grouped[key].sort((a, b) => a.date.localeCompare(b.date));
    for (const event of yearEvents) {
      const dateLabel = event.date !== key ? `**${event.date}**: ` : '';
      markdownLines.push(`- ${dateLabel}${event.title} ([[${event.source}]])`);
    }
    markdownLines.push('');
  }

  fs.writeFileSync(timelineFile, markdownLines.join('\n'), 'utf8');
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
    }
  }
})();
