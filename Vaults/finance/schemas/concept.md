---
type: "Schema"
title: "Concept Schema"
description: "Defines the required metadata fields and structural format for Topic/Concept knowledge entries."
---

# Concept Schema

Concepts represent abstract ideas, technologies, methodologies, organizations,
frameworks, courses, or any non-person entity referenced across the knowledge bundle.

## Frontmatter Specification

| Key           | Type   | Requirement  | Description                                            |
| :------------ | :----- | :----------- | :----------------------------------------------------- |
| `type`        | String | **Required** | Must be exactly `"Concept"`.                           |
| `title`       | String | **Required** | Human-readable display name of the concept.            |
| `description` | String | Recommended  | A single sentence defining or summarizing the concept. |
| `tags`        | Array  | Optional     | Category tags.                                         |
| `timestamp`   | String | **Required** | ISO-8601 UTC datetime of last modification.            |

## Markdown Body Structure

- **`# [Concept Name]`** — L1 main title.
- **`## Summary`** — Brief definition and context.
- **`## Key Details`** — Structured details, features, or characteristics.
- **`## Related Concepts`** — Wikilinks to related concept pages.

## Template

    ---
    type: "Concept"
    title: "${title}"
    description: "${description}"
    tags: ${tags}
    timestamp: "${timestamp}"
    ---
    # ${title}

    ## Summary

    [Brief definition and context...]

    ## Key Details

    - [Detail 1]
    - [Detail 2]

    ## Related Concepts

    [[Related Concept A]], [[Related Concept B]]
