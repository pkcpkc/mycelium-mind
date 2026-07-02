---
type: "Schema"
title: "Concept Schema"
description: "Defines the core fields extracted into summary frontmatter for Concept entities."
---

# Concept Schema

## Summary Extension Specification

These fields are dynamically injected into the summary frontmatter under the root schema name key.

| Key        | Type  | Requirement  | Description                                            |
| :--------- | :---- | :----------- | :----------------------------------------------------- |
| `concepts` | Array | **Required** | List of technical core concepts mentioned in the text. |
