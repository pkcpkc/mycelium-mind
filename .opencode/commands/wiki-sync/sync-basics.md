- **Summaries:** Generate/update files in the summaries in `./Vaults/$1/wiki/summaries`.
- **Concepts:** Append new data to files in the concepts in `./Vaults/$1/wiki/concepts`.
- **Conflict Logic:** If new data contradicts the wiki, use an Obsidian warning callout:
  > [!warning] Contradiction
  > New source contradicts existing entry. [Cite both].
- **Attribution:** Append the source reference to every extracted claim following the `wiki-core` source format rule.

- DONT WRITE TO ANY OTHER FOLDERS OTHER THAN `summaries` and `concepts`!
