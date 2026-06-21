---
description: Process a single inbox file into an OKF Summary Concept. Usage: /wiki-summary-file <VaultName> <FileName>
---

# Wiki Summary File Command

## Context

Vault Name: $1
Target File: $2

## Schema

!`cat ./Vaults/$1/schemas/summary.md`

## Instructions

Read the file at `./Vaults/$1/inbox/$2` and generate a single OKF Summary Concept file at `./Vaults/$1/wiki/summaries/<SafeFilename>.md`.

The `<SafeFilename>` should be derived from the document's title or original filename, with spaces replaced by underscores and special characters removed.

Follow the schema template EXACTLY. The frontmatter MUST include:
- `type: "Summary"`
- `title` — The document's title or a descriptive title derived from the content.
- `description` — A single sentence summarizing the document.
- `tags` — Relevant category tags.
- `entities.concepts` — ALL concepts, technologies, organizations, frameworks, courses, and methodologies mentioned.
- `entities.persons` — ALL individuals mentioned by name.

Do NOT set `resource` or `timestamp` — these are injected by the post-hook.

### Wikilinks Format Rule

- All internal page-to-page links MUST be simple Obsidian wikilinks without folder prefixes.
- **Correct:** `[[Deep Learning]]`, `[[Andrej Karpathy]]`
- **Incorrect:** `[[concepts/Deep Learning]]`, `[[persons/Andrej Karpathy]]`

### Source Attribution

Do NOT add a source attribution line — the post-hook handles this automatically.
