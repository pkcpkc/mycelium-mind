# Developer Agent Guide — Mycelium Mind

Welcome! This guide outlines the development environment, tooling, and model context integrations designed to optimize your workflow when developing and maintaining **Mycelium Mind**.

---

## Environment & Runtime Parity with `mise`

This repository uses `mise` to ensure reproducible runtime environments (Python and Node.js) across development machines and agents.

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

## Antigravity IDE Integration (MCP Servers)

Use `headroom` and `tokensave` MCP servers to save tokens.

---

## Best Practices for Developer Agents

When performing edits or running tests on **Mycelium Mind**:

1.  **Use the correct binaries & runtime manager:** Do not invoke global python or node runtimes if they diverge from `.mise.toml`. Prefix command executions with `mise exec --` or run files directly from `.venv/bin/`.
2.  **Rely on TokenSave:** Use `tokensave` queries to explore file structures and symbol definitions before resorting to reading large directories or files.

---

## Release Process

To publish a new release of `mycelium-mind` to npm:

1. **Authenticate with npm**:
   ```bash
   npm login
   ```
2. **Publish the package**:
   ```bash
   npm publish --access public
   ```

> [!NOTE]
> The `prepare` script in `package.json` automatically runs `npm run build` before publishing.

