# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

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
