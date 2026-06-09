---
description: Process and integrate recent git changes since the last commit into the selected vault wiki. Trigger it with "/wiki-diff <VaultName>".
---

# Wiki Diff Command

## 1. Vault Context

Vault Name: $1

## 2. Git Diff Analysis

Below is the repository's git diff showing all changes done after the last commit inside the specific vault `Vaults/$1/`:

```diff
!`git diff -- Vaults/$1/`
```

## 3. Integration & Synthesis Rules

Your goal is to parse the git diff above, identify all changes (additions, modifications, and deletions) made since the last commit, and integrate them into the wiki vault.

This command MUST follow the core directory layout, wikilink formatting, and source attribution rules defined in the `wiki-core` skill.

Follow these specific instructions:

- **Source Identification**: Look at the file paths in the git diff to locate updated knowledge, notes, or facts.
- **Incremental Synthesis**:
  - **Summaries**: For new or modified knowledge in the diff, generate or update the synthesis cards under the summaries directory.
  - **Concepts**: Extract key terms, technologies, or subjects added in the diff, and append the new information to the corresponding concept pages under the concepts directory.
  - **Persons**: Extract names, roles, or affiliations added in the diff, and update/create biography pages under the persons directory.
- **Conflict Management**: If the changes in the git diff contradict existing information in the wiki, use the Obsidian contradiction callout:
  ```markdown
  > [!warning] Contradiction
  > Recent git changes contradict the existing entry. [Cite both sources].
  ```
- **Attribution**: When adding or updating claims based on the git diff, append the source filename from the repository to the extracted claim following the `wiki-core` source format rule.
- **Index Alignment**: If new pages are created, ensure they are linked inside the root index.md following the `wiki-core` wikilink format rule.

## 4. Execution Workflow

1. **Analysis Phase**: Read and analyze the embedded `git diff` output. List the modified files and summarize the key facts or updates introduced.
2. **Execution Phase**: Create and update the target wiki files in `./Vaults/$1/wiki/` as required by the diff.
3. **Verification**: Verify that the newly integrated content links to relevant concepts/persons and is correctly indexed.
