#!/bin/bash

# Exit on any error
set -e

# Change to the directory where the script is located
SCRIPT_DIR="$(dirname "$0")"

VAULT_NAME="$1"
if [ -z "$VAULT_NAME" ]; then
    echo "Error: Vault name parameter is required. Usage: /wiki-social-graph.post.sh <VaultName>" >&2
    exit 1
fi

printf '\n[Hook] Social graph post-processing finished.'
