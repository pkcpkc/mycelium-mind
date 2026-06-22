---
type: "Concept"
title: "Concept"
description: "A fundamental document type within the Open Knowledge Format representing abstract ideas, technologies, or non-person entities, distinguished by a required type field for agent routing and filtering."
tags:
  - knowledge-representation
  - okf-structure
  - agent-interoperability
  - data-schema
timestamp: "2026-06-22T18:22:51Z"
---
# Concept

## Summary

A Concept is a core document type in the Open Knowledge Format (OKF) used to represent abstract ideas, technologies, methodologies, organizations, frameworks, courses, or any non-person entity. Concepts form the building blocks of a Knowledge Bundle and are distinguished by a required `type` field that enables agents to route, filter, and process data dynamically.

## Key Details

- **Document Structure:** Concepts exist as individual documents within a hierarchical [[Knowledge Bundle]], allowing for modular and granular knowledge organization.
- **Type Field Requirement:** Each Concept must define a `type` field, which serves as the primary discriminator for agents to determine how to route, filter, and consume the data.
- **Entity Scope:** Restricted to non-person entities; distinct from entries representing individuals or persons.
- **Agent Interoperability:** Designed for a permissive consumption model, allowing agents to gracefully handle unknown types, optional metadata fields, and broken cross-links to foster scalability.
- **Semantic Linking:** Relationships between concepts are established via standard markdown cross-links, creating a directed graph that conveys semantic meaning through surrounding prose.

## Related Concepts

[[Knowledge Bundle]], [[Frontmatter]], [[Cross-linking]], [[Open Knowledge Format]], [[Versioning]]