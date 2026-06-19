#!/bin/bash

# Change to the directory where the script is located
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"

VAULT_NAME="$1"
if [ -z "$VAULT_NAME" ]; then
    echo "Error: Vault name parameter is required. Usage: /wiki <VaultName>" >&2
    exit 1
fi

# Change to project root to run Git commands
cd "$SCRIPT_DIR/../../" || exit 1

if git rev-parse --is-inside-work-tree >/dev/null 2>&1; then
    CURRENT_BRANCH=$(git branch --show-current)
    if [[ "$CURRENT_BRANCH" =~ ^wiki/.*-sync- ]]; then
        echo "[Git] Already on a wiki sync branch: $CURRENT_BRANCH. Skipping branch creation."
    else
        # Save the original branch name (fallback to main if empty/detached)
        ORIG_BRANCH="${CURRENT_BRANCH:-main}"
        echo "$ORIG_BRANCH" > "$SCRIPT_DIR/wiki-sync/.original-branch-${VAULT_NAME}"
        
        TIMESTAMP=$(date "+%Y%m%d-%H%M%S")
        BRANCH_NAME="wiki/${VAULT_NAME}-sync-${TIMESTAMP}"
        echo "[Git] Creating and checking out branch: $BRANCH_NAME"
        git checkout -b "$BRANCH_NAME"
    fi
else
    echo "[Git Warning] Not inside a git repository. Skipping branch creation."
fi

# Default target file path
TARGET_FILE="$SCRIPT_DIR/wiki.hooks.json"

# Parse and print the post node entries as a numbered list
cd "$SCRIPT_DIR" || exit 1
jq -r '.commands.post[]' "$TARGET_FILE" | awk '{print NR ". " $0}'

