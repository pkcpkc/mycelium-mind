---
description: Use this command to perform a health check on the wiki. It identifies broken links, orphaned pages, duplicate entities, and content gaps. Trigger it with "/wiki-lint <VaultName>".
---

# Wiki Linter Command

When triggered, perform a systematic audit of the `../../Vaults/$1/wiki` directory. Do not modify files unless explicitly asked; first, provide a **Status Report**.
If directory does not exist, don't do anything.

## 1. Structural Audit

- **Orphan Check**: Find files in `../../Vaults/$1/wiki/concepts`, `../../Vaults/$1/wiki/summaries`, or `../../Vaults/$1/wiki/persons` that have no incoming [[Wikilinks]] from other pages.
- **Broken Links**: Identify [[Wikilinks]] that point to files that do not exist.
- **Index Sync**: Ensure every file in `../../Vaults/$1/wiki` is listed in the root `index.md`.
- **Timeline Sync**: Ensure dates mentioned across wiki files are correctly cataloged and chronologically ordered in `../../Vaults/$1/wiki/timeline.md`.

## 2. Content Quality Audit

- **Stub Detection**: List pages with fewer than 3 sentences (excluding headers).
- **Duplicate Detection**: Flag potential duplicate entities (e.g., "AI" vs. "Artificial Intelligence" or "LLM" vs. "Large Language Model").
- **Missing Definitions**: Scan summaries for capitalized terms or names that are not yet turned into pages in `../../Vaults/$1/wiki/concepts` or `../../Vaults/$1/wiki/persons`.

## 3. Consistency Check

- **Contradiction Search**: Look for "Conflict" callouts or pages with conflicting metadata.

## Execution Workflow

1. **Thought Phase**: Use `<thought>` to plan the scan. Decide whether to use `ls`, `grep`, or `cat` based on vault size.
2. **Report Phase**: Present a categorized list of "Issues Found."
3. **Proposal**: Ask: "Would you like me to auto-fix the broken links or merge the identified duplicates?"

## Optimization

- Leverage the large context window to compare multiple files for thematic duplication.
- Use reasoning to suggest _where_ an orphan page should be linked based on its content.
