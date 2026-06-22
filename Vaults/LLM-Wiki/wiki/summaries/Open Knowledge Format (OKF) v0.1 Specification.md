---
type: Summary
title: Open Knowledge Format (OKF) v0.1 Specification
description: A draft specification defining a minimal, human- and agent-friendly
  markdown-based format for structuring, linking, and exchanging knowledge
  bundles across systems.
tags:
  - knowledge-representation
  - data-format
  - markdown
  - specification
entities:
  concepts:
    - Open Knowledge Format
    - Knowledge Bundle
    - Concept
    - Frontmatter
    - Cross-linking
    - Index Files
    - Log Files
    - Citations
    - Versioning
  persons: []
times: []
relationships: []
resource: assets/2026-06-22/OKF-SPEC.md
timestamp: 2026-06-22T18:22:51Z
---

# Open Knowledge Format (OKF) v0.1

The provided document outlines version 0.1 of the Open Knowledge Format (OKF), a lightweight specification designed to standardize knowledge representation using plain markdown files and YAML frontmatter. The format prioritizes human readability and machine parsability, eliminating the need for central registries or proprietary SDKs. At its core, OKF structures knowledge into hierarchical [[Knowledge Bundle]]s composed of individual [[Concept]] documents. Each concept must define a `type` field, enabling agents to route, filter, and consume data dynamically. The specification encourages a permissive consumption model, allowing agents to gracefully handle unknown types, optional metadata fields, and broken cross-links, which fosters scalability and collaborative enrichment.

Key structural conventions include the use of [[Index Files]] for progressive disclosure, [[Log Files]] for tracking change history, and standardized [[Citations]] for external references. Cross-linking between concepts is handled via standard markdown links, forming a directed graph that conveys semantic relationships through surrounding prose. The specification explicitly avoids dictating storage infrastructure, query languages, or fixed taxonomies, instead focusing on a minimal set of interoperable rules. By aligning with familiar developer workflows like version control and personal knowledge management tools, OKF v0.1 establishes a foundational layer for building agent-ready knowledge graphs and distributed data catalogs.

(source: Open Knowledge Format (OKF) v0.1)