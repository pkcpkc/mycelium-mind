#!/bin/bash

# Change to project root
cd "$(dirname "$0")/../../" || exit 1

VAULT_NAME="$1"
if [ -z "$VAULT_NAME" ]; then
    echo "Error: Vault name not provided."
    exit 1
fi

echo "[Hook] Starting post-processing for wiki-sync (Vault: $VAULT_NAME)..."

INBOX_DIR="./Vaults/$VAULT_NAME/inbox"
ASSET_DIR_PARENT="./Vaults/$VAULT_NAME/wiki/assets"
ASSET_DIR="$ASSET_DIR_PARENT/$(date "+%Y-%m-%d")"

if [ -d "$INBOX_DIR" ] && [ "$(ls -A "$INBOX_DIR" 2>/dev/null)" ]; then
    echo "Inbox contains files. Archiving to $ASSET_DIR..."
    if [ -d "$ASSET_DIR" ]; then
        # If the folder already exists today, move the contents
        mv "$INBOX_DIR"/* "$ASSET_DIR"/ 2>/dev/null || true
        rm -rf "$INBOX_DIR"
    else
        # Otherwise atomically rename the folder
        mv "$INBOX_DIR" "$ASSET_DIR" 2>/dev/null || true
    fi

    # Immediately recreate a fresh inbox directory
    mkdir -p "$INBOX_DIR"

    if [ -d "$ASSET_DIR" ] && [ -d "$INBOX_DIR" ]; then
        echo "Success: $INBOX_DIR archived to $ASSET_DIR and recreated."
    else
        echo "Error: Failed to archive $INBOX_DIR"
        exit 1
    fi
else
    echo "Inbox is empty or does not exist. Skipping archiving."
fi

printf '\n[Hook] Post-processing finished.'
