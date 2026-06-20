---
description: Process a single inbox file into the selected vault wiki; updates summaries, topics, and biographies.
---

# Wiki Sync File Command

## Current Vault Context

Vault Name: $1
Target File: $2

## Content Processing (Single Text File)

You MUST process ONLY the single file specified in `./Vaults/$1/inbox/$2`:

- Read its content from the file.
- Update the summaries and topics.
- **Summaries:** Generate/update files in the summaries in `./Vaults/$1/wiki/summaries`.
- **Topics:** Perform an extraction of ALL topics and generate/update files in `./Vaults/$1/wiki/topics`.
- **Conflict Logic:** If new data contradicts the wiki, use an Obsidian warning callout:

  > [!warning] Contradiction
  > New source contradicts existing entry. [Cite both].

!`cat .opencode/commands/wiki-sync/wiki-rules.md`
