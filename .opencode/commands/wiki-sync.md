---
description: Process inbox files into the selected vault wiki; maps binaries to assets; archives sources to .processed.
---

# Wiki Sync Command

## Current Vault Context

Vault Name: $1

## Content Processing (Text Files)

Scan `../../Vaults/$1/inbox` for `.md` and `.txt` files:

- **Summaries:** Generate/update files in `../../Vaults/$1/wiki/summaries/`.
- **Concepts:** Append new data to files in `../../Vaults/$1/wiki/concepts/`.
- **Persons:** Append new data to files in `../../Vaults/$1/wiki/persons/`.
- **Conflict Logic:** If new data contradicts the wiki, use an Obsidian warning callout:
  > [!warning] Contradiction
  > New source contradicts existing entry. [Cite both].
- **Attribution:** Append `([source](<"assets/!`date "+%Y-%m-%d"`/file.md>"))` to every extracted claim. Use a normal Markdown link for source files, not an Obsidian wikilink. Do not emit source references as `[[...]]`, `[source: ...]`, or `[[1|...]]`; those create broken wiki links or reversed aliases.

## Finalization

- **Index:** Update `../../Vaults/$1/wiki/index.md` with new [[Wikilinks]].
