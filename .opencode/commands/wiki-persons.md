---
description: Scans summaries and concepts to identify individuals, resolve names, and build/update biography pages under persons/. Usage: /wiki-persons <VaultName>
---

# Wiki Persons Command

## Current Vault Context

Vault Name: $1

## Execution Rules

This command MUST follow the core directory layout, wikilink formatting, and source attribution rules defined in the `wiki-core` skill.

## Execution Instructions

When this command is triggered, audit the vault to extract and consolidate biographies for all individuals:

### 1. Data Scan Phase

- **Target Files:**
  - Read all files inside the `./Vaults/$1/wiki/summaries/` directory.
  - Read all files inside the `./Vaults/$1/wiki/concepts/` directory.
- **Extraction:** Identify all mentioned individuals, person wikilinks (e.g. `[[Andrej Karpathy]]`), or names that represent people.

### 2. Biography Compilation and Updates

For each unique individual identified:

- **File Path:** Create or update their biography page under `./Vaults/$1/wiki/persons/[Person Name].md`.
- **Identity Resolution:** Resolve name variations (e.g., matching partial names to full names, nickname variations to the full name).
- **Biography Formatting:**
  - **Title:** `# [Person Name]`
  - **Section - Affiliations/Roles:** Bulleted list of their roles, titles, or affiliations mentioned.
  - **Section - Biography & Context:** Synthesize a cohesive narrative of their contributions, work, and events they are involved in.
  - **Attribution:** Append the source reference to every extracted claim following the `wiki-core` source format rule.
  - **Obsidian Warning Callouts:** If there are conflicting claims about a person, highlight the contradiction using:
    > [!warning] Contradiction
    > [Brief description of contradiction]. [Cite both sources].
