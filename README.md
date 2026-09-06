# Mycelium Mind 🧠

Mycelium Mind is a fully offline, schema-driven, multi-vault compiler pipeline and wiki engine built on top of **Obsidian** and **MkDocs**, powered by local LLMs via an OpenAI-compatible API.

It is designed to ingest raw documents, synthesize them into structured metadata-rich cards (conforming to the **Open Knowledge Format (OKF)** standard), dynamically construct interactive relationships between concepts, and compile them into static, publishable documentation sites.

---

## 🎨 Design & Core Principles

1. **Local & Offline First**: Designed to run entirely on your local machine using local LLMs (e.g. via oMLX, llama.cpp, Ollama, or LM Studio) through standard OpenAI-compatible API endpoints.
2. **Strict Schema Validation & Auto-Injection**: Vault entities are governed by markdown-defined schema specifications. Common system metadata such as `timestamp` and `tags` are automatically injected into the schema definitions and processed frontmatter at compile-time to reduce LLM prompt size and guarantee schema consistency.
3. **Isolated LLM Invocations**: To prevent context window overflow, each raw inbox document is processed individually. Entity syntheses are batched and compiled incrementally to scale to large vaults.
4. **Git-Backed Version Control**: The compiler performs local git commits and tags directly inside the directory of each target wiki, ensuring clean revision history local to the vault itself.
5. **Decoupled Architecture**: Each CLI command operates independently. Folder structures are dynamically inspected, allowing you to easily add new schemas, collections, or custom overview scripts.

---

## 🛠️ Quick Start Guide

### 1. Prerequisites & Installation

Clone the repository and install the dependencies:

```bash
# Clone the repository
git clone https://github.com/pkcpkc/mycelium-mind.git
cd mycelium-mind

# Install Node & Python runtimes via mise
mise install

# Install project dependencies (automatically installs Node and Python environment/requirements)
npm install

# Manually trigger Python setup if needed (re-creates .venv and installs requirements.txt)
npm run setup
```

### 2. Configure Your Local Model Endpoint

Create a `.env` file in the root of the repository:

```env
# Base model settings
BASE_MODEL_API_URL="http://localhost:8000/v1"
BASE_MODEL_API_KEY="your-api-key"
BASE_MODEL_NAME="your-local-llm-model-name" # Used for general text synthesis & compilation (defaults to 'agentic')

# Specific model configurations (fall back to BASE configs if not defined)
OCR_MODEL_NAME="ocr"                           # Used for OCR on images & PDFs (defaults to BASE_MODEL_NAME)
# OCR_MODEL_API_URL="http://localhost:8000/v1"
# OCR_MODEL_API_KEY="your-api-key"

IMAGE_MODEL_NAME="agentic"                     # Reserved for image-specific tasks (defaults to BASE_MODEL_NAME)
# IMAGE_MODEL_API_URL="http://localhost:8000/v1"
# IMAGE_MODEL_API_KEY="your-api-key"
```

### 3. Initialize a Wiki Vault

Initialize a new vault structure in your chosen directory:

```bash
# Using global alias 'mm'
mm init ./my-first-wiki
```

> [!NOTE]
> This command populates folder structures, base prompts, default collection schemas (concepts, persons, times), and initializes a local git repository inside the vault folder.

### 4. Sync the Inbox

Drop some raw text files or articles into `./my-first-wiki/inbox/`, then trigger the compiler sync:

```bash
mm sync ./my-first-wiki
```

This runs the main ingestion pipeline:
1. Summarizes inbox documents into `wiki/summaries/`.
2. Archives raw sources into dated directories inside `wiki/assets/`.
3. Batches and synthesizes entity cards inside `wiki/collections/`.
4. Runs sandboxed overview scripts to compile timelines and graphs.
5. Dynamically builds index tables and relationship clouds.
6. Commits the changes local to the vault's git repository.


## 🔌 Semantic Search & AI Integration (MCP / RAG)

Mycelium Mind features a built-in **Model Context Protocol (MCP)** server that exposes your offline wiki as an active semantic vector database. This allows AI assistants in clients like **OpenCode**, **Cursor**, or **Claude Desktop** to search and reference your wiki directly.

To start the RAG server:
```bash
# Start SSE server (default, on port 8179)
mm rag ./my-first-wiki

# Start stdio server (for IDE-spawned integrations)
mm rag ./my-first-wiki --transport stdio
```

### Quick Integration Example: OpenCode

To configure **OpenCode** to automatically spawn and query your local RAG server, add the server configuration to your project's `opencode.json` (or your global `~/.config/opencode/opencode.json`):

```json
{
  "$schema": "https://opencode.ai/config.json",
  "mcp": {
    "mycelium-mind": {
      "type": "local",
      "command": [
        "node",
        "/absolute/path/to/mycelium-mind/build/cli.js",
        "rag",
        "/absolute/path/to/your/wiki",
        "--transport",
        "stdio"
      ],
      "enabled": true
    }
  }
}
```

> [!NOTE]
> Ensure you replace `/absolute/path/to/mycelium-mind/` and `/absolute/path/to/your/wiki` with the actual absolute paths on your machine. OpenCode requires the `command` field to be defined as an array of arguments.

See [**MCP & RAG Search Server Documentation**](docs/mcp.md) for Cursor, Claude Desktop, and other client integration guides.

## 💡 Best Practices

For the most efficient and robust workflow, follow these best practices when managing your wiki vault:

1. **Schema & Plugin Setup**: Setup or copy your plugins from the built-in library (using `mm collection [name]` or `mm overview [name]`) or create your own custom schemas under `plugins/collections/`.
2. **Inbox Ingestion & Sync**: Drop raw documents into the `inbox/` directory and run `mm sync`. By default, this compiles changes on a separate git branch and automatically creates a pull request (use `--no-pr` to disable).
3. **Browsing & Publishing**: Compile your static wiki site using `mm publish` to deploy anywhere (e.g., GitHub Pages), or use **Obsidian** locally to browse your interactive graph and markdown pages.
4. **Manual Edits & Overrides**: If you edit your markdown pages manually or via Obsidian, run `mm overrides` (use `--no-pr` to skip branch/PR creation). This updates the frontmatter and concerned collection entities according to your changes, and preserves them to be correctly replayed during any future `mm resync`.

---

## 📚 Documentation & Guides

For in-depth guides, layout maps, scripting specifications, and references, see the detailed documentation folders:

*   [**CLI Command Reference**](docs/cli.md): In-depth guide to using the `mm` binary, flags, options, and commands.
*   [**Custom Collection Plugins**](docs/plugins.md): How to create custom collection pipelines with schemas, prompts, and evaluated placeholders.
*   [**Custom Overviews & Sandbox Scripting**](docs/overviews.md): Writing custom script plugins inside VM contexts to build reports, directories, and visual charts.
*   [**Pipeline Architecture & Repository Layout**](docs/architecture.md): A guide to the compiler pipeline stages, directory layouts, runtimes, and testing environment.
*   [**MCP & RAG Search Server**](docs/mcp.md): Connecting external AI clients (like Cursor, Claude Desktop, or OpenCode) to query your wiki semantically.

---

## 🚀 Release Process

To publish a new version of `mycelium-mind` to npm:

1. **Log in to npm**:
   ```bash
   npm login
   ```
2. **Publish the package with public access**:
   ```bash
   npm publish --access public
   ```

*(The `prepare` script automatically runs `npm run build` prior to publishing).*

