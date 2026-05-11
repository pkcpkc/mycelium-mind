---
description: Automatically triggers when the user asks a question about the wiki content, knowledge base, or personal notes. Uses a retrieval-augmented process to search one or more Vaults/<VaultName>/wiki and provide sourced answers.
---

# Wiki Q&A Skill

When the user asks a question about the wiki content, follow this retrieval-augmented process:

## 0. Vault Identification
- **Determine Target Vault(s)**: Identify which vault(s) the user is asking about. If the user doesn't specify a vault, assume they want to query all available vaults in the `Vaults/` directory or ask for clarification based on context.

## 1. Search Phase
- Use `grep` or the `search` tool to find the user's keywords specifically inside the `Vaults/<VaultName>/wiki` directories for the identified vault(s).
- Look for the most relevant files in `Vaults/<VaultName>/wiki/concepts/`, `Vaults/<VaultName>/wiki/summaries/`, and `Vaults/<VaultName>/wiki/persons/`.

## 2. Read Phase
- Read the top 3-5 most relevant `.md` files found in the search.
- Check the `index.md` for any high-level category links related to the question.
- Check `timeline.md` if the question involves dates, events, or a chronological sequence.

## 3. Answer Phase
- Respond to the user using **only** the information found in those files.
- If the information is missing, state: "I couldn't find information about [Topic] in your wiki."
- **Crucial**: Always include "Sources:" at the bottom with [[Wikilinks]] to the files you read.

## Optimization for Qwen 3.6
- Use a `<thought>` block to evaluate which wiki pages are most likely to contain the answer before reading them.
- If the question is complex, cross-reference multiple entity pages to find a synthesized answer.
