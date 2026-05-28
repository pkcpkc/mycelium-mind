#!/bin/bash

VAULT_NAME="$1"
if [ -z "$VAULT_NAME" ]; then
    echo "Error: Vault name parameter is required. Usage: /wiki-lint <VaultName>" >&2
    exit 1
fi
