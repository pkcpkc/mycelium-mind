---
description: Create a beautiful social graph and detailed connection map of all persons in the wiki. Usage: /wiki-social-graph <VaultName>
---

# Wiki Social Graph Command

## Current Vault Context

Vault Name: $1

## Person Schema Reference

!`cat ./Vaults/$1/schemas/person.md`

## Execution Instructions

When this command is triggered, perform a systematic analysis of the wiki vault to map out all persons and their connections:

### 1. Data Gathering Phase

- **Target Directory:**
  - Read all files inside `./Vaults/$1/wiki/persons/`.
- **Extraction:** Identify every person and any mentioned connections (e.g., student-advisor, coworker, classmate, collaborator, mentor, employer, or any interpersonal connections, feelings, or actions mentioned).

### 2. Synthesis and Diagram Generation

- **Mermaid Diagram:**
  - Build a visually clean, no styles, Mermaid flowchart (`flowchart LR`).
  - **Syntax Rules (CRITICAL to avoid rendering failures):**
    - Use short, uppercase alphanumeric IDs for each node based on the person's initials or a simple key (e.g., `AK` for Andrej Karpathy, `FFL` for Fei-Fei Li). Do not use spaces or special characters in node IDs.
    - Provide the person's full name as a label wrapped in double quotes (e.g., `AK["Andrej Karpathy"]`).
    - Define connection arrows with double-quoted labels (e.g., `AK -- "advised by" --> FFL`).
    - For mutual/symmetrical connections, use double arrows or separate lines as appropriate.
- **Detailed Connection Registry:**
  - Below the diagram, write a well-formatted Markdown table detailing the connections.
  - **Columns:** `Person A`, `Connection`, `Person B`, `Description & Context`.
  - Use Obsidian wikilinks to reference the persons' files without folder prefixes.

### 3. File Creation and Updates

- **social-graph.md Creation:**
  - Create the file `Vaults/$1/wiki/social-graph.md` with:
    - `# Social Graph` main title.
    - The generated `mermaid` codeblock.
    - The detailed connection table/registry.
- **Index Update:**
  - Read `Vaults/$1/wiki/index.md`.
  - Update the file to include a `## Social Graph` section:

    ```markdown
    ## Social Graph

    - [[social-graph|Social Graph]] - Interactive social graph and detailed connection map of the individuals in this vault.
    ```

## Wikilinks Format Rule

- All internal links MUST be simple Obsidian wikilinks without folder prefixes.
- **Correct:** `[[Andrej Karpathy]]`, `[[OpenAI]]`
- **Incorrect:** `[[persons/Andrej Karpathy]]`

## Optimization

- **Consistency:** Ensure connection verbs match context from biography files.
- **Readability:** Keep the Mermaid graph organized and clear.
