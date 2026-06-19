# Mycelium Mind

Mycelium Mind is a fully offline, multi-vault wiki engine built on top of Obsidian, powered by local LLMs running on oMLX.

Inspired by [karpathy's llm-wiki](https://gist.github.com/karpathy/442a6bf555914893e9891c11519de94f) and orchestrated via [OpenCode](https://opencode.ai/).

---

## 🚀 Quick Start (Offline Ingestion)

Follow this sequence to ingest your files into a clean Obsidian wiki vault:

### 1. Prerequisites
Install **Obsidian**, and fetch the CLI tools:
```bash
brew bundle install
gh auth login
```

### 2. Configure Local Models (oMLX)
Start your local oMLX server hosting the following models:
* **Text:** `Qwen3.6-35B`
* **Vision:** `Gemma-4-31B-IT` (image analysis)
* **OCR:** `DeepSeek-OCR-2-bf16` (PDF extraction)

Create a `.env` in the repository root:
```env
API_URL="http://localhost:8000/v1/chat/completions"
API_KEY="your-api-key"
OCR_MODEL_NAME="DeepSeek-OCR-2-bf16"
IMAGE_MODEL_NAME="gemma-4-31b-it-4bit"
```

Configure OpenCode's main text model in `.opencode/models.yaml`:
```yaml
default:
  api_url: "http://localhost:8000/v1"
  api_key: "your-api-key"
  model: "Qwen3.6-35B-A3B-UD-MLX-4bit"
```

### 3. Drop & Process Files
1. Create your vault folder structure:
   ```bash
   mkdir -p Vaults/LLM-Wiki/inbox Vaults/LLM-Wiki/wiki
   ```
2. Place raw PDFs, images, text, or markdown files into `Vaults/LLM-Wiki/inbox/`.
3. In your OpenCode terminal, run the orchestrator:
   ```bash
   /wiki LLM-Wiki
   ```
4. Open the compiled `Vaults/LLM-Wiki/wiki/` folder in **Obsidian** to view your synced wiki!

---

## 🛠️ Complete Pipeline & Hook Flowchart

Mycelium Mind uses a modular, hook-driven architecture. The `/wiki <VaultName>` command chain is fully visualized below, showing the new **context-isolated ingestion loop** designed to keep local inference memory and token overhead minimal.

```mermaid
flowchart TD
    user["User runs /wiki &lt;VaultName&gt;"] --> checkout["Git branch created: wiki/&lt;VaultName&gt;-sync-..."]
    checkout --> lint["/wiki-lint (checks & repairs wikilinks)"]
    lint --> pre["Pre-processing:
    - sanitize-filenames.sh
    - ensure-folders.sh
    - image-to-text.sh (Gemma Vision)
    - ocr-pdf.sh (DeepSeek OCR)"]
    pre --> loop{"Text files in inbox?"}
    
    subgraph isolated_session["Isolated Ingestion Session (per file)"]
        spawn["opencode run --command 'wiki-sync' &lt;VaultName&gt; &lt;FileName&gt;"]
        spawn --> ai["AI Processing:
        - Read single file
        - Write concepts/summaries/persons
        - Citation & conflict check"]
        ai --> archive["Post-processing:
        - Move file to assets/
        - git commit changes"]
    end
    
    loop -- "Yes (For each file)" --> spawn
    archive --> loop
    loop -- "No (Finished)" --> timeline["/wiki-timeline (compiles timeline.md)"]
    timeline --> social["/wiki-social-graph (compiles social-graph.md)"]
    social --> done["Pipeline Finished!"]
```

---

## 📂 Vault Schema & Directory Map

Inside your compiled `Vaults/<VaultName>/wiki/` vault, Mycelium Mind maintains a strict schema:

* `index.md` — The Map of Content (entry directory).
* `timeline.md` — Global sorted timeline of events.
* `social-graph.md` — Mermaid relationship chart of all persons.
* `concepts/` — Topic and concept notes.
* `persons/` — Biographies and affiliations.
* `summaries/` — Synthesis cards for raw documents.
* `reports/` — Cross-vault thematic syntheses (compiled via `/wiki-report`).
* `assets/` — Archive of raw documents sorted by date of ingestion (`assets/YYYY-MM-DD/`).

---

## 🧩 Commands Reference

All subcommands run independently in OpenCode:

| Command | Target Output | Description |
| :--- | :--- | :--- |
| `/wiki <Vault>` | Whole vault | Runs the entire pipeline sequentially (Branching, Linting, Syncing, Timeline, Social-Graph). |
| `/wiki-sync <Vault> [File]` | `summaries/`, `concepts/`, `persons/` | OCR/Vision extracts document content, and the LLM synthesizes entries. Passing `[File]` syncs only that single file. |
| `/wiki-diff <Vault>` | Selective updates | Checks unstaged Git changes in the vault, processing only recent manual modifications. |
| `/wiki-lint <Vault>` | Interactive audit | Checks for broken wikilinks, orphaned pages, or stubs. |
| `/wiki-timeline <Vault>` | `timeline.md` | Extracts dates and compiles them chronologically. |
| `/wiki-social-graph <Vault>`| `social-graph.md` | Scrapes entity relationships and builds the Mermaid chart. |
| `/wiki-report <Vaults> <Q>` | `reports/` | Synthesizes a thematic study across multiple vaults. |

---

## 🔌 Model Context Protocol (MCP) Integration

Mycelium Mind exposes your vaults programmatically to other LLM interfaces (Claude Desktop, Cursor, Cline, Roo Code) via MCP. 

Register the server by adding this to your MCP configuration (`mcp_config.json`):

```json
{
  "mcpServers": {
    "mycelium-mind": {
      "command": "node",
      "args": [
        "/Users/pkc/Projects/mycelium-mind/mcp/build/index.js",
        "--vault=LLM-Wiki"
      ],
      "cwd": "/Users/pkc/Projects/mycelium-mind/mcp"
```

*Note: Omit `--vault=<name>` to run in **Multi-Vault Mode**, which activates vault discovery (`get_vaults`) and exposes all vaults under `Vaults/`.*
For detailed configuration and API tool schemas, see the [MCP README](file:///Users/pkc/Projects/mycelium-mind/mcp/README.md).
