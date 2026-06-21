---
description: Summarize changes made to the wiki during the pipeline run. Usage: /wiki-diff <VaultName>
---

# Wiki Diff Command

## Current Vault Context

Vault Name: $1

## Execution Instructions

When this command is triggered, compile and present a comprehensive summary of all modifications, additions, and deletions made to the wiki vault (`Vaults/$1/wiki/`) during the pipeline execution.

Follow these steps exactly:

### 1. Data Collection

- **Git Status check:** Run `git status --porcelain -- Vaults/$1/wiki` to identify all added, modified, or deleted files.
- **Git Diff check:** Run `git diff -- Vaults/$1/wiki` to retrieve the exact line-by-line differences for modified files.

### 2. Analysis and Categorization

Analyze the collected git status and git diff information and categorize the files:
- **Summaries**: Added/modified files in `Vaults/$1/wiki/summaries/`.
- **Concepts**: Added/modified files in `Vaults/$1/wiki/concepts/`.
- **Persons**: Added/modified files in `Vaults/$1/wiki/persons/`.
- **Other**: Changes to timeline (`timeline.md`), indices (`index.md` files), social graph (`social-graph.md`), or other files.

### 3. Generate and Output the Summary

Print a beautifully formatted, user-facing markdown summary of the changes:
- Begin with a clear message indicating that the wiki orchestration pipeline is completed.
- Provide a summary table or list of statistics (e.g., total files added, modified, deleted).
- For each category (**Summaries**, **Concepts**, **Persons**, **Other**), list the names of the files that changed and a brief high-level explanation of the change (e.g., "Added a new concept page for [[Deep Learning]] describing neural networks", "Updated the summary page of [[Attention Paper]] with new metadata").
- If no files changed, output a clear message: "No changes were made to the wiki vault during this execution."

## Wikilinks Format Rule

- All internal links in the summary MUST be simple Obsidian wikilinks without folder prefixes.
- **Correct:** `[[Andrej Karpathy]]`, `[[Deep Learning]]`
- **Incorrect:** `[[concepts/Deep Learning]]`
