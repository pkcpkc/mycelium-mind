# Developer Agent Guide — Mycelium Mind

Welcome! This guide outlines the development environment, tooling, and model context integrations designed to optimize your workflow when developing and maintaining **Mycelium Mind**.

---

## 1. Environment & Runtime Parity with `mise`

This repository uses `mise` to ensure reproducible runtime environments (Python and Node.js) across development machines and agents.

### Tool Configuration (`.mise.toml`)
The project contains a `.mise.toml` file at the root pinning the following tools and versions:

*   **Python:** `3.11.15` (runs the core python scripts, local environment tooling, and `headroom`)
*   **Node.js:** `25.9.0` (runs the local MCP server logic under `mcp/` and associated workspace tasks)

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

Verify that the active tools match the defined configuration:
```bash
mise current
# Expected output:
# python 3.11.15
# node 25.9.0
```

### Python Virtual Environment (`.venv`)
The local Python virtual environment is located at `./.venv/` in the project root.
- It is created using Python `3.11.15`.
- All Python packages, including `headroom-ai`, are installed in this environment.
- Always execute Python-based commands using `./.venv/bin/python` or `./.venv/bin/<executable>`.

---

## 2. Antigravity IDE Integration (MCP Servers)

To keep context windows clean and save token usage, the **Antigravity IDE** integrates two crucial context optimization MCP servers: `headroom` and `tokensave`.

These servers are registered locally in Antigravity's configuration files:
*   Active Session: `file:///Users/pkc/.gemini/antigravity-ide/mcp_config.json`
*   Global Configuration: `file:///Users/pkc/.gemini/antigravity/mcp_config.json`

### Registered MCP Servers

```json
{
    "mcpServers": {
        "headroom": {
            "command": "/Users/pkc/Projects/mycelium-mind/.venv/bin/headroom",
            "args": [
                "mcp",
                "serve"
            ]
        },
        "tokensave": {
            "command": "/opt/homebrew/bin/tokensave",
            "args": [
                "serve"
            ]
        }
    }
}
```

### Automatic Detection & Tool Availability
Because these servers are registered as MCP servers, **Antigravity automatically auto-detects and loads them** when initiating the session. You do not need to run or start them manually. Their associated tools are immediately available:

*   **Headroom Context Optimization (`headroom`)**: Exposes context compression and retrieval tools (e.g., `headroom_retrieve`). It routes completion outputs through a proxy layer to summarize large text payloads, replacing them with retrieval markers to prevent context window overflow.
*   **TokenSave Code Graph Indexer (`tokensave`)**: Exposes a semantic graph index of the codebase (e.g., `tokensave_search`, `tokensave_context`). Instead of doing expensive file reads and searches over the entire tree, agents can query the local TokenSave graph via MCP, drastically cutting context costs.

---

## 3. Best Practices for Developer Agents

When performing edits or running tests on **Mycelium Mind**:
1.  **Use the correct binaries & runtime manager:** Do not invoke global python or node runtimes if they diverge from `.mise.toml`. Prefix command executions with `mise exec --` or run files directly from `.venv/bin/`.
2.  **Rely on TokenSave:** Use `tokensave` queries to explore file structures and symbol definitions before resorting to reading large directories or files.
3.  **Keep it Offline-Friendly:** Keep in mind that Mycelium Mind is designed to be a fully offline vault engine. All scripts in `.opencode/` should run successfully without external network dependencies.
