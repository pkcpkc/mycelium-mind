---
description: Generate or update a batch of OKF Person biography cards from summary entity manifests. Runs one LLM context per batch of persons. Usage: /wiki-person-batch <VaultName> <Person1> [Person2] [Person3] [Person4] [Person5] [Person6] [Person7] [Person8] [Person9] [Person10] [Person11] [Person12] [Person13] [Person14] [Person15] [Person16] [Person17] [Person18] [Person19] [Person20]
---

# Wiki Person Batch Command

## Context

Vault Name: $1
Persons to process: $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21

## Schema

!`cat ./Vaults/$1/schemas/person.md`

## Instructions

For EACH person listed above under "Persons to process" (skip any that are empty, undefined, or literally start with "$"):

1. Read all summaries in `./Vaults/$1/wiki/summaries/` that mention the person's name in their `entities.persons` frontmatter or body text.
2. If `./Vaults/$1/wiki/persons/<PersonName>.md` (using underscores for spaces in `<PersonName>`, e.g., `Andrej_Karpathy.md` for "Andrej Karpathy") already exists, read it first and merge new information into the existing biography.
3. Generate or update the Person page at `./Vaults/$1/wiki/persons/<PersonName>.md` (using underscores for spaces in the filename).
4. Follow the schema template EXACTLY.
5. Use simple Obsidian wikilinks without folder prefixes: `[[Deep Learning]]`, `[[OpenAI]]`.
6. Do NOT include folder prefixes like `[[concepts/...]]` or `[[persons/...]]`.

Set the `timestamp` field to the current date/time in ISO-8601 UTC format.

### Conflict Handling

If new data contradicts the existing biography, use an Obsidian warning callout:

> [!warning] Contradiction
> New source contradicts existing entry. [Cite both].
