---
description: Process and integrate recent git changes since the last commit into the selected vault wiki. Trigger it with "/wiki-diff <VaultName>".
---

# Wiki Diff Command

## Vault Context

Vault Name: $1

## Git Diff Analysis

Below is the repository's git diff showing all changes done after the last commit inside the specific vault `Vaults/$1/`:

```diff
!`git diff -- Vaults/$1/`
```

## Integration & Synthesis Rules

Your goal is to parse the git diff above, identify all changes (additions, modifications, and deletions) made since the last commit, and integrate them into the wiki vault.

This command MUST follow the core directory layout, wikilink formatting, and source attribution rules defined in the `wiki-core` skill.

## Execution Workflow

1. **Analysis Phase**: Read and analyze the embedded `git diff` output. List the modified files and summarize the key facts or updates introduced.
2. **Execution Phase**: Create and update the target wiki files in `./Vaults/$1/wiki/` as required by the diff.
3. **Verification**: Verify that the newly integrated content links to relevant concepts/persons and is correctly indexed.

Follow these specific instructions:

- **Source Identification**: Look at the file paths in the git diff to locate updated knowledge, notes, or facts.

!`cat .opencode/commands/wiki-sync/sync-basics.md`
