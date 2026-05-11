# LLM Wiki Pattern

A knowledge base architecture where an LLM incrementally builds and maintains a persistent, interlinked wiki from ingested sources.

## Key Principles

- **Compounding knowledge:** The wiki grows richer with every source added, not re-derived on each query
- **LLM-owned writing:** Humans source and query; LLM writes, organizes, cross-references, and maintains
- **Three-layer architecture:** Raw sources (immutable) → Wiki (LLM-generated) → Schema (configuration)
- **Active maintenance:** Summaries updated, entity pages revised, contradictions flagged

## Contrast with RAG

Traditional RAG retrieves raw document chunks at query time — the LLM rediscover knowledge from scratch every question. The wiki approach compiles knowledge once and keeps it current.

## Core Operations

- **Ingest:** LLM reads source, writes/updates summary pages, updates entity and concept pages
- **Query:** LLM searches wiki pages, synthesizes answers with citations
- **Lint:** Periodic health-checks for contradictions, stale claims, orphan pages

## Indexing Strategy

Two-file system:
- **index.md** — Content-oriented catalog with links, summaries, metadata per page
- **log.md** — Chronological append-only record of wiki evolution

## Historical Context

Related to [[Vannevar Bush]]'s Memex (1945) — personal, curated knowledge store with associative trails between documents.

## Source Attribution

- [[assets/2026-05-11/llm-wiki.md]]
