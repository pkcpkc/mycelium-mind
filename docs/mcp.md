# Model Context Protocol (MCP) & RAG Integration

Mycelium Mind includes native support for the **Model Context Protocol (MCP)** via a built-in RAG (Retrieval-Augmented Generation) server command. This integration allows any MCP-compatible AI client (such as Claude Desktop, Cursor, or IDE plugins) to interactively query, search, and retrieve structured knowledge directly from your compiled offline wiki.

---

## 🧠 The "MCP Magic"

When you compile raw source documents into Mycelium Mind, it structures them into rich markdown summaries, timelines, and entity collections. By starting the built-in MCP server, you turn this local repository of compiled notes into an **active semantic search engine** that your AI assistants can leverage to answer questions with precise context.

The underlying integration is powered by `knowledge-rag` (a semantic vector search index). The Mycelium Mind compiler orchestrates setting up the database, generating configuration files, and managing the server lifecycle.

---

## 🛠️ Exposing Your Wiki via `mm rag`

The `mm rag` command reads your vault's `config/config.yml`, dynamically configures a vector database folder (`.rag/`), and spawns the RAG server process.

### CLI Usage

```bash
# Start the RAG server (defaults to SSE transport on port 8179)
mm rag ./my-wiki

# Start with Stdio transport (useful for direct tool-based IDE configuration)
mm rag ./my-wiki --transport stdio

# Customize host, port, and enable rate limiting
mm rag ./my-wiki --port 9000 --rate-limit 120
```

### Options

*   `--transport <stdio|sse>`: Transport protocol (default: `sse`).
*   `--host <ip>`: Bind address for SSE transport (default: `127.0.0.1`).
*   `--port <number>`: Port for SSE transport (default: `8179`).
*   `--rate-limit <rpm>`: Maximum requests per minute.
*   `--prometheus-port <port>`: Port to expose Prometheus metrics (default: `9179`).
*   `--chromadb-wal`: Enable write-ahead logging (WAL) mode in ChromaDB to prevent file locking issues during concurrent reads/writes.

---

## ⚙️ Configuration (`config.yml`)

You can define permanent settings for the RAG server in the `config/config.yml` of your vault under the `rag` block:

```yaml
rag:
  transport: sse         # stdio | sse
  host: 127.0.0.1
  port: 8179
  chromadb_wal: false     # Set true if you see database write locks
  rate_limiting:
    enabled: true
    requests_per_minute: 60
    burst: 10
  prometheus:
    enabled: false
    port: 9179
```

---

## 🔌 Connecting to AI Clients

### 1. Claude Desktop (Stdio mode)

Configure your `claude_desktop_config.json` (typically located in `~/Library/Application Support/Claude/claude_desktop_config.json` on macOS) to run the `mm rag` command directly in stdio mode:

```json
{
  "mcpServers": {
    "mycelium-mind": {
      "command": "node",
      "args": [
        "/path/to/mycelium-mind/build/cli.js",
        "rag",
        "/absolute/path/to/your/wiki",
        "--transport",
        "stdio"
      ]
    }
  }
}
```

> [!NOTE]
> Ensure you replace `/path/to/mycelium-mind/` and `/absolute/path/to/your/wiki` with your actual absolute directories.

### 2. Cursor (SSE or Stdio mode)

To connect Cursor to your wiki:

1.  **SSE Mode**:
    *   Start the server in your terminal: `mm rag ./my-wiki`
    *   Open Cursor Settings -> **Features** -> **MCP**.
    *   Click **+ Add New MCP Server**.
    *   Set **Name**: `mycelium-mind`
    *   Set **Type**: `SSE`
    *   Set **URL**: `http://127.0.0.1:8179/sse`
2.  **Stdio Mode**:
    *   Open Cursor Settings -> **Features** -> **MCP**.
    *   Click **+ Add New MCP Server**.
    *   Set **Name**: `mycelium-mind`
    *   Set **Type**: `command`
    *   Set **Command**: `node /path/to/mycelium-mind/build/cli.js rag /absolute/path/to/your/wiki --transport stdio`
