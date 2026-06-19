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


echo "[Hook] Starting post-processing for wiki-sync (Vault: $VAULT_NAME)..."

INBOX_DIR="./Vaults/$VAULT_NAME/inbox"
ASSET_DIR_PARENT="./Vaults/$VAULT_NAME/wiki/assets"
ASSET_DIR="$ASSET_DIR_PARENT/$(date "+%Y-%m-%d")"

if [ -d "$INBOX_DIR" ] && [ -n "$(find "$INBOX_DIR" -maxdepth 1 -mindepth 1 ! -name ".DS_Store" ! -name ".gitkeep" 2>/dev/null)" ]; then
    echo "Inbox contains files. Archiving to $ASSET_DIR..."
    mkdir -p "$ASSET_DIR"
    find "$INBOX_DIR" -maxdepth 1 -mindepth 1 ! -name ".DS_Store" ! -name ".gitkeep" -exec mv {} "$ASSET_DIR"/ \;

    if [ -d "$ASSET_DIR" ] && [ -d "$INBOX_DIR" ]; then
        echo "Success: $INBOX_DIR archived to $ASSET_DIR."
    else
        echo "Error: Failed to archive $INBOX_DIR"
        exit 1
    fi
else
    echo "Inbox is empty or does not exist. Skipping archiving."
fi

# Invoke the git-commit-helper.sh script to stage and commit
if [ -f "$SCRIPT_DIR/git-commit-helper.sh" ]; then
    bash "$SCRIPT_DIR/git-commit-helper.sh" "$VAULT_NAME" "wiki-sync" "Processed inbox files and updated summaries/concepts/index" \
        "Vaults/$VAULT_NAME/wiki/summaries" \
        "Vaults/$VAULT_NAME/wiki/concepts" \
        "Vaults/$VAULT_NAME/wiki/index.md" \
        "Vaults/$VAULT_NAME/wiki/assets"
fi

printf '\n[Hook] Post-processing finished.'

