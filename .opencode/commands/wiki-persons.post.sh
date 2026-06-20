#!/bin/bash

# Exit on any error
set -e

# Resolve script directory absolutely
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"

# Change to project root
cd "$SCRIPT_DIR/../../" || exit 1

VAULT_NAME="$1"
if [ -z "$VAULT_NAME" ]; then
    echo "Error: Vault name parameter is required. Usage: /wiki-persons.post.sh <VaultName>" >&2
    exit 1
fi

printf '\n[Hook] Persons post-processing finished.'
