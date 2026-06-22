---
type: "Concept"
title: "Knowledge Bundle"
description: "A hierarchical collection of individual knowledge concepts structured according to the Open Knowledge Format (OKF) specification."
tags: [knowledge-representation, data-format, markdown, specification]
timestamp: "2026-06-22T18:22:51Z"
---
# Knowledge Bundle

## Summary

A [[Knowledge Bundle]] is a hierarchical collection of individual knowledge concepts structured according to the Open Knowledge Format (OKF) v0.1 specification. It serves as the foundational organizational unit for representing, exchanging, and routing knowledge in a lightweight, human- and agent-friendly markdown-based format.

## Key Details

- Composed of individual [[Concept]] documents that define a `type` field for dynamic routing, filtering, and consumption by agents.
- Forms a hierarchical structure that enables progressive disclosure and logical grouping of related knowledge units.
- Designed for permissive consumption, supporting optional metadata, graceful handling of unknown types, and robust cross-linking via standard markdown links.
- Integrates with supporting structures such as [[Index Files]] for navigation, [[Log Files]] for change tracking, and standardized [[Citations]] for external references.
- Explicitly decoupled from fixed storage infrastructure, query languages, or rigid taxonomies to maximize interoperability and scalability.

## Related Concepts

[[Open Knowledge Format]], [[Concept]], [[Index Files]], [[Log Files]], [[Citations]]