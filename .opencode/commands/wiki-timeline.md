---
description: Create or update the chronological timeline of all events mentioned in the wiki. Usage: /wiki-timeline <VaultName>
---

# Wiki Timeline Command

## Current Vault Context

Vault Name: $1

## Execution Rules

This command MUST follow the Wiki Core rules defined in `AGENTS.md` (directory layout, wikilink formatting, and source attribution).

## Execution Instructions

When this command is triggered, compile a master chronological timeline in `./Vaults/$1/wiki/timeline.md` of all events mentioned in the wiki vault:

### 1. Data Collection

- **Scan Sources:**
  - Read all files inside the persons/ directory.
  - Read all files inside the concepts/ directory.
  - Read all files inside the summaries/ directory.
- **Extraction:** Extract every date, year, or specific time period mentioned in these files, along with the event description and the source attribution. Format the source attribution following the `AGENTS.md` source attribution rule.

### 2. Timeline Compilation

- **Sorting:** Arrange all extracted events chronologically by date/year.
- **Formatting:** Write the sorted timeline to the timeline.md file at the wiki root using clean Markdown headers for each year/date (e.g. `## 2015`), followed by bulleted event lists:

  ```markdown
  ## [Year/Date]

  - [Event Description] ([file.md](assets/YYYY-MM-DD/file.md))
  ```

### 3. Verification

- Verify that timeline.md is successfully created or updated.
- Verify that a link to the timeline page exists in the main index.md under `## Timeline`.
