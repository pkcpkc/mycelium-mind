# Summary: LLM Wiki

**Source:** [[llm-wiki]]
**Ingested:** 2026-05-11

## Overview

A pattern for building personal knowledge bases using LLMs as active wiki maintainers rather than passive RAG systems.

## Core Idea

Instead of retrieving raw documents at query time (traditional RAG), the LLM **incrementally builds and maintains a persistent wiki** — a structured, interlinked collection of markdown files. The wiki is a persistent, compounding artifact that:

- Reads new sources and integrates extracted information into existing pages
- Updates entity pages and topic summaries
- Notes contradictions between new and old data
- Maintains cross-references automatically

The human curates sources and asks questions; the LLM handles all maintenance (summarizing, cross-referencing, filing, bookkeeping).

## Architecture: Three Layers

1. **Raw sources** — Immutable collection of source documents (articles, papers, images). Source of truth.
2. **The wiki** — LLM-generated markdown files: summaries, entity pages, concept pages, comparisons, overview, synthesis. Owned entirely by the LLM.
3. **The schema** — Configuration document (e.g., CLAUDE.md, AGENTS.md) defining wiki structure, conventions, and workflows.

## Operations

- **Ingest:** Drop source in → LLM reads it, writes/updates summary pages, updates entity and concept pages across the wiki, appends to log.
- **Query:** Ask questions against wiki → LLM finds relevant pages, synthesizes answers with citations. Answers can be filed back as new wiki pages.
- **Lint:** Periodic health-checks for contradictions, stale claims, orphan pages, missing cross-references.

## Indexing and Logging

- **index.md** — Content-oriented catalog of all wiki pages with links, one-line summaries, and metadata. Organized by category.
- **log.md** — Chronological append-only record of ingests, queries, and lint passes.

## Optional Tooling

- **qmd** — Local search engine for markdown files with hybrid BM25/vector search and LLM re-ranking
- **Obsidian Web Clipper** — Convert web articles to markdown
- **Dataview / Marp** — Obsidian plugins for queries and slide decks

## Use Cases

- Personal (goals, health, psychology)
- Research (papers, articles, evolving thesis)
- Reading a book (characters, themes, plot threads)
- Business/team (Slack threads, meeting transcripts, project docs)
- Competitive analysis, due diligence, trip planning, course notes, hobby deep-dives

## Historical Context

Related to Vannevar Bush's Memex (1945) — a personal, curated knowledge store with associative trails between documents. Bush envisioned private, actively curated connections as valuable as the documents themselves.

## Key Entities Referenced

[[LLM Wiki Pattern]], [[RAG]], [[Vannevar Bush]], [[Obsidian]], [[OpenAI Codex]], [[Claude Code]]
