---
description: Process inbox files into the selected vault wiki; maps binaries to assets; archives sources to .processed.
---

# Wiki Sync Command

## Current Vault Context

Vault Name: $1
Target File (Optional): $2

## Execution Rules

This command MUST follow the core directory layout, wikilink formatting, and source attribution rules defined in the `wiki-core` skill.

## Content Processing (Text Files)

If a specific file path is provided in `Target File (Optional): $2`, you MUST process ONLY that single file:
- Read its content from the file. Check both the absolute/relative path `$2` and `./Vaults/$1/inbox/$2` to find the correct file.
- Update the summaries, concepts, and biography pages accordingly.
- DO NOT process any other files in the inbox.

Otherwise, if `Target File (Optional): $2` is empty, scan `./Vaults/$1/inbox` for all `.md` and `.txt` files:

!`cat .opencode/commands/wiki-sync/sync-basics.md`
