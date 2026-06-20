---
description: Scans summaries and topics to identify individuals, resolve names, and build/update biography pages under persons/. Usage: /wiki-persons <VaultName>
---

# Wiki Persons Command

## Current Vault Context

Vault Name: $1

## Execution Instructions

When this command is triggered, audit the vault to extract and consolidate biographies for all individuals:

### Data Scan Phase

- **Target Files:**
  - Read all files inside the `./Vaults/$1/wiki/topics/` directory.
- **Extraction:** Identify all mentioned individuals, person wikilinks (e.g. `[[Andrej Karpathy]]`), or names that represent people.

### Biography Compilation and Updates

For each unique individual identified:

- **File Path:** Create or update their biography page under `./Vaults/$1/wiki/persons/[Person Name].md`.
- **Identity Resolution:** Resolve name variations (e.g., matching partial names to full names, nickname variations to the full name).
- **Biography Formatting:**
  - **Title:** `# [Person Name]`
  - **Section - Affiliations/Roles:** Bulleted list of their roles, titles, or affiliations mentioned.
  - **Section - Biography & Context:** Synthesize a cohesive narrative of their contributions, work, and events they are involved in.
  - **Attribution:** Append the source reference to every extracted claim following the `AGENTS.md` source attribution rule.
  - **Obsidian Warning Callouts:** If there are conflicting claims about a person, highlight the contradiction using:

    > [!warning] Contradiction
    > [Brief description of contradiction]. [Cite both sources].

!`cat .opencode/commands/wiki-sync/wiki-rules.md`
