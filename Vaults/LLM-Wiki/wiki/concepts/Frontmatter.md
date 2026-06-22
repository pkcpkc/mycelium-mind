---
type: "Concept"
title: "Frontmatter"
description: "A YAML metadata block placed at the beginning of markdown files to define structured, machine-parsable data for knowledge concepts."
tags: ["knowledge-representation", "data-format", "markdown", "yaml"]
timestamp: "2026-06-22T18:22:51Z"
---
# Frontmatter

## Summary

Frontmatter refers to a structured YAML metadata block placed at the very beginning of markdown documents. In the context of the Open Knowledge Format (OKF), it serves as the foundational mechanism for defining, describing, and indexing individual [[Concept]] entries within a [[Knowledge Bundle]]. By embedding machine-parsable data directly into plain text files, frontmatter bridges human readability with automated agent consumption.

## Key Details

- **Syntax & Structure:** Formatted as a YAML block delimited by `---` at the start and end of the file.
- **Core Fields:** Includes required keys such as `type` (e.g., `"Concept"`) and `title`, alongside optional metadata like `description`, `tags`, and `timestamp`.
- **Agent Interoperability:** Enables knowledge agents to dynamically route, filter, and process documents without relying on central registries or proprietary SDKs.
- **Workflow Integration:** Aligns seamlessly with version control systems and personal knowledge management tools, allowing authors to update metadata alongside content.
- **Graceful Degradation:** Supports optional fields, allowing systems to handle incomplete or evolving metadata gracefully.

## Related Concepts

[[Open Knowledge Format]], [[Concept]], [[Knowledge Bundle]], [[Markdown]]