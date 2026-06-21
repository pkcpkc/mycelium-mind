---
description: Pre-process inbox files (OCR, vision, filename sanitation). No LLM invocation. Usage: /wiki-sync <VaultName>
---

# Wiki Sync Command

## Current Vault Context

Vault Name: $1

## Status

All files in the inbox of Vault `$1` have been pre-processed by the hook scripts.
Binary files (PDFs, images) have been converted to text.
Filenames have been sanitized.

Simply confirm to the user that the pre-processing step has successfully completed.
