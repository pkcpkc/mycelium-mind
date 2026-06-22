---
type: "Schema"
title: "Summary Concept Schema"
description: "Defines the required metadata fields and structural format for Summary document cards."
---

# Summary Concept Schema

Summaries are dense, high-fidelity synthesis cards produced from a single raw source
document (PDF, transcript, article). They are the foundational layer of the knowledge
bundle — all downstream concepts (topics, persons) are derived from summaries.

## Frontmatter Specification

| Key           | Type     | Requirement    | Description                                              |
|:--------------|:---------|:---------------|:---------------------------------------------------------|
| `type`        | String   | **Required**   | Must be exactly `"Summary"`.                             |
| `title`       | String   | **Required**   | Title of the source document or a descriptive title.     |
| `description` | String   | Recommended    | A single sentence summarizing the document's content.    |
| `resource`    | String   | **Required**   | Relative path to the archived source asset.              |
| `tags`        | Array    | Optional       | Category tags (e.g., `["paper", "deep-learning"]`).      |
| `timestamp`   | String   | **Required**   | ISO-8601 UTC datetime of last modification.              |
| `entities`    | Object   | **Required**   | Entity manifest extracted from the document.             |
| `entities.concepts` | Array | **Required** | List of concept names mentioned in the document.         |
| `entities.persons`  | Array | **Required** | List of person names mentioned in the document.          |
| `times`       | Array    | Optional       | Mentioned dates and events (e.g. `[{date: "2026-05-03", title: "Tesla AI Day"}]`). |
| `relationships`| Array   | Optional       | Interpersonal relations (e.g. `[{personA: "A", relation: "teaches", personB: "B"}]`). |

## Markdown Body Structure

- **`# [Document Title]`** — L1 main title.
- **Free-form synthesis** — Comprehensive summary of the document's content, key arguments, findings, and contributions.
- **Source attribution** — Final line linking to the archived asset.

## Template

    ---
    type: "Summary"
    title: "${title}"
    description: "${description}"
    resource: "${resource}"
    tags: ${tags}
    timestamp: "${timestamp}"
    entities:
      concepts: ${concepts_list}
      persons: ${persons_list}
    times:
      - date: "YYYY-MM-DD"
        title: "Event description"
    relationships:
      - personA: "Person A"
        relation: "relationship"
        personB: "Person B"
    ---
    # ${title}

    [Comprehensive synthesis of the source document...]

    (source: [${filename}](${resource}))
