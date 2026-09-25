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
1. **Asset Extraction (Pre-Step)**: Binary and media assets are automatically processed into text before summarization:
   - **Audio files** (`.mp3`, `.wav`, `.m4a`, `.ogg`, `.flac`, `.aac`): Transcribed to markdown/text using the configured `stt` model.
   - **Images & PDFs** (`.png`, `.jpg`, `.jpeg`, `.pdf`): Scanned and transcribed using the configured `ocr` model.
2. **Summarization**: Summarizes each document or transcribed text into `wiki/summaries/`.
3. **Asset Archiving**: Archives raw source files and companion notes into dated folders inside `wiki/assets/YYYY-MM-DD/`.
4. **Entity Compilation**: Batches and updates cards under `wiki/collections/` (`concepts`, `persons`, `times`, etc.) by merging new details into existing profiles.
5. **Overviews**: Re-runs overview scripts inside a VM sandbox to regenerate registry and graph pages.
6. **MOC Rebuilding**: Rebuilds tag index pages and relationship clouds.
7. **Git Isolation**: Commits all compiled outputs local to the vault's git repository.

**Options**:
- `-v, --verbose`: Prints assembled LLM prompts (summaries and entity card merges) to standard output before calling the model API.
- `--no-pr`: Disables pushing the sync branch to origin and opening a pull request (PR creation is enabled by default, requiring the GitHub CLI).

```bash
# Sync the current directory vault (creates branch and PR by default)
mm sync

# Sync a specific vault in verbose mode without creating a PR
mm sync ./my-vault -v --no-pr
```

---

### `resync [wiki-path] [options]`

Wipes the compiled entity and summary states and fully re-ingests/re-compiles all source material from archived assets. This is useful when you tweak collection prompts, update schema definitions, or modify overview scripts and want to rebuild the entire wiki from scratch.

**Options**:
- `--collection <name>`: Target a specific collection to rebuild (e.g. `persons`). Keeps existing summaries intact, cleans only the targeted collection's folder, compiles cards for this collection, and applies corresponding overrides.
- Supports the same `-v, --verbose` and `--no-pr` options as `sync`.

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

### `notebook [subcommand] [wiki-path] [options]`

Integrates Mycelium Mind with [Open Notebook](https://github.com/lfnovo/open-notebook), an open-source, self-hosted alternative to Google's NotebookLM.

This provides an optional, interactive frontend for multi-document synthesis, source-cited chat, and AI-generated multi-speaker audio podcasts.

#### Data Flow & Delta Sync
The integration is strictly **one-way (Mycelium Mind $\to$ Open Notebook)**. Mycelium Mind remains the single source of truth in Git. Open Notebook serves as an interactive projection and research workbench.

Pushes are **stateless, idempotent, and incremental**:
- **Idempotency & Zero-Reindexing:** Each card and summary is hashed (SHA-256). Re-running `mm notebook push` compares local hashes against the target notebook. Unchanged documents are automatically skipped with **zero network overhead and zero re-indexing**.
- **Delta Uploads:** Only documents modified or created since the last push are uploaded and processed.
- **Orphan Pruning:** If markdown files were deleted locally, passing `--prune` cleanly deletes the matching sources in Open Notebook.
- **Forced Sync:** Passing `-f, --force` bypasses hash verification to re-upload all matching documents.

#### Subcommands:
- `push [wiki-path]` (default): Incrementally synchronizes compiled entity cards and summaries into Open Notebook.
- `start [wiki-path]` / `up`: Starts Open Notebook Docker containers (and starts Colima automatically if Docker daemon is not active). Automatically configures AI models from `config/config.yml` once ready.
- `stop [wiki-path]` / `down`: Stops Open Notebook Docker containers (and optionally stops Colima with `--colima`).
- `configure [wiki-path]`: Re-synchronizes AI provider credentials and default model assignments from vault configuration without restarting containers.
- `status [wiki-path]`: Displays full environment health (Colima status, Docker daemon, container states, and Open Notebook API).
- `list [wiki-path]`: Lists all notebooks currently in Open Notebook with their IDs and source counts.
- `create <name> [wiki-path]`: Creates a new notebook in Open Notebook.
- `colima <start|stop|status>`: Direct controls for managing the Colima container runtime on macOS.

#### Options:
- `--notebook <name>`: Target Open Notebook by name (defaults to `[MM] <vault-name>`). Automatically created if it doesn't exist.
- `--notebook-id <id>`: Target an explicit Open Notebook ID (e.g. `notebook:01jf8...`).
- `--notebook-url <url>`: Base URL of the Open Notebook backend (default: `http://localhost:5055`).
- `--api-key <key>`: Optional API key if Open Notebook is running with authentication enabled.
- `--filter <all|collections|summaries>`: Choose what content is pushed (default: `all`).
- `--prune`: Delete remote sources in Open Notebook that were deleted or renamed in your vault.
- `--dry-run`: Preview sync operations (added, updated, skipped, pruned) without making any mutations.
- `-f, --force`: Re-upload all matching documents even if hashes are unchanged.
- `--concurrency <num>`: Max concurrent upload requests (default: `1`, recommended to avoid database transaction conflicts).
- `--colima`: Also start or stop the Colima container runtime when running `start` or `stop`.
- `--no-configure`: Skip automatic model configuration upon container start.

#### Running Open Notebook with Colima on macOS

Colima provides a fast, lightweight, and open-source Docker runtime for macOS without the overhead or licensing constraints of Docker Desktop.

```bash
# 1. Install prerequisites via Homebrew
brew install colima docker docker-compose

# 2. Check environment status
mm notebook status

# 3. Start Colima + Open Notebook containers (auto-configures models)
mm notebook start

# 4. Push your vault to Open Notebook
mm notebook push

# 5. Stop Open Notebook (and stop Colima runtime too)
mm notebook stop --colima
```

#### Centralized Model Configuration in `config/config.yml`

You can centralize all AI model settings for both Mycelium Mind (Compiler, Overviews, OCR, STT) and Open Notebook directly in your vault's `config/config.yml` under a unified `models:` block:

```yaml
# Centralized AI Models (Single source of truth for Compiler, Overviews, and Open Notebook)
models:
  base: "agentic"                 # Main LLM for chat, summaries & entity synthesis
  ocr: "ocr"                      # Vision/OCR model for scanned documents, PDFs & images
  image: "agentic"                # Image understanding & multimodal analysis
  embedding: "embeddings"         # Embedding model for vector indexing
  stt: "stt"                      # Speech-to-Text model for audio files (.mp3, .wav, .m4a)
  tts: "tts"                      # Text-to-Speech model for voice & podcast synthesis
  api_url: "http://127.0.0.1:8000/v1" # Local OpenAI-compatible API endpoint

notebook:
  target: "[MM] Sovereign Credit Rating"
  url: "http://localhost:5055"
  concurrency: 1
  # Optional: override model settings specifically for Open Notebook
  # model_api_url: "http://127.0.0.1:8000/v1" # Used verbatim (e.g. for bare-metal or custom network)
  # model_provider: "openai"                  # Overrides models.provider
  # model_api_key: "my-key"                   # Overrides models.api_key / BASE_MODEL_API_KEY
  # models:
  #   chat: "custom-notebook-chat-model"      # Overrides models.base specifically for Open Notebook
```

When running `mm notebook start` or `mm notebook configure`:
- **Default (Inherited Fallback):** If `notebook.model_api_url` (or `notebook.models.api_url`) is omitted, Mycelium Mind automatically inherits your top-level `models.api_url` (or `BASE_MODEL_API_URL`), bridging `127.0.0.1` or `localhost` to `http://host.docker.internal:8000/v1` for the Open Notebook Docker container.
- **Explicit Override (Verbatim):** If you explicitly specify `notebook.model_api_url` or `notebook.models.api_url`, Mycelium Mind uses your URL verbatim without automatic Docker loopback rewriting (ideal for bare-metal setups, remote model servers, or custom container networking).

> [!TIP]
> **Modality Mapping & Automation**:
> - `chat`, `summary`, and `transformation` slots automatically inherit from `models.base`.
> - `embedding` inherits from `models.embedding`.
> - `stt` and `tts` inherit from `models.stt` and `models.tts` (or remain unconfigured if omitted).
> - Specific overrides can be placed directly on `notebook` (`model_api_url`, `model_provider`, `model_api_key`) or under `notebook.models` (`chat`, `summary`, `api_url`, etc.) whenever you want Open Notebook to diverge from Mycelium Mind's defaults.
> - You can re-apply model configuration at any time without container restarts using:
>   ```bash
>   mm notebook configure
>   ```

* **Host Endpoint:** Use `http://host.docker.internal:8000/v1` in Open Notebook (enables containers to communicate with host oMLX).
* **Embeddings:** **`mlx-community/bge-m3-mlx-fp16`** (~1.1 GB). Pick FP16 over 8-bit to avoid cosine distance degradation across dense technical/multilingual texts.
* **Speech-to-Text (STT):** **`mlx-community/whisper-large-v3-turbo`** (~1.6 GB). Pick FP16 over 4-bit (`q4`) to avoid transcription errors on acronyms, numbers, and accents.
* **Text-to-Speech (TTS):** **`mlx-community/Kokoro-82M-bf16`** (~170 MB). Pick bf16 over 4-bit to prevent acoustic slurring and robotic artifacts.
* **Chat & Compiler LLM:** **`mlx-community/Qwen2.5-14B-Instruct-4bit`** (~8.5 GB for 16-24GB Macs) or **`mlx-community/Qwen2.5-32B-Instruct-4bit`** (~19 GB for 32GB+ Macs). Reusable across both Mycelium Mind's compiler (`.env`) and Open Notebook chat.

> [!IMPORTANT]
> **Connecting Open Notebook (Docker) to Local oMLX (Mac Host):**
> * **Basis-URL / Base URL:** In the Open Notebook UI (*Settings > Models & Credentials*), you must specify **`http://host.docker.internal:8000/v1`**. Do **not** use `http://127.0.0.1:8000/v1` or `localhost`, because inside the container `127.0.0.1` refers to the container itself, while `host.docker.internal` bridges back to your host macOS network.
> * **API Key:** If oMLX authentication is enabled, pass your key from `~/.omlx/settings.json` (under `auth.api_key`). If disabled, any dummy string is accepted.

> [!TIP]
> **Provider Selection Tip — Configure oMLX under the "OpenAI" Preset:**
> Open Notebook's dedicated "oMLX" preset may only expose Language and Embedding modalities because Open Notebook does not yet register oMLX's newer TTS (`Kokoro`) and STT (`Whisper`) endpoints.
> To unlock **all 4 modalities** (Language, Embedding, STT, and TTS), configure your local oMLX endpoint under the **OpenAI** provider preset with Base URL `http://host.docker.internal:8000/v1`. This enables assigning models to all 4 capability slots simultaneously.

---

## ⚙️ Wiki Configuration (`config/config.yml`)

Each wiki vault has a configuration file located at `config/config.yml` that governs pipeline execution settings and option variables.

### RAG Settings (knowledge-rag)

See the [`rag` command reference](#rag-wiki-path-options) above for details on configuring RAG settings (`rag.transport`, `rag.host`, `rag.port`, `rag.rate_limiting`, `rag.prometheus`) in `config.yml`.

### Full `config/config.yml` Reference

```yaml
# ==============================================================================
# Mycelium Mind & Open Notebook Configuration
# Single source of truth for all non-sensitive settings (API keys remain in .env)
# ==============================================================================

# Centralized AI Models (Compiler, Overviews, RAG & Open Notebook)
models:
  base: "agentic"                 # Main LLM for chat, summaries & entity synthesis
  ocr: "ocr"                      # Vision/OCR model for scanned documents, PDFs & images
  image: "agentic"                # Image understanding & multimodal analysis
  embedding: "embeddings"         # Embedding model for vector indexing
  stt: "stt"                      # Speech-to-Text model for audio files (.mp3, .wav, .m4a)
  tts: "tts"                      # Text-to-Speech model for voice & podcast synthesis
  api_url: "http://127.0.0.1:8000/v1" # Local OpenAI-compatible API endpoint

# Ingestion pipeline settings (continuous batching on Apple Silicon / local LLM)
ingestion:
  concurrency: 4                  # Concurrency limit for LLM calls
  inbox_chunk_size: 10            # Process inbox in macro-batches of 10 documents
  max_summaries_per_entity: 5     # Max summaries merged into a single entity update prompt

# Settings for generating wiki overviews and charts
overviews:
  script_timeout_ms: 5000

# Local RAG MCP server settings (knowledge-rag)
rag:
  transport: "sse"
  host: "127.0.0.1"
  port: 8179
  rate_limiting:
    enabled: false
    requests_per_minute: 60
    burst: 10
  prometheus:
    enabled: false
    port: 9179

# Open Notebook integration & auto-provisioning settings
notebook:
  target: "[MM] My Knowledge Base"
  url: "http://localhost:5055"
  # model_api_url: "http://127.0.0.1:8000/v1" # Optional: overrides models.api_url verbatim (e.g. bare metal)
  # model_provider: "openai"                  # Optional: overrides models.provider
  # model_api_key: "my-key"                   # Optional: overrides models.api_key / BASE_MODEL_API_KEY
  # models:
  #   chat: "custom-notebook-chat-model"      # Optional: divergent model slots for notebook
  filter:
    collections: true             # Sync entity cards (wiki/collections/)
    summaries: true               # Sync document summaries (wiki/summaries/)
    overviews: true               # Sync overview index pages (wiki/overviews/)
  concurrency: 1                  # Concurrency limit (1 recommended)
```

