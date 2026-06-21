---
type: "Schema"
title: "Person Concept Schema"
description: "Defines the required metadata fields and structural format for Person biography cards."
---

# Person Concept Schema

Person concepts are biography cards for individuals referenced across the knowledge
bundle. Each person resides exclusively in the `persons/` directory — never in
`concepts/`.

## Frontmatter Specification

| Key           | Type     | Requirement    | Description                                              |
|:--------------|:---------|:---------------|:---------------------------------------------------------|
| `type`        | String   | **Required**   | Must be exactly `"Person"`.                              |
| `title`       | String   | **Required**   | Full name of the person.                                 |
| `description` | String   | Recommended    | A single sentence summarizing the person's primary role. |
| `tags`        | Array    | Optional       | Category tags (e.g., `["researcher", "educator"]`).      |
| `timestamp`   | String   | **Required**   | ISO-8601 UTC datetime of last modification.              |

## Markdown Body Structure

- **`# [Person Name]`** — L1 main title.
- **`## Affiliations & Roles`** — Bulleted list of current and past affiliations.
- **`## Biography & Context`** — Synthesized narrative prose.
- **`## Collaborators`** — Wikilinks to other persons in the vault.

## Template

    ---
    type: "Person"
    title: "${title}"
    description: "${description}"
    tags: ${tags}
    timestamp: "${timestamp}"
    ---
    # ${title}

    ## Affiliations & Roles

    - [Role] at [[Organization]]

    ## Biography & Context

    [Biographical narrative synthesized from summaries...]

    ## Collaborators

    [[Collaborator A]], [[Collaborator B]]
