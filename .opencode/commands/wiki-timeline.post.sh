#!/bin/bash

# Exit on any error
set -e

# Change to the directory where the script is located
SCRIPT_DIR="$(dirname "$0")"

VAULT_NAME="$1"
if [ -z "$VAULT_NAME" ]; then
    echo "Error: Vault name parameter is required. Usage: /wiki-timeline.post.sh <VaultName>" >&2
    exit 1
fi

# Invoke the git-commit-helper.sh script to stage and commit
if [ -f "$SCRIPT_DIR/git-commit-helper.sh" ]; then
    bash "$SCRIPT_DIR/git-commit-helper.sh" "$VAULT_NAME" "wiki-timeline" "Updated chronological timeline" \
        "Vaults/$VAULT_NAME/wiki/timeline.md" \
        "Vaults/$VAULT_NAME/wiki/index.md"
fi

printf '\n[Hook] Timeline post-processing finished.'
