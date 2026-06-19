---
description: Contains the core database directory paths, simple wikilink formatting rules, and source attribution guidelines for all LLM-Wiki vault operations.
---

# Wiki Core Configuration and Rules

This skill defines the common directory paths, wikilink format, and source attribution rules for any `LLM-Wiki` vault operations. Follow these rules in all commands.

## 1. Vault Directory Layout

All wiki vaults are stored under `./Vaults/<VaultName>/wiki/` and follow this path structure:

- **Root Directory:** `./Vaults/<VaultName>/wiki/`
- **Main Index:** `index.md` (root index page)
- **Timeline:** `timeline.md` (root timeline page)
- **Social Graph:** `social-graph.md` (root social graph page)
- **Concepts Directory:** `concepts/` (e.g. `./Vaults/<VaultName>/wiki/concepts/<ConceptName>.md`)
- **Persons Directory:** `persons/` (e.g. `./Vaults/<VaultName>/wiki/persons/<PersonName>.md`)
- **Summaries Directory:** `summaries/` (e.g. `./Vaults/<VaultName>/wiki/summaries/<SummaryName>.md`)
- **Reports Directory:** `reports/` (e.g. `./Vaults/<VaultName>/wiki/reports/<ReportName>.md`)
- **Assets Directory:** `assets/` (e.g. `./Vaults/<VaultName>/wiki/assets/YYYY-MM-DD/`)

## 2. Wikilinks Format Rule

- **Simple Wikilinks Only:** All internal page-to-page links MUST be simple Obsidian wikilinks without any folder prefixes.
- **Correct Format:** `[[Anthropic]]`, `[[Andrej Karpathy]]`, `[[Deep Learning]]`.
- **Incorrect Format:** `[[concepts/Anthropic]]`, `[[persons/Andrej Karpathy]]`. Do NOT include folder/directory prefixes like `concepts/` or `persons/` inside wikilinks.

## 3. Source Attribution Rule

- **Standard Markdown Format:** All source references/attributions MUST be standard Markdown links.
- **No Quotes or Angle Brackets:** The link URL must NOT contain double quotes (`"`) or angle brackets (`<`, `>`).
- **Correct Format:** `([Filename](assets/YYYY-MM-DD/filename.md))`.
- **Incorrect Formats:**
  - `([Filename](<"assets/YYYY-MM-DD/filename.md>"))` (contains quotes and brackets)
  - `([Filename](<assets/YYYY-MM-DD/filename.md>))` (contains brackets)
  - `[[assets/YYYY-MM-DD/filename.md|Filename]]` (do not use Obsidian wikilinks for source attributions)
