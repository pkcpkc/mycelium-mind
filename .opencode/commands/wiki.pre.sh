#!/bin/bash

# Change to the directory where the script is located
SCRIPT_DIR="$(dirname "$0")"

VAULT_NAME="$1"
if [ -z "$VAULT_NAME" ]; then
    echo "Error: Vault name parameter is required. Usage: /wiki <VaultName>" >&2
    exit 1
fi

# Default target file path
TARGET_FILE="$SCRIPT_DIR/wiki.hooks.json"

# Parse and print the post node entries as a numbered list
jq -r '.commands.post[]' "$TARGET_FILE" | awk '{print NR ". " $0}'
