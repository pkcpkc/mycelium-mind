---
type: "Concept"
title: "Obsidian"
description: "A markdown-based knowledge management application used to build and maintain persistent, interlinked personal wikis, often integrated with LLM workflows for automated synthesis and cross-referencing."
tags:
  - knowledge-management
  - markdown
  - personal-wiki
  - llm-workflow
timestamp: "2026-06-22T18:24:34Z"
---
# Obsidian

## Summary

Obsidian is a markdown-based knowledge management application that serves as the foundational storage and interface layer for persistent, interlinked personal wikis. In modern AI-augmented workflows, it is utilized to host LLM-generated wiki pages, raw sources, and indexing files, enabling incremental knowledge compilation and cross-referencing without the overhead of traditional database systems.

## Key Details

- **Markdown-First Architecture:** Stores all notes and wiki pages as plain `.md` files, ensuring portability and compatibility with version control systems like Git.
- **Cross-Referencing & Linking:** Native support for bidirectional linking and backlinks, which aligns with the LLM Wiki pattern's requirement for associative knowledge trails and entity pages.
- **Workflow Integration:** Acts as the central repository in the Ingest-Query-Lint workflow, where LLM agents append summaries, update entity pages, and maintain `index.md` and `log.md` files.
- **Separation of Concerns:** Structurally supports the distinction between immutable raw source documents and dynamic, synthesized wiki content, allowing for clean knowledge maintenance.
- **Local-First & Extensible:** Runs locally by default, providing full user control over data while supporting plugins and community tools to enhance LLM integration and syntax highlighting.

## Related Concepts

[[LLM Wiki]], [[RAG]], [[Vannevar Bush]], [[Memex]], [[Git]], [[Knowledge Maintenance]]