#!/bin/bash

VAULT_NAME="$1"
if [ -z "$VAULT_NAME" ]; then
    echo "Error: Vault name parameter is required. Usage: /wiki-persons <VaultName>" >&2
    exit 1
fi

# Change to project root
cd "$(dirname "$0")/../../" || exit 1

mkdir -p "./Vaults/$VAULT_NAME/wiki/persons"
