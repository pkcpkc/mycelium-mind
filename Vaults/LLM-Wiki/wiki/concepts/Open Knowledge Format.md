---
type: "Concept"
title: "Open Knowledge Format"
description: "A draft specification defining a minimal, human- and agent-friendly markdown-based format for structuring, linking, and exchanging knowledge bundles across systems."
tags: [knowledge-representation, data-format, markdown, specification]
timestamp: "2026-06-22T18:22:51Z"
---
# Open Knowledge Format

## Summary
Open Knowledge Format (OKF) v0.1 is a lightweight specification designed to standardize knowledge representation using plain markdown files and YAML frontmatter. It prioritizes human readability and machine parsability, eliminating the need for central registries or proprietary SDKs. At its core, OKF structures knowledge into hierarchical [[Knowledge Bundle]]s composed of individual [[Concept]] documents, where each entry requires a `type` field to enable dynamic routing and filtering by automated agents. The format fosters scalability through a permissive consumption model that gracefully handles unknown types, optional metadata, and broken cross-links.

## Key Details
- **Core Structure:** Relies on standard markdown documents enhanced with YAML frontmatter for structured metadata.
- **Agent Readiness:** Defines a required `type` field and encourages graceful degradation for unknown data, making it suitable for automated consumption.
- **Decentralized Architecture:** Explicitly avoids dictating storage infrastructure, query languages, or fixed taxonomies, allowing flexible integration.
- **Navigation & History:** Utilizes [[Index Files]] for progressive discovery and [[Log Files]] to track revision history.
- **Referencing:** Implements standardized [[Citations]] for external references and relies on standard markdown links to form a directed graph of semantic relationships.
- **Developer Alignment:** Designed to integrate seamlessly with existing workflows such as version control systems and personal knowledge management (PKM) tools.
- **Interoperability:** Focuses on a minimal set of interoperable rules to ensure broad compatibility across different knowledge management platforms.

## Related Concepts
[[Knowledge Bundle]], [[Concept]], [[Frontmatter]], [[Cross-linking]], [[Index Files]], [[Log Files]], [[Citations]], [[Versioning]]