---
type: "Concept"
title: "Incremental Knowledge Building"
description: A knowledge management pattern where AI agents continuously compile, synthesize, and maintain a persistent, interlinked wiki from raw sources, allowing knowledge to compound over time with minimal human maintenance.
tags:
  - knowledge-management
  - llm-workflow
  - personal-wiki
  - rag-alternative
  - obsidian
  - agentic-pattern
timestamp: "2026-06-22T18:24:34Z"
---
# Incremental Knowledge Building

## Summary
Incremental Knowledge Building is a knowledge management pattern that leverages Large Language Models (LLMs) to continuously compile, synthesize, and maintain a persistent, interlinked wiki from raw sources. Unlike traditional retrieval systems that rediscover information on every query, this approach compiles data once and allows the knowledge base to evolve into a compounding artifact. As new sources are added, cross-references and synthesized insights deepen automatically, significantly reducing the human maintenance burden while preserving high-level curation and critical thinking.

## Key Details
- **Compounding Knowledge Base**: Information is compiled once and updated incrementally, allowing the wiki to grow in depth and accuracy with each new source ingestion.
- **Three-Layer Architecture**: Consists of immutable raw sources, a dynamic wiki of LLM-generated markdown/entity pages, and a configuration schema that guides agent behavior.
- **Automated Workflow Operations**: 
  - *Ingest*: New documents trigger automatic updates to entity pages, summaries, and cross-references.
  - *Query*: Supports synthesis and allows valuable answers to be filed back into the wiki for long-term retention.
  - *Lint*: Periodic health-checks performed by agents to resolve contradictions, update stale claims, and fix orphaned links.
- **Shifted Maintenance Burden**: Automates bookkeeping, consistency checks, and cross-referencing, enabling users to focus on high-level curation and strategic thinking.
- **Tooling & Inspiration**: Built upon tools like [[Obsidian]] and version control (Git), drawing conceptual inspiration from [[Vannevar Bush]]'s [[Memex]] for private, curated knowledge stores with associative trails.

## Related Concepts
[[LLM Wiki]], [[RAG]], [[Persistent Wiki]], [[Cross-referencing]], [[Knowledge Maintenance]], [[Memex]], [[Obsidian]], [[Ingest-Query-Lint Workflow]]