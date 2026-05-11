---
description: Generate reports, syntheses, or thematic overviews across vault(s). Usage: /wiki-report vault1,vault2,... <Report-Inquiry>
---

# Wiki Report Command

This command explicitly triggers the report generation process to create comprehensive thematic overviews or Map of Content (MOC) pages.

# 1. Discovery Phase

- Read `Vaults/<VaultName>/wiki/index.md` and `Vaults/<VaultName>/wiki/timeline.md` for _each_ vault in $1 to identify all relevant [[Wikilinks]] related to the report inquiry: "$2"
- List the specific files in `Vaults/<VaultName>/wiki/concepts/`, `Vaults/<VaultName>/wiki/summaries/`, and `Vaults/<VaultName>/wiki/persons/` across all provided vaults that will form the basis of the synthesis.

# 2. Synthesis Logic

- **Compare and Contrast**: Identify where authors of different inbox sources agree or disagree.
- **Timeline Construction**: If the theme is historical/evolutionary, arrange the findings chronologically.
- **MOC Creation**: Create a "Map of Content" if one doesn't exist, acting as a curated "hub" for that specific report inquiry.

# 3. Output Format

- Write the result to `Vaults/!`echo "a,b,c" | cut -d',' -f1`/wiki/reports/[Report-Name].md`
- **Structural Requirement**: Every paragraph must link back to one or more existing wiki pages to prove inter-connectivity.
- **Callouts**: Use Obsidian `> [!abstract] Key Insight` blocks to highlight "emergent" ideas (ideas that only appeared once you looked at all sources together).

# 4. Qwen 3.6 Optimization

- Use the `<thought>` block to draft a "Conceptual Map" (Mental Graph) before writing any Markdown.
- Ensure the synthesis includes a "Future Research" section identifying what is _missing_ from the current wiki to fully understand the topic.
