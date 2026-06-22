---
type: "Concept"
title: "Persistent Wiki"
description: "A pattern for building personal knowledge bases where information is compiled once and maintained incrementally by LLMs, creating a compounding artifact with deep cross-references that transcends standard RAG."
tags:
  - knowledge-management
  - llm-workflow
  - personal-wiki
  - rag-alternative
  - obsidian
  - agentic-pattern
timestamp: "2026-06-22T18:24:34Z"
---

# Persistent Wiki

## Summary

A knowledge management pattern where a personal wiki is maintained incrementally by Large Language Models, compiling information once to form a persistent, interlinked artifact. Unlike standard Retrieval-Augmented Generation (RAG) systems that re-process queries without accumulation, this approach allows the wiki to evolve into a compounding asset where cross-references and synthesis deepen with each new source. The pattern shifts the maintenance burden from humans to LLMs, enabling users to focus on curation while agents handle bookkeeping, consistency, and cross-referencing.

## Key Details

- **Architecture:** Consists of immutable raw sources, a dynamic wiki of LLM-generated markdown files (summaries and entity pages), and a configuration schema guiding agent behavior.
- **Operations:**
  - **Ingest:** New documents trigger updates to entity pages and cross-references.
  - **Query:** Supports synthesis and allows valuable answers to be filed back into the wiki.
  - **Lint:** Periodic health-check process to resolve contradictions, stale claims, and orphans.
- **Compounding Value:** The wiki acts as a compounding artifact; value increases over time as cross-references and synthesis accumulate.
- **Tools & Ecosystem:** Supported by tools such as [[Obsidian]], version control via Git, and specialized indexing files like `index.md` and `log.md`.
- **Inspiration:** Draws from [[Vannevar Bush]]'s conceptualization of the [[Memex]], emphasizing a private, curated knowledge store with associative trails.

## Related Concepts

[[LLM Wiki]], [[RAG]], [[Incremental Knowledge Building]], [[Cross-referencing]], [[Knowledge Maintenance]], [[Memex]], [[Obsidian]]