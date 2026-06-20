#!/bin/bash

# Change to project root
cd "$(dirname "$0")/../../../" || exit 1
PROJECT_ROOT="$(pwd)"

VAULT_NAME="$1"

if [ -z "$VAULT_NAME" ]; then
    echo "Error: Vault name not provided."
    exit 1
fi

INBOX_DIR="./Vaults/$VAULT_NAME/inbox"
if [ ! -d "$INBOX_DIR" ]; then
    echo "[Loop] Inbox directory does not exist. Skipping."
    exit 0
fi

# Find all .md and .txt files in the inbox
# We only find top-level files (maxdepth 1)
# Note: we exclude files starting with '.' (like .DS_Store)
FILES=$(find "$INBOX_DIR" -maxdepth 1 -type f \( -name "*.md" -o -name "*.txt" \) ! -name ".*" 2>/dev/null)

if [ -z "$FILES" ]; then
    echo "[Loop] No text files to process in inbox."
    exit 0
fi

echo "[Loop] Found files to process in inbox:"
echo "$FILES"

# Run opencode run for each file
# We use standard IFS to handle spaces in filenames safely
echo "$FILES" | while read -r file; do
    [ -n "$file" ] || continue
    # Extract just the filename from the path
    filename=$(basename "$file")
    
    echo "[Loop] Starting new context for file: $filename"
    # Execute the child opencode command synchronously
    opencode run --command "wiki-sync-file" "$VAULT_NAME" "$filename"
    echo "[Loop] Completed processing for file: $filename"
done

echo "[Loop] Finished processing all files."
