---
description: Create a beautiful social graph and detailed connection map of all persons in the wiki. Usage: /wiki-social-graph <VaultName>
---

# Wiki Social Graph Command

## Current Vault Context

Vault Name: $1

## Execution Rules

This command MUST follow the core directory layout, wikilink formatting, and source attribution rules defined in the `wiki-core` skill.

## Execution Instructions

When this command is triggered, perform a systematic analysis of the wiki vault to map out all persons and their connections:

### 1. Data Gathering Phase

- **Target Directories & Files:**
  - Read the main index.md (particularly the `## Persons` section) to locate listed individuals.
  - Read all files inside the persons/ directory.
  - Read all files inside the summaries/ directory.
- **Extraction:** Identify every person and any mentioned connections (e.g., student-advisor, coworker, classmate, collaborator, mentor, employer, or any interpersonal connections, feelings, or actions mentioned).

### 2. Synthesis and Diagram Generation

- **Mermaid Diagram:**
  - Build a visually clean, no styles, Mermaid flowchart (`flowchart TD` or `flowchart LR`).
  - **Syntax Rules (CRITICAL to avoid rendering failures):**
    - Use short, uppercase alphanumeric IDs for each node based on the person's initials or a simple key (e.g., `AK` for Andrej Karpathy, `FFL` for Fei-Fei Li). Do not use spaces or special characters in node IDs.
    - Provide the person's full name as a label wrapped in double quotes (e.g., `AK["Andrej Karpathy"]`).
    - Define connection arrows with double-quoted labels (e.g., `AK -- "advised by" --> FFL`).
    - For mutual/symmetrical connections, use double arrows or separate lines as appropriate (e.g., `AK -- "collaborated with" --> AN["Andrew Ng"]`).
- **Detailed Connection Registry:**
  - Below the diagram, write a well-formatted Markdown table detailing the connections.
  - **Columns:** `Person A`, `Connection`, `Person B`, `Description & Context`.
  - Use Obsidian wikilinks to reference the persons' files, ensuring you follow the `wiki-core` wikilink format rule.

### 3. File Creation and Updates

- **social-graph.md Creation:**
  - Create the file `Vaults/$1/wiki/social-graph.md` with:
    - `# Social Graph` main title.
    - The generated `mermaid` codeblock.
    - The detailed connection table/registry.
    - **Attribution:** Append the source reference to every extracted claim following the `wiki-core` source format rule.
- **Index Update:**
  - Read `Vaults/$1/wiki/index.md`.
  - Update the file to update or add a `## Social Graph` section:

    ```markdown
    ## Social Graph

    - [[social-graph|Social Graph]] - Interactive social graph and detailed connection map of the individuals in this vault.
    ```

## Local Model Optimization

- **Consistency:** Ensure connection verbs match context from biography files.
- **Readability:** Keep the Mermaid graph organized and clear. If a node has many connections, space out the layout.
