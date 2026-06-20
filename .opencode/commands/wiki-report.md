---
description: Generate reports, syntheses, or thematic overviews across vault(s). Usage: /wiki-report vault1,vault2,... <Report-Inquiry>
---

# Wiki Report Command

This command explicitly triggers the report generation process to create comprehensive thematic overviews or Map of Content (MOC) pages.

This command MUST follow the Wiki Core rules defined in `AGENTS.md` (directory layout, wikilink formatting, and source attribution).

## Discovery Phase

- Read the main `index.md` and `timeline.md` files for _each_ vault in $1 to identify all relevant [[Wikilinks]] related to the report inquiry: "$2"
- List the specific files in the `topics/`, `summaries/`, and all directories across all provided vaults that will form the basis of the synthesis.

## Synthesis Logic

- **Compare and Contrast**: Identify where authors of different inbox sources agree or disagree.
- **Timeline Construction**: If the theme is historical/evolutionary, arrange the findings chronologically.
- **MOC Creation**: Create a "Map of Content" if one doesn't exist, acting as a curated "hub" for that specific report inquiry.

## Output Format

- Write the result to the reports directory (e.g. `reports/[Report-Name].md`).
- **Structural Requirement**: Every paragraph must link back to one or more existing wiki pages to prove inter-connectivity following the `AGENTS.md` wikilink format rule.
- **Callouts**: Use Obsidian `> [!abstract] Key Insight` blocks to highlight "emergent" ideas (ideas that only appeared once you looked at all sources together).

## Optimization

- Ensure the synthesis includes a "Future Research" section identifying what is _missing_ from the current wiki to fully understand the topic.

!`cat .opencode/commands/wiki-sync/wiki-rules.md`
