# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added
- **`mm watch`**: Watch mode that keeps a vault processed continuously. Inbox drops are batched into `sync` runs, manual `wiki/` edits are debounced and re-created via `overrides`, and results are pushed incrementally to Open Notebook when it is reachable. A startup sweep catches up on offline edits and pending inbox files. Loop prevention is git-based: engine writes are committed to the current branch, and files whose re-creation fails are only retried after a new edit.
- `syncWiki` / `overridesWiki` accept a `commit` option to commit on the current branch without creating a PR.

### Fixed
- **`overrides` ignored files with non-ASCII names**: git quotes such paths in `--name-only` output (e.g. `"Gr\303\266\303\237e.md"`), so edits to notes like `Größe.md` were silently skipped. Paths are now read NUL-delimited.
- **`overrides` shell injection**: filenames were interpolated into shell commands (`git show HEAD:"<file>"`); LLM-derived entity names may contain `$(...)` or backticks. All git calls now run without a shell.
- **`overrides` could discard newer edits**: a file edited again while its LLM re-creation was in flight was overwritten. Such files are now skipped and picked up on the next run.
- **`overrides` recorded failed attempts**: `overrides.json` snapshots were written (and replayed by `resync`) even when re-creation failed. Only applied overrides are recorded now.
- **`sync` committed unrelated manual edits**: the final commit staged all of `wiki/`, sweeping in edits made while sync ran. It now commits only files sync wrote, plus `wiki/assets/`.
- **`check-plugins` accepted placeholders in prompt frontmatter**: placeholder checks scanned the whole `prompt.md`, but the compiler only substitutes them in the body (frontmatter is stripped). A `$VALUE` mentioned only in frontmatter passed validation while never reaching the LLM; checks now run against the body.
- **`tsx` crash in `notebook` commands**: type-only re-exports in `commands/notebook.ts` broke `npm run cli -- notebook …`; `isolatedModules` is now enabled to catch this at compile time.

### Changed
- **CLI: Migrated to Commander.js**: Replaced the hand-rolled argument parser and switch-based dispatcher with [Commander.js](https://github.com/tj/commander.js/). This brings standard CLI conventions including `--help` / `-h` on every command and subcommand, `--version` / `-V`, proper option parsing with type coercion, and scoped options per command. The `notebook` command now uses first-class Commander subcommands (`mm notebook push`, `mm notebook start`, etc.) instead of manual positional argument routing. No behavioral changes — all existing flags and arguments work identically.

## [0.4.0] - 2026-09-06

### Breaking Changes
- **Strict OpenAI Base URL Requirement**: Model endpoint environment variables (`BASE_MODEL_API_URL`, `OCR_MODEL_API_URL`, `IMAGE_MODEL_API_URL`) now strictly require the standard OpenAI Base URL format (e.g. `http://localhost:8000/v1` or `https://api.openai.com/v1`).
- **Removal of Legacy URL Slicing & Workarounds**: Removed implicit string slicing for `/chat/completions`. Providing a URL ending in `/chat/completions` now throws a fail-fast configuration error with guidance on using the base URL.
- If you previously set `OCR_MODEL_API_URL="http://localhost:8000/v1/chat/completions"`, update it to `http://localhost:8000/v1` or remove it to inherit `BASE_MODEL_API_URL`.

### Changed
- **Unified Model Clients**: Routed OCR image extraction in `ocrImage` through the official OpenAI SDK via `callOcrModel` in `src/utils/openai-api.ts`.
- Multi-client connection pooling: OpenAI SDK instances are cached per endpoint/API key pair.
- Local endpoint credential handling: Automatically supplies safe fallback credentials for unauthenticated local endpoints (oMLX, Ollama, vLLM).

### Fixed
- Fixed 404 HTTP errors on PDF and image OCR when inheriting `BASE_MODEL_API_URL` (closes [#2](https://github.com/pkcpkc/mycelium-mind/issues/2)). Thanks to [@adhorn](https://github.com/adhorn) for the diagnosis and reproduction!

## [0.3.0] - 2026-08-21
- Asset extraction pipeline with OCR, link rewriting, and concurrent processing utilities.

## [0.2.6] - 2026-08-10
- Transition to OKF v0.2 metadata schema with generated, status, and sources fields.
