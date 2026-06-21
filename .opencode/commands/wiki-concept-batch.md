---
description: Generate or update a batch of OKF Concept entries. Usage: /wiki-concept-batch <VaultName> <Concept1> [Concept2] [Concept3] [Concept4] [Concept5]
---

# Wiki Concept Batch Command

## Context

Vault Name: $1
Concepts: $2, $3, $4, $5, $6

## Schema

!`cat ./Vaults/$1/schemas/concept.md`

## Instructions

For EACH concept listed above (skip any that are empty):

1. Read all summaries in `./Vaults/$1/wiki/summaries/` that mention the concept in their `entities.concepts` frontmatter or body text.
2. Synthesize a Concept page at `./Vaults/$1/wiki/concepts/<ConceptName>.md` where `<ConceptName>` uses underscores for spaces.
3. Follow the schema template EXACTLY.
4. Use simple Obsidian wikilinks without folder prefixes: `[[Deep Learning]]`, `[[Andrej Karpathy]]`.
5. Do NOT include folder prefixes like `[[concepts/...]]` or `[[persons/...]]`.

Generate ALL concept files listed. Do not skip any that have content in the summaries.

Set the `timestamp` field to the current date/time in ISO-8601 UTC format.
