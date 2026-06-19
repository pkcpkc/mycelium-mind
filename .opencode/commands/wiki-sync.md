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

!`cat .opencode/commands/wiki-sync/sync-basics.md`
