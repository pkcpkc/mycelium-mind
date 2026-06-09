---
description: Process inbox files into the selected vault wiki; maps binaries to assets; archives sources to .processed.
---

# Wiki Sync Command

## Current Vault Context

Vault Name: $1

## Execution Rules

This command MUST follow the core directory layout, wikilink formatting, and source attribution rules defined in the `wiki-core` skill.

## Content Processing (Text Files)

Scan `./Vaults/$1/inbox` for `.md` and `.txt` files:

- **Summaries:** Generate/update files in the summaries in `./Vaults/$1/wiki/summaries`.
- **Concepts:** Append new data to files in the concepts in `./Vaults/$1/wiki/concepts`.
- **Persons:** Append new data to files in the persons in `./Vaults/$1/wiki/persons`.
- **Conflict Logic:** If new data contradicts the wiki, use an Obsidian warning callout:
  > [!warning] Contradiction
  > New source contradicts existing entry. [Cite both].
- **Attribution:** Append the source reference to every extracted claim following the `wiki-core` source format rule.

## Finalization

- **Index:** Update the main index file (`index.md`) with new [[Wikilinks]] following the `wiki-core` wikilink format rule.
