#!/bin/bash

# Change to the directory where the script is located
SCRIPT_DIR="$(dirname "$0")"
SUB_SCRIPTS_DIR="$SCRIPT_DIR/wiki-sync"

VAULTS="$1"
INQUIRY="$2"

if [ -z "$VAULTS" ] || [ -z "$INQUIRY" ]; then
    echo "Error: Both Vault name(s) and Report inquiry parameters are required. Usage: /wiki-report <Vaults> <Report-Inquiry>" >&2
    exit 1
fi

VAULT_NAME="${VAULTS%%,*}"

# Ensure folder structure exists
bash "$SUB_SCRIPTS_DIR/ensure-folders.sh" "$VAULT_NAME"
