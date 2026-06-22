---
type: "Concept"
title: "Ingest-Query-Lint Workflow"
description: "A three-phase operational pattern for maintaining a persistent, interlinked knowledge base using LLMs, involving document ingestion, synthesis-based querying with feedback filing, and periodic consistency checking."
tags:
  - knowledge-management
  - llm-workflow
  - agentic-pattern
  - personal-wiki
  - obsidian
  - rag-alternative
timestamp: "2026-06-22T18:24:34Z"
---
# Ingest-Query-Lint Workflow

## Summary

The **Ingest-Query-Lint Workflow** is a structured operational pattern designed to maintain a persistent, interlinked personal knowledge base using Large Language Models. It shifts the cognitive and administrative burden of knowledge maintenance from humans to automated agents, enabling users to focus on curation and high-level synthesis while the system handles bookkeeping, consistency, and cross-referencing.

## Key Details

- **Ingest Phase**: New documents or sources trigger automated updates to entity pages and generate new cross-references within the wiki, ensuring the knowledge base grows incrementally from raw inputs.
- **Query Phase**: Supports complex synthesis tasks and allows valuable answers or insights to be filed back into the wiki, transforming transient queries into permanent, structured knowledge artifacts.
- **Lint Phase**: A periodic health-check process that automatically resolves contradictions, removes stale claims, and fixes orphaned links or broken references to maintain wiki health.
- **Architecture Layers**: Operates across three distinct layers: immutable raw sources, a dynamic wiki of LLM-generated markdown files (summaries and entity pages), and a configuration schema that guides agent behavior.
- **Tooling & Integration**: Typically implemented using tools like [[Obsidian]], version control via Git, and specialized indexing files (`index.md`, `log.md`) to track changes and maintain structure.

## Related Concepts

[[LLM Wiki]], [[RAG]], [[Incremental Knowledge Building]], [[Persistent Wiki]], [[Cross-referencing]], [[Knowledge Maintenance]], [[Memex]], [[Obsidian]], [[Schema-driven LLM]]