#!/bin/bash

VAULT_NAME="$1"
if [ -z "$VAULT_NAME" ]; then
    echo "Error: Vault name not provided."
    exit 1
fi
