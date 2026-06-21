---
description: Perform a health check and OKF compliance audit on the wiki. Identifies broken links, orphaned pages, duplicate concepts, frontmatter issues, and content gaps. Usage: /wiki-lint <VaultName>
---

# Wiki Linter Command

When triggered, perform a systematic audit of the wiki $1. Do not modify files unless explicitly asked; first, provide a **Status Report**.
If the directory does not exist, don't do anything.

## OKF Compliance Audit

- **Frontmatter Check**: Every `.md` file (except reserved `index.md`) MUST have a parseable YAML frontmatter block with a non-empty `type` field.
- **Schema Conformance**: For each file, load the matching schema from `./Vaults/$1/schemas/<type>.md` and verify required fields are present:
  - Summary: `type`, `title`, `resource`, `timestamp`, `entities.concepts`, `entities.persons`
  - Concept: `type`, `title`, `timestamp`
  - Person: `type`, `title`, `timestamp`
  - Report: `type`, `title`, `timestamp`
- **Person/Concept Separation**: Flag any file in `concepts/` that describes a person, or any person name appearing as a filename in both `concepts/` and `persons/`.
- **Entity Manifest Integrity**: For each summary, verify that every entity in `entities.concepts` has a corresponding file in `concepts/` and every entity in `entities.persons` has a corresponding file in `persons/`.

## Structural Audit

- **Orphan Check**: Find files in `./Vaults/$1/wiki` that have no incoming [[Wikilinks]] from other pages.
- **Broken Links**: Identify [[Wikilinks]] that point to files that do not exist.
- **Wikilinks Format**: Check that all [[Wikilinks]] use simple format without folder prefixes (e.g., `[[Deep Learning]]` not `[[concepts/Deep Learning]]`).

## Content Quality Audit

- **Stub Detection**: List pages with fewer than 3 sentences (excluding headers).
- **Duplicate Detection**: Flag potential duplicate concepts (e.g., "AI" vs. "Artificial Intelligence" or "LLM" vs. "Large Language Model").
- **Missing Definitions**: Scan summaries for capitalized terms or names that are not yet turned into pages in the `concepts/` or `persons/` directories.

## Consistency Check

- **Contradiction Search**: Look for "Conflict" or "Contradiction" callouts or pages with conflicting metadata.

## Report Format

Present the audit as a structured report with:
1. **OKF Compliance Score**: e.g., `OKF Compliance: 92% (25/27 concepts aligned)`
2. **Issues by Severity**: Critical (missing type), Warning (missing optional fields), Info (stubs)
3. **Actionable Recommendations**: What commands to run to fix issues
