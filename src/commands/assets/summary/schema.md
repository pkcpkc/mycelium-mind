---
type: "Schema"
title: "Baseline Summary Schema"
description: "Defines the core system metadata fields extracted into summaries."
---

# Baseline Summary Schema

## Summary Extension Specification

| Key      | Type   | Requirement  | Description                          |
| :------- | :----- | :----------- | :----------------------------------- |
| `type`   | String | **Required** | Must be exactly `"Summary"`.         |
| `title`  | String | **Required** | Sanitized title for the source note. |
| `tags`   | Array  | **Required** | Standard categorization tags.        |
| `assets` | Array  | **Required** | File paths to companion raw assets.  |
