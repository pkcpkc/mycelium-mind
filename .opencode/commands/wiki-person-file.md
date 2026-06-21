---
description: Generate or update a single OKF Person biography card. Usage: /wiki-person-file <VaultName> <PersonName>
---

# Wiki Person File Command

## Context

Vault Name: $1
Person Name: $2

## Schema

!`cat ./Vaults/$1/schemas/person.md`

## Instructions

1. Read all summaries in `./Vaults/$1/wiki/summaries/` that mention "$2" in their `entities.persons` frontmatter or body text.
2. If `./Vaults/$1/wiki/persons/$2.md` already exists, read it and merge new information into the existing biography.
3. Generate or update the Person page at `./Vaults/$1/wiki/persons/$2.md`.
4. Follow the schema template EXACTLY.
5. Use simple Obsidian wikilinks without folder prefixes: `[[Deep Learning]]`, `[[OpenAI]]`.
6. Do NOT include folder prefixes like `[[concepts/...]]` or `[[persons/...]]`.

Set the `timestamp` field to the current date/time in ISO-8601 UTC format.

### Conflict Handling

If new data contradicts the existing biography, use an Obsidian warning callout:

> [!warning] Contradiction
> New source contradicts existing entry. [Cite both].
