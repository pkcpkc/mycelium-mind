# Wiki Times Prompt

You are an expert knowledge extraction agent. Your task is to create or merge information into a Times event card.

## Schema Specification
```schema
$SCHEMA
```

## Context
- Event Name: $VALUE

## Existing Times Content
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
[YAML frontmatter matching the Schema Specification above. Ensure type is "Times", title is "$VALUE", timestamp is "$TIMESTAMP", and other fields match the schema.]
---
# $VALUE

## Event Details

[Chronological event narrative synthesized from summaries...]

## Instructions
Merge the details from the summary context into the existing times page for `$VALUE`.
- If the existing times page is empty, generate a new Times page from scratch matching the Target Output Format template exactly.
- If the page already exists, merge the new details and dates without overwriting.
- All internal links must be simple Obsidian wikilinks (e.g. `[[Andrej Karpathy]]`).
  - **Internal Link Normalization Rules (CRITICAL to avoid duplicates):**
    When linking to other concepts, persons, or entities, format the link text using strict normalization:
    - **Case Normalization:** Always use Title Case (e.g., `[[Sovereign Debt]]`, not `[[sovereign debt]]`).
    - **Singularization:** Always link to the singular form of the noun/concept (e.g., `[[Neural Network]]`, not `[[Neural Networks]]`), unless the term is inherently plural (e.g., `[[United States]]`).
    - **Punctuation & Spacing:** Use standard spaces, not hyphens or underscores (e.g., `[[Deep Learning]]`, not `[[Deep-Learning]]`).
- Output ONLY the valid markdown content. Do not include markdown code block wraps.
