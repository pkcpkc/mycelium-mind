---
description: Process and integrate recent git changes since the last commit into the selected vault wiki. Trigger it with "/wiki-diff <VaultName>".
---

# Wiki Diff Command

## 1. Vault Context

Vault Name: $1

## 2. Git Diff Analysis

Below is the repository's git diff showing all changes done after the last commit:

```diff
!`git diff`
```

## 3. Integration & Synthesis Rules

Your goal is to parse the git diff above, identify all changes (additions, modifications, and deletions) made since the last commit, and integrate them into the wiki of vault `$1` located at `../../Vaults/$1/wiki/`.

Follow these specific instructions:

- **Source Identification**: Look at the file paths in the git diff to locate updated knowledge, notes, or facts.
- **Incremental Synthesis**:
  - **Summaries**: For new or modified knowledge in the diff, generate or update the synthesis cards under `../../Vaults/$1/wiki/summaries/`.
  - **Concepts**: Extract key terms, technologies, or subjects added in the diff, and append the new information to the corresponding concept pages under `../../Vaults/$1/wiki/concepts/`.
  - **Persons**: Extract names, roles, or affiliations added in the diff, and update/create biography pages under `../../Vaults/$1/wiki/persons/`.
- **Conflict Management**: If the changes in the git diff contradict existing information in the wiki, use the Obsidian contradiction callout:
  ```markdown
  > [!warning] Contradiction
  > Recent git changes contradict the existing entry. [Cite both sources].
  ```
- **Attribution**: When adding or updating claims based on the git diff, append the source filename from the repository (e.g., `([source](file:///path/to/changed_file.md))`) to the extracted claim. Do not use Obsidian double-brackets for these references.
- **Index Alignment**: If new pages are created, ensure they are linked inside the root `../../Vaults/$1/wiki/index.md`.

## 4. Execution Workflow

1. **Analysis Phase**: Read and analyze the embedded `git diff` output. List the modified files and summarize the key facts or updates introduced.
2. **Execution Phase**: Create and update the target wiki files in `../../Vaults/$1/wiki/` as required by the diff.
3. **Verification**: Verify that the newly integrated content links to relevant concepts/persons and is correctly indexed.
