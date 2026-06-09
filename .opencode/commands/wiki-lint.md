---
description: Use this command to perform a health check on the wiki. It identifies broken links, orphaned pages, duplicate entities, and content gaps. Trigger it with "/wiki-lint <VaultName>".
---

# Wiki Linter Command

When triggered, perform a systematic audit of the wiki $1. Do not modify files unless explicitly asked; first, provide a **Status Report**.
If the directory does not exist, don't do anything.

This command MUST follow the core directory layout, wikilink formatting, and source attribution rules defined in the `wiki-core` skill.

## 1. Structural Audit

- **Orphan Check**: Find files in the `./Vaults/$1/wiki/concepts/`, `./Vaults/$1/wiki/summaries/`, or `./Vaults/$1/wiki/persons/` directories that have no incoming [[Wikilinks]] from other pages.
- **Broken Links**: Identify [[Wikilinks]] that point to files that do not exist.
- **Wikilinks Format**: Check that all [[Wikilinks]] targeting files follow the `wiki-core` wikilink format rule. Flag any links containing folder prefixes as errors.
- **Source Attribution Formatting**: Check that all source attributions follow the `wiki-core` source format rule. Flag any occurrences containing double quotes `"` or angle brackets `<` and `>` as errors.
- **Index Sync**: Ensure every file in the vault is listed in the root `index.md`.
- **Timeline Sync**: Ensure dates mentioned across wiki files are correctly cataloged and chronologically ordered in the root `timeline.md`.

## 2. Content Quality Audit

- **Stub Detection**: List pages with fewer than 3 sentences (excluding headers).
- **Duplicate Detection**: Flag potential duplicate entities (e.g., "AI" vs. "Artificial Intelligence" or "LLM" vs. "Large Language Model").
- **Missing Definitions**: Scan summaries for capitalized terms or names that are not yet turned into pages in the `concepts/` or `persons/` directories.

## 3. Consistency Check

- **Contradiction Search**: Look for "Conflict" callouts or pages with conflicting metadata.

## Execution Workflow

1. **Thought Phase**: Use `<thought>` to plan the scan.
2. **Report Phase**: Present a categorized list of "Issues Found."
3. **Proposal**: Ask: "Would you like me to auto-fix the broken links or merge the identified duplicates?"

## Optimization

- Leverage the large context window to compare multiple files for thematic duplication.
- Use reasoning to suggest _where_ an orphan page should be linked based on its content.
