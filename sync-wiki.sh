#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
exec npx tsx "$SCRIPT_DIR/scripts/sync.ts" $1
