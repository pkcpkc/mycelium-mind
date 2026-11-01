# Event Hooks (Webhooks & Scripts) 🪝

This document covers how to register URLs and local scripts that receive a JSON event whenever the wiki changes. It explains configuration, delivery, the event envelope, and the fields of every event.

---

## 💡 Overview

Hooks let you plug your own automation into the pipeline: chat notifications, CI triggers, search re-indexing, backups, or any post-processing.

- **Two kinds of endpoint:** a **URL** receives an HTTP `POST`, and a **script** receives the event on stdin.
- **Notify-only:** hooks observe and never steer. A failing or slow hook is logged, and it never aborts, delays or changes a run.
- **Selective:** each endpoint subscribes to the events it cares about with glob patterns.
- **Every command:** events come from `sync`, `resync`, `overrides`, `overviews`, `publish`, `notebook push`, `contradictions` and `watch`.

---

## ⚙️ Configuration

Hooks live under `hooks:` in your vault's `config/config.yml`. `mm init` ships a commented example.

```yaml
hooks:
  enabled: true              # master switch (default: true when the block exists)
  timeout_ms: 10000          # per delivery attempt (default: 10000)
  retries: 3                 # URL hooks only (default: 3)
  retry_backoff_ms: 1000     # first retry delay, doubled per attempt (default: 1000)
  endpoints:
    - name: notify
      url: "https://hooks.example.com/mycelium"
      events: ["run.*", "git.pr.created", "contradictions.found"]
      secret_env: MM_HOOK_SECRET
      headers:
        Authorization: "Bearer ${env:MM_HOOK_TOKEN}"
    - name: reindex
      script: "./scripts/on-wiki-change.sh"
      args: ["--quiet"]
      events: ["summary.*", "entity.*", "page.deleted"]
```

| Endpoint key | Description |
|---|---|
| `name` | Identifier used in logs and by `mm hooks test --name`. Defaults to `hook-<n>`. |
| `url` | HTTP(S) endpoint that receives a `POST`. Use exactly one of `url` or `script`. |
| `script` | Executable to run. A relative path resolves against the vault root. |
| `args` | Extra arguments passed to the script. |
| `events` | Subscription globs. Defaults to `["*"]`. |
| `headers` | Extra HTTP headers (URL hooks). |
| `secret_env` | Name of an env var that holds the signing secret (URL hooks). |

**Event globs:** `*` matches any run of characters.

| Pattern | Matches |
|---|---|
| `*` | every event |
| `entity.*` | `entity.created`, `entity.updated`, `entity.failed` |
| `*.created` | `summary.created`, `entity.created`, `git.pr.created`, … |
| `git.pr.created` | only that event |

**Secrets** never belong in YAML. `${env:NAME}` in `url`, `headers` and `args` is replaced with the env var's value. Env vars can come from the shell or from the `.env` file that Mycelium Mind already loads.

**Disabling hooks:**
- Set `enabled: false` in the config.
- Set `MM_HOOKS=off` in the environment.
- Pass the global flag to a single command, for example `mm --no-hooks sync`.

An endpoint that is invalid (for example, one with both `url` and `script`) is reported with a warning and skipped. The rest still work.

---

## 📬 Delivery

### URL hooks

Each event is sent as `POST <url>` with a JSON body and these headers:

| Header | Value |
|---|---|
| `Content-Type` | `application/json` |
| `User-Agent` | `mycelium-mind/<version>` |
| `X-MM-Event` | event type, e.g. `entity.updated` |
| `X-MM-Delivery` | unique event id (`evt_…`), useful for deduplication |
| `X-MM-Signature` | `sha256=<hex HMAC-SHA256 of the raw body>`, sent only when `secret_env` is set |

- A `2xx` response means success.
- `5xx`, `429`, timeouts and network errors are retried up to `retries` times. The delays are `retry_backoff_ms`, ×2, ×4, …
- Any other `4xx` fails at once without a retry.

### Script hooks

- The script runs **without a shell**, with the vault root as working directory. It must be executable (`chmod +x`) and start with a shebang line.
- The full event JSON is written to **stdin**.
- These environment variables are set:

| Variable | Value |
|---|---|
| `MM_EVENT` | event type |
| `MM_EVENT_ID` | event id |
| `MM_RUN_ID` | id of the run the event belongs to (empty outside a run) |
| `MM_COMMAND` | command of that run, e.g. `sync` |
| `MM_VAULT_ROOT` | absolute vault path |

- Exit code `0` means success. A non-zero exit is logged together with the script's stderr. stdout is discarded.
- After `timeout_ms` the script is killed **together with any child processes it started**.
- Scripts are not retried.

### Ordering & lifecycle

- Each endpoint has its own queue, so it receives events **in the order they were emitted**. Different endpoints are served in parallel.
- Emitting an event never blocks the pipeline.
- Before the CLI exits, it waits for queued deliveries, including after a failed command, so `run.failed` is delivered too. `mm watch` waits for deliveries on shutdown.
- Failures are logged as `[hooks] <name> <event> failed: <reason>`.

> [!WARNING]
> While `mm watch` is running, a script hook that writes into `wiki/` counts as a manual edit and triggers `overrides`. Write outside `wiki/`, or commit your changes, to avoid loops.

> [!NOTE]
> The hook config is read once per process. Restart `mm watch` after you edit the `hooks:` block.

---

## ✉️ Event Envelope

Every event has the same envelope. Event-specific fields live in `data`.

```json
{
  "id": "evt_4b0c…",
  "type": "entity.updated",
  "schema_version": 1,
  "timestamp": "2026-10-17T12:34:56Z",
  "vault": { "root": "/Users/me/vaults/research", "name": "research" },
  "run": {
    "id": "run_91af…",
    "command": "sync",
    "trigger": "cli",
    "parent_run_id": null,
    "branch": "sync-20261017-123456",
    "options": { "pr": true, "commit": false, "verbose": false },
    "mm_version": "0.5.2",
    "models": { "base": "agentic", "api_url": "http://127.0.0.1:8000/v1" }
  },
  "data": {
    "collection": "persons",
    "name": "Ada Lovelace",
    "path": "wiki/collections/persons/Ada Lovelace.md"
  }
}
```

| Field | Description |
|---|---|
| `id` | Unique event id; same as `X-MM-Delivery`. |
| `type` | Event type (see the catalog below). |
| `schema_version` | Envelope version, currently `1`. It is bumped on breaking payload changes. |
| `timestamp` | UTC, second precision. |
| `vault` | Absolute root and folder name of the vault. `null` only for events outside any vault. |
| `run` | The run this event belongs to, or `null`. |
| `run.command` | `sync`, `resync`, `overrides`, `overviews`, `publish`, `notebook.push`, `contradictions` or `watch`. |
| `run.trigger` | `cli`, or `watch` when `mm watch` started the run. |
| `run.parent_run_id` | For watch-triggered runs, the id of the watch session. |
| `run.branch` | Git branch the run created (PR mode), once known. |
| `data` | Event-specific payload. |

**Paths** in `data` are relative to the vault and use `/` separators, for example `wiki/summaries/Andrej Karpathy.md`.

**Runs:**
- Each top-level command is one run.
- A command that runs inside another shares the outer run instead of starting its own. Examples are the overviews step inside `sync`, or `publish` started by `mm overviews <wiki> <target-html>`.
- Every run started by `mm watch` is its own child run of the watch session.

---

## 📚 Event Catalog

### Run lifecycle

Every command starts with `run.started` and ends with exactly one of `run.completed`, `run.failed` or `run.skipped`. `mm watch` is the exception: it reports `watch.started` / `watch.stopped` instead.

| Event | `data` fields |
|---|---|
| `run.started` | `command`, `options`, `inbox_files[]` (sync only) |
| `run.completed` | `duration_ms`, `changes`, `commits[]` (`{sha, message}`), `branch`, `pr_url`, plus command results (see below) |
| `run.failed` | `duration_ms`, `error` (`{message, stage, code, status}`), `rolled_back`, `partial` (results, changes and commits up to the failure) |
| `run.skipped` | `reason`, `duration_ms` |

- `changes` is `{created[], updated[], deleted[]}`: every page the run touched. A page created and then updated in the same run appears only in `created`.
- Command results:
  - `sync` / `resync` add `stats`: `summariesSuccess`, `summariesFailed`, `entitiesSuccess` / `entitiesFailed` per collection.
  - `overrides` adds `applied` and `skipped` counts.
- `error.stage` is one of `preflight`, `summaries`, `entities`, `overrides`, `overviews`, `publish`, `notebook`, `git`.
- `rolled_back` is `true` when the PR branch was discarded.
- `reason` (`run.skipped`) is one of `inbox_empty`, `inbox_missing`, `no_assets`, `no_modified_files`, `git_unavailable`.

### Ingestion (`sync`, `resync`)

| Event | `data` fields |
|---|---|
| `asset.archived` | `inbox_file`, `extension`, `size_bytes`, `sha256`, `extractor`, `companion_file`, `archived[]` (copies under `wiki/assets/<date>/`) |
| `summary.created` / `summary.updated` | `path`, `title`, `status`, `tags[]`, `sources[]`, `assets[]`, `generated` (`{by, at}`), `entities`, `frontmatter_repaired`, `duration_ms` |
| `summary.failed` | `inbox_file` (sync) or `asset` (resync), `error` |
| `entity.created` / `entity.updated` | `collection`, `name`, `path`, `title`, `type`, `tags[]`, `status`, `source_summaries[]`, `sources_count`, `llm_batches`, `duration_ms` |
| `entity.failed` | `collection`, `name`, `error` |
| `inbox.consumed` | `files[]`: inbox files removed after their chunk compiled |

- `extractor` is one of `text`, `ocr`, `pdf-ocr`, `stt`, `placeholder`. `asset.archived` is only emitted by `sync`; resync reuses archived assets.
- `entities` maps each collection to the entity names the summary references, e.g. `{"persons": ["Ada Lovelace"]}`.
- `frontmatter_repaired` is `true` when the LLM had to fix malformed YAML.
- `*.created` means the page did not exist when the run started, and `*.updated` means it did. This is why pages regenerated by `resync` are reported as `updated`.

### Manual edits (`overrides`, replay during `resync`)

| Event | `data` fields |
|---|---|
| `override.detected` | `files[]`: modified wiki pages found by `git diff HEAD` |
| `override.applied` | `path`, `additions`, `deletions`, `frontmatter_changed`, `affected_entities[]` (`{collection, name, path}`), `snapshot`, `replay` |
| `override.skipped` | `path`, `reason`, `replay` (resync only) |

- `snapshot` is the `overrides.json` that records the diff.
- `replay` is `true` when resync re-applies a stored override.
- `affected_entities` lists the entity cards recompiled because the frontmatter changed.
- `reason` (`override.skipped`) is `empty_diff`, `llm_failed` or `changed_during_recreate`. The last one means the file was edited again while the LLM was working, and it is retried on the next run.

### Resync cleanup

| Event | `data` fields |
|---|---|
| `wiki.cleared` | `scope` (`all` \| `collection`), `collection`, `dirs[]`, `removed_count` |
| `page.deleted` | `path`, `kind` (`summary` \| `entity` \| `overview`) |

`page.deleted` is emitted only for pages that existed before the wipe and were **not** regenerated, meaning they are really gone.

### Overviews & indexes

| Event | `data` fields |
|---|---|
| `overview.generated` | `name`, `path`, `script`, `created`, `frontmatter` (`{type, title, tags}`) |
| `overview.failed` | `script`, `path`, `error` |
| `indexes.rebuilt` | `indexes[]` (`{name, ok, duration_ms, error?}`) |

### Git

These are emitted only when commits are enabled: PR mode, or the commit-on-current-branch mode used by `mm watch`.

| Event | `data` fields |
|---|---|
| `git.committed` | `sha`, `message`, `files[]`, `branch` |
| `git.branch.created` | `branch`, `base_branch` |
| `git.pr.created` | `branch`, `url`, `title` |
| `git.pr.failed` | `branch`, `stage` (`push` \| `gh`), `error` |
| `git.rolled_back` | `restored_branch`, `branch_deleted` |

### Publishing & integrations

| Event | `data` fields |
|---|---|
| `site.published` | `site_dir`, `page_count`, `duration_ms` |
| `notebook.pushed` | `notebook` (`{id, name, url}`), `added[]`, `updated[]`, `pruned[]`, `orphaned_count`, `unchanged_count`, `dry_run`, `filter` |
| `contradictions.found` | `count`, `documents[]` (`{path, excerpt}`, excerpt capped at 1000 chars) |

For `notebook.pushed`, `pruned` is filled only with `--prune`. With `--dry-run`, the lists describe what *would* change.

### Watch mode

| Event | `data` fields |
|---|---|
| `watch.started` | `debounce_ms`, `git_available`, `notebook_sync`, `notebook_url`, `notebook_active` |
| `watch.inbox.detected` | `file`, `size_bytes` |
| `watch.edit.detected` | `path` |
| `notebook.status.changed` | `url`, `status` (`active` \| `unreachable`): only when the status changes |
| `watch.stopped` | `uptime_ms`, `runs_count` |

These events always belong to the watch session's run, even when they fire while a child run is in progress.

### Diagnostics

| Event | `data` fields |
|---|---|
| `hook.test` | `message`, `sample`: sent only by `mm hooks test` |

---

## 🧪 Inspecting & Testing Hooks

```bash
# Show configured endpoints, their subscriptions and whether signing secrets are set
mm hooks list [wiki-path]

# Send hook.test to every endpoint (exit code 1 if any delivery fails)
mm hooks test [wiki-path]

# Test one endpoint with a sample payload of a specific type
mm hooks test [wiki-path] --name notify --event run.completed
```

`mm hooks test` delivers even when hooks are disabled, so you can check an endpoint before you enable it.

---

## 🧩 Recipes

### Verify the signature (Node.js)

Compute the HMAC over the **raw** request body, not over re-serialized JSON:

```js
import crypto from 'node:crypto';

function isValid(rawBody, signatureHeader, secret) {
  const expected = 'sha256=' + crypto.createHmac('sha256', secret).update(rawBody).digest('hex');
  const a = Buffer.from(expected);
  const b = Buffer.from(signatureHeader || '');
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}
```

### Log every changed page (script)

```sh
#!/bin/sh
# scripts/on-wiki-change.sh
jq -r '"\(.timestamp) \(.type) \(.data.path // "")"' >> "$MM_VAULT_ROOT/.hooks.log"
```

### Desktop notification when a run ends (macOS)

```yaml
- name: notify-mac
  script: "./scripts/notify.sh"
  events: ["run.completed", "run.failed"]
```

```sh
#!/bin/sh
# scripts/notify.sh
summary=$(jq -r 'if .type == "run.failed"
  then "❌ \(.run.command) failed: \(.data.error.message)"
  else "✅ \(.run.command): \(.data.changes.created | length) created, \(.data.changes.updated | length) updated"
  end')
osascript -e "display notification \"$summary\" with title \"Mycelium Mind\""
```

### Post new PRs to a chat webhook

Point a URL hook at a small relay (or a service that accepts arbitrary JSON) and subscribe to `git.pr.created`. `data.url` holds the PR link and `run.command` tells you whether it came from `sync`, `resync` or `overrides`.

```yaml
- name: chat
  url: "https://relay.example.com/mm-to-chat"
  events: ["git.pr.created", "contradictions.found"]
  secret_env: MM_HOOK_SECRET
```
