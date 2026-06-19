#!/bin/bash

# Exit on any error
set -e

# Change to project root (2 levels up from .opencode/commands)
cd "$(dirname "$0")/../../" || exit 1

VAULT_NAME="$1"
STEP_NAME="$2"
COMMIT_MSG="$3"
shift 3

if [ -z "$VAULT_NAME" ] || [ -z "$STEP_NAME" ] || [ -z "$COMMIT_MSG" ]; then
    echo "Error: Missing arguments for git-commit-helper" >&2
    exit 1
fi

echo "[Git Helper] Staging changes for step '$STEP_NAME'..."

# Add all provided patterns that exist
EXISTING_PATTERNS=()
for pattern in "$@"; do
    # Check if the file or directory exists before staging
    if [ -e "$pattern" ]; then
        git add "$pattern"
        EXISTING_PATTERNS+=("$pattern")
    fi
done

# If no patterns exist on disk, we have nothing to check or commit
if [ ${#EXISTING_PATTERNS[@]} -eq 0 ]; then
    echo "[Git Helper] No existing files or folders to commit."
    exit 0
fi

# Check if there are staged changes
if ! git diff --cached --quiet -- "${EXISTING_PATTERNS[@]}"; then
    echo "[Git Helper] Committing changes for step '$STEP_NAME'..."
    git commit -m "[$STEP_NAME] $COMMIT_MSG" -- "${EXISTING_PATTERNS[@]}"
else
    echo "[Git Helper] No changes to commit for step '$STEP_NAME'."
fi

