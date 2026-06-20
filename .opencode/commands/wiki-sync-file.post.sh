#!/bin/bash

# Resolve script directory absolutely
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"

# Change to project root
cd "$SCRIPT_DIR/../../" || exit 1

VAULT_NAME="$1"
if [ -z "$VAULT_NAME" ]; then
    echo "Error: Vault name not provided."
    exit 1
fi

TARGET_FILE="$2"
if [ -z "$TARGET_FILE" ]; then
    echo "Error: Target file name not provided."
    exit 1
fi

echo "[Hook] Starting post-processing for wiki-sync-file (Vault: $VAULT_NAME, File: $TARGET_FILE)..."

INBOX_DIR="./Vaults/$VAULT_NAME/inbox"
ASSET_DIR_PARENT="./Vaults/$VAULT_NAME/wiki/assets"
ASSET_DIR="$ASSET_DIR_PARENT/$(date "+%Y-%m-%d")"

# Resolve the path: can be relative to inbox, or absolute/relative to project root
if [[ "$TARGET_FILE" == /* ]]; then
    FILE_PATH="$TARGET_FILE"
elif [[ "$TARGET_FILE" == ./Vaults/* || "$TARGET_FILE" == Vaults/* ]]; then
    FILE_PATH="$TARGET_FILE"
else
    FILE_PATH="$INBOX_DIR/$TARGET_FILE"
fi

if [ -f "$FILE_PATH" ]; then
    echo "Archiving file $FILE_PATH to $ASSET_DIR..."
    mkdir -p "$ASSET_DIR"
    mv "$FILE_PATH" "$ASSET_DIR"/
    echo "Success: $FILE_PATH archived to $ASSET_DIR."
else
    echo "Error: File $FILE_PATH not found, cannot archive."
    exit 1
fi

printf '\n[Hook] Post-processing finished.'
