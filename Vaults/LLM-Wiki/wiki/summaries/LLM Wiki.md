---
type: Summary
title: LLM Wiki
description: A pattern for building persistent, interlinked personal knowledge
  bases using LLMs to incrementally compile and maintain a wiki from raw
  sources, reducing maintenance burden through automated cross-referencing and
  synthesis.
tags:
  - knowledge-management
  - llm-workflow
  - personal-wiki
  - rag-alternative
  - obsidian
  - agentic-pattern
entities:
  concepts:
    - LLM Wiki
    - RAG
    - Incremental Knowledge Building
    - Persistent Wiki
    - Cross-referencing
    - Knowledge Maintenance
    - Memex
    - Obsidian
    - Schema-driven LLM
    - Ingest-Query-Lint Workflow
  persons:
    - Vannevar Bush
times:
  - date: "1945"
    title: Vannevar Bush's Memex proposal
resource: assets/2026-06-22/llm-wiki.md
timestamp: 2026-06-22T18:24:34Z
---

# LLM Wiki

The **LLM Wiki** presents a pattern for constructing personal knowledge bases that transcends standard Retrieval-Augmented Generation (RAG) by establishing a persistent, interlinked wiki maintained incrementally by Large Language Models. Unlike traditional RAG systems where the model rediscover knowledge on every query without accumulation, this pattern compiles information once, allowing the wiki to evolve into a compounding artifact where cross-references and synthesis deepen with each new source.

The architecture consists of three layers: immutable **raw sources**, a dynamic **wiki** of LLM-generated markdown files containing summaries and entity pages, and a configuration **schema** that guides the agent's behavior. Key operations include **Ingest**, where new documents trigger updates to entity pages and cross-references; **Query**, which supports synthesis and allows valuable answers to be filed back into the wiki; and **Lint**, a periodic health-check process to resolve contradictions, stale claims, and orphans.

This approach shifts the maintenance burden from humans to LLMs, enabling users to focus on curation and high-level thinking while the agent handles bookkeeping, consistency, and cross-referencing. The workflow is supported by tools such as [[Obsidian]], version control via Git, and specialized indexing files like `index.md` and `log.md`. The pattern draws inspiration from [[Vannevar Bush]]'s conceptualization of the [[Memex]], emphasizing a private, curated knowledge store with associative trails. The framework is abstract and modular, designed to be instantiated by LLM agents tailored to specific domains, ensuring that the wiki remains a valuable, maintained asset over time.