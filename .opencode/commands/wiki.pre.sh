#!/bin/bash

# Default target file path
TARGET_FILE="$SCRIPT_DIR/wiki.hooks.json"

# Parse and print the post node entries as a numbered list
cd "$SCRIPT_DIR" || exit 1
jq -r '.commands.post[]' "$TARGET_FILE" | awk '{print NR ". " $0}'

