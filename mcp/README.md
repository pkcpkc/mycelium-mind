# Mycelium Mind MCP Server

The **Mycelium Mind MCP Server** is a Model Context Protocol (MCP) server that acts as a secure, fast, and high-fidelity **Memory Access Layer** on top of your offline Obsidian vaults.

By launching this server, any LLM-powered assistant (Claude Desktop, Cursor, Cline, Roo Code) can programmatically explore, query, and reason over your personal knowledge graph—including concepts, ingested summaries, and compiled thematic reports.

---

## 🚀 Core Concepts

### 1. Zero File System Exposure
To keep your computer's folder layout clean and isolated, the MCP server **does not leak physical file paths** (like `path/to/note.md`) in its JSON responses. It only exposes logical data (e.g. concept titles, bios, event texts, and clean metadata).

### 2. Sanitized Wikilinks
Obsidian's double bracket tags (e.g., `[[Alan Turing]]` or `[[Enigma Machine|rotor cipher]]`) are scrubbed by the server before returning. Outbound and inbound links are delivered as clean plain-text arrays:
```json
"outbound_links": ["Alan Turing", "Enigma Machine"]
```
This enables the calling LLM to match entity nodes immediately and perform clean relational lookups without having to handle regex parsing or formatting issues.

---

## ⚙️ Configuration (CLI Arguments)

The server is highly flexible and configured entirely via command-line arguments passed when launching it in your AI client settings. This eliminates the need for an external config file!

### Available Configuration Arguments:
* **`--vault=<vault_name>`**: Specifies the target vault name.
  * **Implicit Single-Vault Activation**: If this argument is set, the server **implicitly** runs in locked **Single-Vault** mode. In all query tools, the parameter `vault_name` becomes **optional and completely ignored**, automatically binding every command to this specific vault. Additionally, the `get_vaults` discovery tool is completely disabled and hidden from the declared client tools.
  * If this argument is **omitted**, the server defaults to **Multi-Vault** mode. The parameter `vault_name` becomes **mandatory** for all query tools so the LLM specifies which vault to query, and `get_vaults` is active to let the LLM discover available vaults.
* **`--vaults-root=<path>`**: Specifies the path to the vaults root folder (e.g., `--vaults-root=../Vaults`). Resolved relative to the server script location.

---

## 🛠️ Tools Catalog

Once registered, the server exposes the following structured tools:

| Tool | Parameters | Returns (Strict JSON) |
| :--- | :--- | :--- |
| **`get_vaults`** | None | Lists all available vaults. *Only declared and active when `"vaultMode"` is `"all"`; completely hidden in `"single"` mode.* |
| **`get_concepts`** | `vault_name` | Lists all concept nodes. |
| **`get_concept_details`** | `vault_name`, `title` | Full metadata, clean content, and outbound/inbound wikilinks of a concept. |
| **`get_summaries`** | `vault_name` | Lists all document summaries compiled in the vault. |
| **`get_summary`** | `vault_name`, `title` | Content, source asset titles, and clean links for a document summary. |
| **`get_reports`** | `vault_name` | Lists all cross-vault thematic reports. |
| **`get_report`** | `vault_name`, `title` | Detailed synthesis content, theme data, and clean links of a thematic report. |
| **`get_collections`** | `vault_name` | Discovers and lists all custom sub-collections (e.g. persons). |
| **`get_collection_items`** | `vault_name`, `collection` | Lists all item titles in a named sub-collection. |
| **`get_collection_item`** | `vault_name`, `collection`, `title` | Retrieves metadata, content, and links for a custom collection item. |
| **`get_overviews`** | `vault_name` | Discovers and lists all root-level overview pages (excluding index.md). |
| **`get_overview`** | `vault_name`, `title` | Retrieves content and links for a root-level overview page. |

---

## 📂 Auto-Discovery Model (Collections & Overviews)

Instead of hardcoding tools for every directory and root-level file in your wiki, Mycelium Mind automatically discovers custom content:
1. **Collections**: Any subdirectory inside a vault's `wiki/` folder that is not a core directory (`concepts`, `summaries`, `reports`, `assets`, `schemas`) is treated as a generic collection. For example, the `persons/` directory is automatically exposed as a collection named `persons`.
2. **Overviews**: Any standalone markdown file directly in the root of the `wiki/` folder (excluding `index.md`) is treated as an overview page. For example, `timeline.md` and `social-graph.md` are dynamically discovered as overviews.

This architecture enables you to add custom subfolders or root files without needing to register new MCP tools or write additional code. All collections and overviews instantly become queryable by the AI client.

---

## 💻 Setup & Build Instructions

Ensure you have Node.js (v18+) and npm installed.

### 1. Build the Server
Open your terminal in the `mcp/` directory and run:

```bash
# Install dependencies
npm install

# Compile TypeScript to JavaScript
npm run build
```

---

## 🔌 Connecting to AI Clients

### 1. Claude Desktop
Add the server definition to your local Claude Desktop configuration file:
* **macOS**: `~/Library/Application Support/Claude/claude_desktop_config.json`
* **Windows**: `%APPDATA%\Claude\claude_desktop_config.json`

#### Option A: Expose ALL Vaults (Multi-Vault Mode)
```json
{
  "mcpServers": {
    "mycelium-mind": {
      "command": "node",
      "args": [
        "/Users/pkc/Projects/mycelium-mind/mcp/build/index.js"
      ],
      "cwd": "/Users/pkc/Projects/mycelium-mind/mcp"
    }
  }
}
```

#### Option B: Expose and Lock ONE Vault Only (Single-Vault Mode)
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
    }
  }
}
```

*Note: Replace `/Users/pkc/Projects/mycelium-mind` with the exact absolute path to your repository.*

### 2. Cursor, Cline, or Roo Code
1. Open your editor settings and navigate to **MCP / Model Context Protocol**.
2. Add a new **Stdio** server.
3. Configure it with:
   * **Name**: `mycelium-mind`
   * **Command**: `node`
   * **Arguments**: `/Users/pkc/Projects/mycelium-mind/mcp/build/index.js --vault=LLM-Wiki`
