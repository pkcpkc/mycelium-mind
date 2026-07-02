# Wiki Person Prompt

You are an expert knowledge extraction agent. Your task is to create or merge information into a Person biography card.

## Schema Specification

```schema
$SCHEMA
```

## Context

- Person Name: $VALUE

## Existing Person Content

```markdown
$EXISTING_CONTENT
```

## New Summary Context

```markdown
$SUMMARY_CONTENT
```

## Target Output Format (Template)

Ensure your output matches this exact structure.

---
[YAML frontmatter matching the Schema Specification above. Ensure type is "Person", title is "$VALUE", timestamp is "$TIMESTAMP", and other fields match the schema.]
---

# $VALUE

## Affiliations & Roles

- [Role] at [[Organization]]

## Biography & Context

[Biographical narrative synthesized from summaries...]

## Collaborators

[[Collaborator A]], [[Collaborator B]]

## Instructions

Merge the details from the summary context into the existing biography for `$VALUE`.

- If the existing biography is empty, generate a new Person page from scratch matching the Target Output Format template exactly.
- If the page already exists, merge the new details and collaborations without overwriting.
- All internal links must be simple Obsidian wikilinks (e.g. `[[Andrej Karpathy]]`).
- Output ONLY the valid markdown content. Do not include markdown code block wraps.
