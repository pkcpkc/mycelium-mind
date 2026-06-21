---
description: Create or update the chronological timeline of all events mentioned in the wiki. Usage: /wiki-timeline <VaultName>
---

# Wiki Timeline Command

## Current Vault Context

Vault Name: $1

## Execution Instructions

When this command is triggered, compile a master chronological timeline in `./Vaults/$1/wiki/timeline.md` of all events mentioned in the wiki vault:

### Data Collection

- **Scan Sources:**
  - Read all files in `./Vaults/$1/wiki/summaries/`.
- **Extraction:** Extract every date, year, or specific time period mentioned in these files, along with the event description and the source attribution.

### Timeline Compilation

- **Sorting:** Arrange all extracted events chronologically by date/year.
- **Formatting:** Write the sorted timeline to the timeline.md file at the wiki root using clean Markdown headers for each year/date (e.g. `## 2015`), followed by bulleted event lists:

  ```markdown
  ## [Year/Date]

  - [Event Description] ([[Source Summary Name]])
  ```

### Verification

- Verify that timeline.md is successfully created or updated.
- Verify that a link to the timeline page exists in the main index.md under `## Timeline`.

## Wikilinks Format Rule

- All internal links MUST be simple Obsidian wikilinks without folder prefixes.
- **Correct:** `[[Andrej Karpathy]]`, `[[Deep Learning]]`
- **Incorrect:** `[[summaries/Andrej Karpathy]]`
