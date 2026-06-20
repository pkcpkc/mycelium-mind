---
description: Use this command to perform a health check on the wiki. It identifies broken links, orphaned pages, duplicate topics, and content gaps. Trigger it with "/wiki-lint <VaultName>".
---

# Wiki Linter Command

When triggered, perform a systematic audit of the wiki $1. Do not modify files unless explicitly asked; first, provide a **Status Report**.
If the directory does not exist, don't do anything.

This command MUST follow the Wiki Core rules defined in `AGENTS.md` (directory layout, wikilink formatting, and source attribution).

## Structural Audit

- **Orphan Check**: Find files in `./Vaults/$1/wiki` that have no incoming [[Wikilinks]] from other pages.
- **Broken Links**: Identify [[Wikilinks]] that point to files that do not exist.
- **Wikilinks Format**: Check that all [[Wikilinks]] targeting files follow the `AGENTS.md` wikilink format rule.

## Content Quality Audit

- **Stub Detection**: List pages with fewer than 3 sentences (excluding headers).
- **Duplicate Detection**: Flag potential duplicate topics (e.g., "AI" vs. "Artificial Intelligence" or "LLM" vs. "Large Language Model").
- **Missing Definitions**: Scan summaries for capitalized terms or names that are not yet turned into pages in the `topics/` directories.

## Consistency Check

- **Contradiction Search**: Look for "Conflict" callouts or pages with conflicting metadata.

!`cat .opencode/commands/wiki-sync/wiki-rules.md`
