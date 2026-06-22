---
type: "Concept"
title: "Index Files"
description: "A structural convention in the Open Knowledge Format used to enable progressive disclosure of knowledge within hierarchical bundles."
tags:
  - knowledge-representation
  - okf
  - progressive-disclosure
timestamp: "2026-06-22T18:22:51Z"
---
# Index Files

## Summary

Index Files are a key structural convention within the Open Knowledge Format (OKF) v0.1 specification, designed to enable progressive disclosure of knowledge. They serve as navigational or organizational entry points within hierarchical [[Knowledge Bundle]]s, allowing users and automated agents to progressively uncover detailed [[Concept]] documents without being overwhelmed by the entire knowledge graph at once.

## Key Details

- **Progressive Disclosure:** Index files act as curated gateways or manifests that reveal related concepts incrementally, improving both human readability and agent parsing efficiency.
- **OKF Integration:** Defined as a core structural convention in OKF v0.1, working alongside [[Log Files]] and standardized [[Citations]] to maintain a lightweight, markdown-based knowledge graph.
- **Hierarchical Navigation:** Support the organization of [[Knowledge Bundle]]s by providing high-level overviews that link down to specific [[Concept]] pages.
- **Agent-Friendly:** Designed to be machine-parsable, allowing automated agents to traverse the knowledge graph dynamically without requiring central registries or proprietary SDKs.

## Related Concepts

[[Open Knowledge Format]], [[Knowledge Bundle]], [[Concept]], [[Log Files]], [[Citations]]