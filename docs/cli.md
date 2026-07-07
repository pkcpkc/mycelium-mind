# Mycelium Mind CLI Command Reference 🧠

The `mycelium-mind` CLI tool can be executed using its binary alias `mm` or through `npx mm`. 

All commands that require a `<wiki-path>` parameter (e.g., `sync`, `resync`, `publish`, `check-plugins`) have it configured as **optional** and default to `.` (the current working directory) if omitted.

---

## 🚀 Commands

### `init [wiki-path]`

Initializes a new wiki vault layout in the targeted directory:
- **Default configurations**: Creates a base MkDocs config at `config/mkdocs.yml`.
- **Default collection plugins**: Populates `plugins/collections/` with `concepts`, `persons`, and `times`.
- **Default overview scripts**: Adds `plugins/overviews/social-graph.js` and `plugins/overviews/timeline.js`.
- **Git Repo**: Initializes a local git repository inside the target directory so that changes and compilations can be version-controlled local to the vault.

```bash
# Initialize a new wiki in a subdirectory
mm init ./my-sovereign-wiki

# Initialize a new wiki in the current working directory
mm init
```

---

### `sync [wiki-path] [options]`

Runs the main incremental compiler pipeline on new documents dropped in `inbox/`:
1. **Summarization**: Summarizes each document into `wiki/summaries/`.
2. **Asset Archiving**: Archives raw source files into dated folders inside `wiki/assets/YYYY-MM-DD/`.
3. **Entity Compilation**: Batches and updates cards under `wiki/collections/` (`concepts`, `persons`, `times`, etc.) by merging new details into existing profiles.
4. **Overviews**: Re-runs overview scripts inside a VM sandbox to regenerate registry and graph pages.
5. **MOC Rebuilding**: Rebuilds tag index pages and relationship clouds.
6. **Git Isolation**: Commits all compiled outputs local to the vault's git repository.

**Options**:
- `-v, --verbose`: Prints assembled LLM prompts (summaries and entity card merges) to standard output before calling the model API.
- `--branch`: Creates and checkouts a temporary git branch (e.g. `sync-YYYYMMDD-HHMMSS`) before compilation, committing all updates there.
- `--pr`: Pushes the sync branch to origin and triggers `gh pr create` (requires the GitHub CLI).

```bash
# Sync the current directory vault
mm sync

# Sync a specific vault in verbose mode
mm sync ./my-vault -v
```

---

### `resync [wiki-path] [options]`

Wipes the compiled entity and summary states and fully re-ingests/re-compiles all source material from archived assets. This is useful when you tweak collection prompts, update schema definitions, or modify overview scripts and want to rebuild the entire wiki from scratch.

**Options**:
- `--collection <name>`: Target a specific collection to rebuild (e.g. `persons`). Keeps existing summaries intact, cleans only the targeted collection's folder, compiles cards for this collection, and applies corresponding overrides.
- Supports the same `-v, --verbose`, `--branch`, and `--pr` options as `sync`.

```bash
# Rebuild the wiki from archived assets
mm resync

# Rebuild only the 'persons' collection, keeping summaries intact
mm resync --collection persons
```

---

### `check-plugins [wiki-path]`

Scans and validates all collection plugins inside the vault's `plugins/collections/` directory in a single scan:
- **Schema Validation**: Validates `schema.yml` formatting and syntax, reporting any parsing issues.
- **Leniency**: Schemas with no custom properties (only containing `$meta` blocks) are accepted silently without errors or warnings.
- **Prompt Validation**: Validates `prompt.md` files to ensure they contain critical expected placeholders (`$VALUE`, `$EXISTING_CONTENT`, `$SUMMARY_CONTENT`).
- **Verbose Diagnostic Logging**: All warning and error logs output the **exact absolute path** of the failing schema/prompt files for straightforward troubleshooting.

```bash
# Scan and validate all collection plugins in the current vault
mm check-plugins
```

---

### `publish [wiki-path] [target-dir]`

Compiles the flat Obsidian-style markdown wiki into a standardized MkDocs static website:
- **Link Conversion**: Preprocesses flat wiki links (e.g., `[[Andrej Karpathy]]`) into relative path markdown links (e.g., `../collections/persons/Andrej_Karpathy.md`).
- **Tag Mapping**: Compiles tag relationships into a root metadata file (`tags.json`) for interactive Cytoscape graphic cloud renderings.
- **MkDocs Compilation**: Builds and compiles static HTML/JS/CSS assets to `[target-dir]`.

```bash
# Compile site to a static folder
mm publish . ./dist/site
```

---

### `rag [wiki-path] [options]`

Starts the `knowledge-rag` MCP (Model Context Protocol) server to search your local wiki. The underlying engine is powered by [lyonzin/knowledge-rag](https://github.com/lyonzin/knowledge-rag). It reads the vault settings from `config/config.yml` (under the `rag:` key) and allows CLI flags to override configuration settings.

**Options**:
- `--transport <stdio|sse>`: MCP transport mode (defaults to `sse` or the config value).
- `--port <number>`: Port to run the SSE server on (default: `8179`).
- `--host <string>`: Host interface to bind (default: `127.0.0.1`).
- `--rate-limit <rpm>`: Enable sliding-window rate limiting with the specified requests-per-minute.
- `--prometheus-port <port>`: Enable Prometheus metrics scraping on the specified port.
- `--chromadb-wal`: Force ChromaDB Write-Ahead Logging mode (automatically enabled in `sse` mode).

```bash
# Start standard RAG server via SSE
mm rag

# Start RAG server via local stdio for Claude Code/Claude Desktop
mm rag --transport stdio

# Start RAG server on a custom port with rate limiting enabled
mm rag --port 9000 --rate-limit 120
```

#### Client Configuration (MCP JSON)

Add the following configuration blocks to your MCP client (e.g. `claude_desktop_config.json`, Cursor, or Windsurf settings):

##### 1. For Stdio Transport (Automatic Spawning)
```json
{
  "mcpServers": {
    "mycelium-mind-rag": {
      "command": "mm",
      "args": ["rag", "/absolute/path/to/your/wiki", "--transport", "stdio"]
    }
  }
}
```
*(Note: If you run with `mise`, you can set the command to `"mise"` and prepend `["exec", "--", "mm", ...]` to the arguments list).*

##### 2. For SSE Transport (Connecting to a Persistent Server)
First start the server via `mm rag` in the terminal, then configure the client:
```json
{
  "mcpServers": {
    "mycelium-mind-rag": {
      "type": "sse",
      "url": "http://127.0.0.1:8179/sse"
    }
  }
}
```

---

## ⚙️ Wiki Configuration (`config/config.yml`)

Each wiki vault has a configuration file located at `config/config.yml` that governs pipeline execution settings and option variables.

### Pipeline Settings

- **`parallelPromptExecution`** (boolean): 
  Controls whether LLM summarizations (during `sync`) and collection entity card compiles are executed concurrently or sequentially.
  - `true`: Speeds up the compilation process significantly by running LLM calls in parallel (highly recommended when using robust local servers or cloud APIs).
  - `false` (default): Runs LLM calls sequentially to prevent rate limits or context starvation on smaller local backends (like standard llama.cpp or Ollama single-instance deployments).

### RAG Settings (knowledge-rag)

See the [`rag` command reference](#rag-wiki-path-options) above for details on configuring RAG settings (`rag.transport`, `rag.host`, `rag.port`, `rag.rate_limiting`, `rag.prometheus`) in `config.yml`.

