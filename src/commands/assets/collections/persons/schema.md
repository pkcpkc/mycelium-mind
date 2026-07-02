---
type: "Schema"
title: "Person Concept Schema"
description: "Defines the custom fields extracted into summary frontmatter for Person entities."
---

# Person Concept Schema

## Summary Extension Specification

These fields are dynamically injected into the summary frontmatter under the root schema name key.

| Key             | Type  | Requirement  | Description                                                                        |
| :-------------- | :---- | :----------- | :--------------------------------------------------------------------------------- |
| `persons`       | Array | **Required** | List of individuals extracted from source.                                         |
| `relationships` | Array | **Required** | List of relationships between extracted persons (e.g. personA, relation, personB). |
