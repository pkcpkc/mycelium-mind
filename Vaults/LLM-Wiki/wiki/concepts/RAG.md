---
type: "Concept"
title: "RAG"
description: "A standard architectural pattern that augments large language model outputs with dynamic external retrieval, typically lacking persistent knowledge accumulation across queries."
tags:
  - rag
  - llm-workflow
  - knowledge-retrieval
timestamp: "2026-06-22T18:24:34Z"
---
# RAG

## Summary

Retrieval-Augmented Generation (RAG) is a standard architectural pattern that enhances large language model responses by dynamically retrieving and incorporating relevant external information during inference. Unlike persistent wiki-based systems, RAG typically operates without automatic knowledge accumulation, meaning the model must rediscover and process information on every query rather than building a compounding, cross-referenced knowledge base over time.

## Key Details

- **Per-Query Retrieval:** Knowledge is fetched dynamically at inference time rather than being pre-indexed into a persistent, structured artifact.
- **No Automatic Accumulation:** The system does not inherently merge new information into existing contexts or build associative links across separate queries.
- **Stateless Knowledge Access:** Relies on external document stores or vector databases to supplement the model's parametric memory during each generation step.
- **Contrast with Incremental Wikis:** Lacks the compounding artifact structure, automated cross-referencing, and maintenance workflows (Ingest, Query, Lint) found in [[LLM Wiki]] patterns.

## Related Concepts

[[LLM Wiki]], [[Knowledge Retrieval]], [[Vector Databases]], [[Large Language Models]]