#!/bin/bash

# Change to project root
cd "$(dirname "$0")/../../../" || exit 1

VAULT_NAME="$1"

if [ -z "$VAULT_NAME" ]; then
    echo "Error: Vault name not provided."
    exit 1
fi

VAULT_DIR="./Vaults/$VAULT_NAME"

mkdir -p "$VAULT_DIR/wiki"
mkdir -p "$VAULT_DIR/wiki/assets"
mkdir -p "$VAULT_DIR/wiki/summaries"
mkdir -p "$VAULT_DIR/wiki/concepts"
mkdir -p "$VAULT_DIR/inbox"
