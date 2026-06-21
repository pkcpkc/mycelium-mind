---
description: Run the complete OKF wiki pipeline (sync, summaries, concepts, persons, social graph, timeline). Usage: /wiki <VaultName>
---

# Wiki Orchestration Command

## Current Vault Context

Vault: `./Vaults/$1`

## Pipeline Execution

Simply Inform the user that the vault will be updated through the full pipeline:
!`jq -r '[.commands.post[] | split(" ")[0]] | join(", ")' .opencode/commands/wiki.hooks.json`

The execution itself will happen without your action.
