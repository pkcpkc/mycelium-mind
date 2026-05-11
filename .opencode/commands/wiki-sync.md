---
description: Process inbox files into the selected vault wiki; maps binaries to assets; archives sources to .processed.
---

# Wiki Sync Command

## Current Vault Context

Vault Name: $1

## Content Processing (Text Files)

Scan `Vaults/$1/inbox` for `.md` and `.txt` files:

- **Summaries:** Generate/update files in `Vaults/$1/wiki/summaries/`.
- **Concepts:** Append new data to files in `Vaults/$1/wiki/concepts/`.
- **Persons:** Append new data to files in `Vaults/$1/wiki/persons/`.
- **Conflict Logic:** If new data contradicts the wiki, use an Obsidian warning callout:
  > [!warning] Contradiction
  > New source [source: $1/wiki/assets/!`date "+%Y-%m-%d"`/file.md] contradicts existing entry. [Cite both].
- **Attribution:** Append `Vaults/$1/wiki/assets/!`date "+%Y-%m-%d"`/file.md` to every extracted claim.

## Finalization

- **Timeline:** Create or update `Vaults/$1/wiki/timeline.md` with all the dates mentioned in the wiki, ordered chronologically, and include wikilinks to the `.md` files where each date is mentioned.
- **Index:** Update `Vaults/$1/wiki/index.md` with new [[Wikilinks]].

## Local Model Optimization (Qwen 3.6 MLX)

- **Context Window:** Utilize the 35B's capacity to cross-reference multiple files in `Vaults/$1/inbox/` simultaneously for better entity extraction.
