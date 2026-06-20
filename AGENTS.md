# Developer Agent Guide — Mycelium Mind

Welcome! This guide outlines the development environment, tooling, and model context integrations designed to optimize your workflow when developing and maintaining **Mycelium Mind**.

---

## 1. Environment & Runtime Parity with `mise`

This repository uses `mise` to ensure reproducible runtime environments (Python and Node.js) across development machines and agents.

### Activation & Trust

Before performing any task, make sure you activate and trust the configuration:

```bash
# Trust the local .mise.toml config
mise trust

# Install any missing tool runtimes
mise install
```

### Executing Commands with `mise`

To run commands utilizing the pinned Python and Node.js versions without needing to modify your global shell environment, execute them using `mise exec --`:

```bash
# Run python scripts using the pinned version (3.11.15)
mise exec -- python script.py

# Run node tools or scripts using the pinned version (25.9.0)
mise exec -- node index.js
mise exec -- npm run build
```

### Python Virtual Environment (`.venv`)

The local Python virtual environment is located at `./.venv/` in the project root.

- It is created using Python `3.11.15`.
- All Python packages, including `headroom-ai`, are installed in this environment.
- Always execute Python-based commands using `./.venv/bin/python` or `./.venv/bin/<executable>`.

---

## 2. Antigravity IDE Integration (MCP Servers)

Use `headroom` and `tokensave` MCP servers to save tokens.

### Mycelium Mind MCP Server (`mycelium-mind`)

When interacting with the wiki, use the `mycelium-mind` MCP server to quickly query vault content instead of reading files manually. It exposes a clean JSON API over your vaults with sanitized wikilinks and no raw file paths.

| Tool | Parameters | Description |
| :--- | :--- | :--- |
| `get_vaults` | — | Lists all available vaults (multi-vault mode only). |
| `get_persons` | `vault_name` | Lists all biography nodes. |
| `get_person_details` | `vault_name`, `name` | Person bio, metadata, links, social-graph connections. |
| `get_concepts` | `vault_name` | Lists all concept nodes. |
| `get_concept_details` | `vault_name`, `title` | Concept content, metadata, and wikilinks. |
| `get_timeline` | `vault_name`, `start_date`, `end_date` | Chronological events in a date range with source assets. |
| `get_summaries` | `vault_name` | Lists all document summaries. |
| `get_summary` | `vault_name`, `title` | Summary content, source assets, and links. |
| `get_reports` | `vault_name` | Lists all thematic reports. |
| `get_report` | `vault_name`, `title` | Report content, theme data, and links. |

---

## 3. Best Practices for Developer Agents

When performing edits or running tests on **Mycelium Mind**:

1.  **Use the correct binaries & runtime manager:** Do not invoke global python or node runtimes if they diverge from `.mise.toml`. Prefix command executions with `mise exec --` or run files directly from `.venv/bin/`.
2.  **Rely on TokenSave:** Use `tokensave` queries to explore file structures and symbol definitions before resorting to reading large directories or files.
3.  **Keep it Offline-Friendly:** Keep in mind that Mycelium Mind is designed to be a fully offline vault engine. All scripts in `.opencode/` should run successfully without external network dependencies.

---

## 4. Wiki Core Configuration and Rules

This section defines the common directory paths, wikilink format, and source attribution rules for any `LLM-Wiki` vault operations. Follow these rules in all wiki commands.

### Vault Directory Layout

All wiki vaults are stored under `./Vaults/<VaultName>/wiki/` and follow this path structure:

- **Root Directory:** `./Vaults/<VaultName>/wiki/`
- **Main Index:** `./Vaults/<VaultName>/wiki/index.md` (root index page)
- **Concepts Directory:** `./Vaults/<VaultName>/wiki/concepts/<ConceptName>.md`
- **Summaries Directory:** `./Vaults/<VaultName>/wiki/summaries/<SummaryName>.md`
- **Reports Directory:** `./Vaults/<VaultName>/wiki/reports/<ReportName>.md`
- **Assets Directory:** `./Vaults/<VaultName>/wiki/assets/YYYY-MM-DD/`

### Wikilinks Format Rule

- **Simple Wikilinks Only:** All internal page-to-page links MUST be simple Obsidian wikilinks without any folder prefixes.
- **Correct Format:** `[[Anthropic]]`, `[[Andrej Karpathy]]`, `[[Deep Learning]]`.
- **Incorrect Format:** `[[concepts/Anthropic]]`, `[[persons/Andrej Karpathy]]`. Do NOT include folder/directory prefixes like `concepts/` or `persons/` inside wikilinks.

### Source Attribution Rule

- **Standard Markdown Format:** All source references/attributions MUST be standard Markdown links.
- **No Quotes or Angle Brackets:** The link URL must NOT contain double quotes (`"`) or angle brackets (`<`, `>`).
- **Correct Format:** `([Filename](assets/YYYY-MM-DD/filename.md))`.
- **Incorrect Formats:**
  - `([Filename](<"assets/YYYY-MM-DD/filename.md">"))` (contains quotes and brackets)
  - `([Filename](<assets/YYYY-MM-DD/filename.md>))` (contains brackets)
  - `[[assets/YYYY-MM-DD/filename.md|Filename]]` (do not use Obsidian wikilinks for source attributions)

### Sync Basics

When syncing content from inbox files into the wiki:

- **Summaries:** Generate/update files in `./Vaults/<VaultName>/wiki/summaries`.
- **Concepts:** Append new data to files in `./Vaults/<VaultName>/wiki/concepts`.
- **Conflict Logic:** If new data contradicts the wiki, use an Obsidian warning callout:
  > [!warning] Contradiction
  > New source contradicts existing entry. [Cite both].
- **Attribution:** Append the source reference to every extracted claim following the source attribution rule above.
- **Output Restriction:** DO NOT write to any folders other than `summaries` and `concepts`.
