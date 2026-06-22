---
type: "Concept"
title: "LLM Wiki"
description: "A pattern for building persistent, interlinked personal knowledge bases using LLMs to incrementally compile and maintain a wiki from raw sources, reducing maintenance burden through automated cross-referencing and synthesis."
tags: [knowledge-management, llm-workflow, personal-wiki, rag-alternative, obsidian, agentic-pattern]
timestamp: "2026-06-22T18:24:34Z"
---
# LLM Wiki

## Summary

The LLM Wiki is a knowledge management pattern that establishes a persistent, interlinked personal wiki incrementally maintained by Large Language Models. It transcends traditional Retrieval-Augmented Generation (RAG) by compiling information once, allowing the knowledge base to evolve into a compounding artifact where cross-references and synthesized insights deepen over time.

## Key Details

- **Architecture:** Comprises three layers: immutable raw sources, a dynamic wiki of LLM-generated markdown files containing summaries and entity pages, and a configuration schema that guides the agent's behavior.
- **Core Operations:** 
  - **Ingest:** New documents trigger automatic updates to entity pages and cross-references.
  - **Query:** Supports advanced synthesis, with valuable answers automatically filed back into the wiki for long-term retention.
  - **Lint:** A periodic health-check process to resolve contradictions, remove stale claims, and fix orphaned links.
- **Benefits:** Shifts the maintenance burden from humans to LLMs, enabling users to focus on curation and high-level thinking while the agent handles bookkeeping, consistency, and cross-referencing.
- **Tools & Ecosystem:** Designed to integrate with [[Obsidian]], version control via Git, and specialized indexing files like `index.md` and `log.md`.
- **Historical Inspiration:** Draws conceptual roots from [[Vannevar Bush]]'s 1945 proposal for the [[Memex]], emphasizing a private, curated knowledge store with associative trails.

## Related Concepts

[[RAG]], [[Incremental Knowledge Building]], [[Persistent Wiki]], [[Cross-referencing]], [[Knowledge Maintenance]], [[Memex]], [[Obsidian]], [[Schema-driven LLM]], [[Ingest-Query-Lint Workflow]]