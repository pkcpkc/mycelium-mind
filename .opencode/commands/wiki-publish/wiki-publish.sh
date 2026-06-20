#!/bin/bash
# Exit on any error
set -e

VAULT_NAME="$1"
TARGET_DIR="$2"
if [ -z "$VAULT_NAME" ]; then
    echo "Error: Vault name parameter is required. Usage: wiki-publish.sh <VaultName> [TargetDir]" >&2
    exit 1
fi

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/../../../" && pwd)"

# Run python preprocessing and compilation
"$PROJECT_ROOT/.venv/bin/python" "$SCRIPT_DIR/wiki-publish.py" "$VAULT_NAME" "$PROJECT_ROOT" "$TARGET_DIR"
