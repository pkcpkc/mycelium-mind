---
description: Create or update the chronological timeline of all events mentioned in the wiki. Usage: /wiki-timeline <VaultName>
---

# Wiki Timeline Command

## Current Vault Context

Vault Name: $1

## Execution Instructions

When this command is triggered, compile a master chronological timeline of all events mentioned in the wiki vault:

### 1. Data Collection
- **Scan Sources:**
  - Read all files inside the `../../Vaults/$1/wiki/persons/` directory.
  - Read all files inside the `../../Vaults/$1/wiki/concepts/` directory.
  - Read all files inside the `../../Vaults/$1/wiki/summaries/` directory.
- **Extraction:** Extract every date, year, or specific time period mentioned in these files, along with the event description and the source attribution (e.g. `([source](<assets/YYYY-MM-DD/file.md>))`).

### 2. Timeline Compilation
- **Sorting:** Arrange all extracted events chronologically by date/year.
- **Formatting:** Write the sorted timeline to `../../Vaults/$1/wiki/timeline.md` using clean Markdown headers for each year/date (e.g. `## 2015`), followed by bulleted event lists:
  ```markdown
  ## [Year/Date]

  - [Event Description] ([source](<assets/YYYY-MM-DD/file.md>))
  ```

### 3. Verification
- Verify that `../../Vaults/$1/wiki/timeline.md` is successfully created or updated.
- Verify that a link to the timeline page exists in the main index file `../../Vaults/$1/wiki/index.md` under `## Timeline`.
