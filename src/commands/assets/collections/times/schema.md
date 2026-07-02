---
type: "Schema"
title: "Times Schema"
description: "Defines chronological properties extracted into summaries."
---

# Times Schema

## Summary Extension Specification

These fields are dynamically injected into the summary frontmatter under the root schema name key.

| Key     | Type  | Requirement  | Description                                                                                                                                 |
| :------ | :---- | :----------- | :------------------------------------------------------------------------------------------------------------------------------------------ |
| `times` | Array | **Required** | List of dates and events mentioned in the text. Format as array of objects containing date (YYYY-MM-DD or YYYY-MM or YYYY) and title/event. |
