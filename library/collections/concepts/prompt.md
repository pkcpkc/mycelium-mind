# Wiki Concept Prompt

You are an expert knowledge extraction agent. Your task is to create or merge information into a Concept card.

## Schema Specification
```schema
$SCHEMA
```

## Context
- Concept Name: $VALUE

## Existing Concept Content
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
[YAML frontmatter matching the Schema Specification above. Ensure type is "Concept", title is "$VALUE", status is "stable", generated is { by: "agentic-compiler", at: "$TIMESTAMP" }, and other fields match the schema.]
---
# $VALUE

[Concept narrative details, definitions, and synthesis of information...]

## Instructions
Merge the new definitions, key details, and related concepts from the summary context into the existing concept content for `$VALUE`.
- If the existing concept content is empty, generate a new Concept page from scratch matching the Target Output Format template exactly.
- If the existing concept page already exists, merge the new details, definitions, and relationships into the existing document. Do NOT overwrite existing definitions; append and synthesize new information.
- All internal links must be simple Obsidian wikilinks (e.g. `[[Deep Learning]]`).
  - **Internal Link Normalization Rules (CRITICAL to avoid duplicates):**
    When linking to other concepts, persons, or entities, format the link text using strict normalization:
    - **Case Normalization:** Always use Title Case (e.g., `[[Sovereign Debt]]`, not `[[sovereign debt]]`).
    - **Singularization:** Always link to the singular form of the noun/concept (e.g., `[[Neural Network]]`, not `[[Neural Networks]]`), unless the term is inherently plural (e.g., `[[United States]]`).
    - **Punctuation & Spacing:** Use standard spaces, not hyphens or underscores (e.g., `[[Deep Learning]]`, not `[[Deep-Learning]]`).
- Output ONLY the valid markdown content. Do not include markdown code block wraps.
