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

# Create or update the index.md file of all persons
PERSONS_DIR="Vaults/$VAULT_NAME/wiki/persons"
if [ -d "$PERSONS_DIR" ]; then
    echo "[Hook] Creating/updating index.md in $PERSONS_DIR..."
    INDEX_FILE="$PERSONS_DIR/index.md"
    echo "# Persons Index" > "$INDEX_FILE"
    echo "" >> "$INDEX_FILE"
    
    # Find all .md files in the persons folder, exclude index.md itself, sort them, and format as wiki links
    find "$PERSONS_DIR" -maxdepth 1 -name "*.md" ! -name "index.md" | \
        sed 's|.*/||; s/\.md$//' | \
        sort -f | \
        while read -r name; do
            echo "- [[$name]]" >> "$INDEX_FILE"
        done
fi

# Invoke the git-commit-helper.sh script to stage and commit
if [ -f "$SCRIPT_DIR/git-commit-helper.sh" ]; then
    bash "$SCRIPT_DIR/git-commit-helper.sh" "$VAULT_NAME" "wiki-persons" "Updated individual bio pages and persons index" \
        "Vaults/$VAULT_NAME/wiki/persons" \
        "Vaults/$VAULT_NAME/wiki/index.md"
fi

printf '\n[Hook] Persons post-processing finished.'
