## Wiki Configuration and Rules

This section defines the common directory paths, wikilink format, and source attribution rules for any `LLM-Wiki` vault operations. Follow these rules in all wiki commands.

### Vault Directory Layout

All wiki vaults are stored under `./Vaults/<VaultName>/wiki/` and follow this path structure:

- **Root Directory:** `./Vaults/<VaultName>/wiki/`
- **Main Index:** `./Vaults/<VaultName>/wiki/index.md` (root index page)
- **Entites Directory:** `./Vaults/<VaultName>/wiki/topics/<TopicName>.md`
- **Summaries Directory:** `./Vaults/<VaultName>/wiki/summaries/<SummaryName>.md`
- **Reports Directory:** `./Vaults/<VaultName>/wiki/reports/<ReportName>.md`
- **Assets Directory:** `./Vaults/<VaultName>/wiki/assets/YYYY-MM-DD/`

### Wikilinks Format Rule

- **Simple Wikilinks Only:** All internal page-to-page links MUST be simple Obsidian wikilinks without any folder prefixes.
- **Correct Format:** `[[Anthropic]]`, `[[Andrej Karpathy]]`, `[[Deep Learning]]`.
- **Incorrect Format:** `[[topics/Anthropic]]`, `[[persons/Andrej Karpathy]]`. Do NOT include folder/directory prefixes like `topics/` or `persons/` inside wikilinks.

### Source Attribution Rule

- **Standard Markdown Format:** All source references/attributions MUST be standard Markdown links.
- **No Quotes or Angle Brackets:** The link URL must NOT contain double quotes (`"`) or angle brackets (`<`, `>`).
- **Correct Format:** `([source: <filename.md>](assets/YYYY-MM-DD/filename.md))`.
- **Incorrect Formats:**
  - `([Filename](<"assets/YYYY-MM-DD/filename.md">"))` (contains quotes and brackets)
  - `([Filename](<assets/YYYY-MM-DD/filename.md>))` (contains brackets)
  - `[[assets/YYYY-MM-DD/filename.md|Filename]]` (do not use Obsidian wikilinks for source attributions)

### Sync Basics

When syncing content from inbox files into the wiki:

- **Conflict Logic:** If new data contradicts the wiki, use an Obsidian warning callout:
  > [!warning] Contradiction
  > New source contradicts existing entry. [Cite both].
- **Attribution:** Append the source reference to every extracted claim following the source attribution rule above.
