---
type: "Schema"
title: "Report Concept Schema"
description: "Defines the required metadata fields and structural format for thematic synthesis reports."
---

# Report Concept Schema

Reports are thematic syntheses that draw from summaries and concepts across one
or more vaults. They compare, contrast, and identify emergent insights.

## Frontmatter Specification

| Key           | Type     | Requirement    | Description                                              |
|:--------------|:---------|:---------------|:---------------------------------------------------------|
| `type`        | String   | **Required**   | Must be exactly `"Report"`.                              |
| `title`       | String   | **Required**   | Descriptive title of the thematic report.                |
| `description` | String   | Recommended    | A single sentence summarizing the report's theme.        |
| `tags`        | Array    | Optional       | Category tags (e.g., `["synthesis", "deep-learning"]`).   |
| `timestamp`   | String   | **Required**   | ISO-8601 UTC datetime of last modification.              |
| `vaults`      | Array    | Recommended    | List of vault names this report draws from.              |

## Markdown Body Structure

- **`# [Report Title]`** — L1 main title.
- **`## Overview`** — Brief summary of the report's scope and findings.
- **`## Analysis`** — Comparative synthesis with citations to summaries and concepts.
- **`## Key Insights`** — Emergent ideas using `> [!abstract] Key Insight` callouts.
- **`## Future Research`** — Gaps identified in the current knowledge base.

## Template

    ---
    type: "Report"
    title: "${title}"
    description: "${description}"
    tags: ${tags}
    timestamp: "${timestamp}"
    vaults: ${vaults}
    ---
    # ${title}

    ## Overview

    [Scope and high-level findings...]

    ## Analysis

    [Comparative synthesis with wikilinks and citations...]

    ## Key Insights

    > [!abstract] Key Insight
    > [Emergent idea that only appears when cross-referencing sources...]

    ## Future Research

    - [Identified gap in the knowledge base]
