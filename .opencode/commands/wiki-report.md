---
description: Generate reports, syntheses, or thematic overviews across vault(s). Usage: /wiki-report vault1,vault2,... <Report-Inquiry>
---

# Wiki Report Command

This command explicitly triggers the report generation process to create comprehensive thematic overviews or Map of Content (MOC) pages.

## Report Schema

!`cat ./Vaults/$1/schemas/report.md`

## Discovery Phase

- Read the main `index.md` and `timeline.md` files for _each_ vault in $1 to identify all relevant [[Wikilinks]] related to the report inquiry: "$2"
- List the specific files in the `concepts/`, `summaries/`, and all directories across all provided vaults that will form the basis of the synthesis.

## Synthesis Logic

- **Compare and Contrast**: Identify where authors of different inbox sources agree or disagree.
- **Timeline Construction**: If the theme is historical/evolutionary, arrange the findings chronologically.
- **MOC Creation**: Create a "Map of Content" if one doesn't exist, acting as a curated "hub" for that specific report inquiry.

## Output Format

- Write the result to the reports directory (e.g. `reports/[Report-Name].md`).
- Follow the Report Schema template EXACTLY for frontmatter and structure.
- **Structural Requirement**: Every paragraph must link back to one or more existing wiki pages to prove inter-connectivity.
- **Callouts**: Use Obsidian `> [!abstract] Key Insight` blocks to highlight "emergent" ideas.

## Wikilinks Format Rule

- All internal links MUST be simple Obsidian wikilinks without folder prefixes.
- **Correct:** `[[Andrej Karpathy]]`, `[[Deep Learning]]`
- **Incorrect:** `[[concepts/Deep Learning]]`

## Optimization

- Ensure the synthesis includes a "Future Research" section identifying what is _missing_ from the current wiki to fully understand the subject.
