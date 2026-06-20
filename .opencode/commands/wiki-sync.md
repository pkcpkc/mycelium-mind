---
description: Process inbox files into the selected vault wiki; maps binaries to assets; archives sources to .processed.
---

# Wiki Sync Command

## Current Vault Context

Vault Name: $1
Target File (Optional): $2

## Execution Rules

This command MUST follow the Wiki Core rules defined in `AGENTS.md` (directory layout, wikilink formatting, source attribution, and sync basics).

## Content Processing (Text Files)

If a specific file path is provided in `Target File (Optional): $2`, you MUST process ONLY that single file:
- Read its content from the file. Check both the absolute/relative path `$2` and `./Vaults/$1/inbox/$2` to find the correct file.
- Update the summaries, concepts, and biography pages accordingly.
- DO NOT process any other files in the inbox.

Otherwise, if `Target File (Optional): $2` is empty, scan `./Vaults/$1/inbox` for all `.md` and `.txt` files:

- **Summaries:** Generate/update files in the summaries in `./Vaults/$1/wiki/summaries`.
- **Concepts:** Append new data to files in the concepts in `./Vaults/$1/wiki/concepts`.
- **Conflict Logic:** If new data contradicts the wiki, use an Obsidian warning callout:
  > [!warning] Contradiction
  > New source contradicts existing entry. [Cite both].
- **Attribution:** Append the source reference to every extracted claim following the `AGENTS.md` source attribution rule.

- DONT WRITE TO ANY OTHER FOLDERS OTHER THAN `summaries` and `concepts`!
