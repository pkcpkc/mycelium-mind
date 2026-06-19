#!/bin/bash

# Exit on any error
set -e

# Change to the directory where the script is located
SCRIPT_DIR="$(dirname "$0")"

VAULT_NAME="$1"
if [ -z "$VAULT_NAME" ]; then
    echo "Error: Vault name parameter is required. Usage: /wiki.post.sh <VaultName>" >&2
    exit 1
fi

# Change to project root to run Git commands
cd "$SCRIPT_DIR/../../" || exit 1

TRACKING_FILE="$SCRIPT_DIR/wiki-sync/.original-branch-${VAULT_NAME}"

if [ ! -f "$TRACKING_FILE" ]; then
    echo "[Git Warning] No original branch tracking file found. Skipping PR creation."
    exit 0
fi

ORIG_BRANCH=$(cat "$TRACKING_FILE")
CURRENT_BRANCH=$(git branch --show-current)

# Validate that we are indeed on a wiki sync branch
if [[ ! "$CURRENT_BRANCH" =~ ^wiki/.*-sync- ]]; then
    echo "[Git Warning] Current branch '$CURRENT_BRANCH' is not a wiki sync branch. Skipping PR creation."
    rm -f "$TRACKING_FILE"
    exit 0
fi

# Check for commits on the sync branch compared to the original branch
echo "[Git] Verifying changes on branch '$CURRENT_BRANCH' against '$ORIG_BRANCH'..."
COMMITS_COUNT=$(git rev-list --count "${ORIG_BRANCH}..HEAD" 2>/dev/null || echo "0")

if [ "$COMMITS_COUNT" -eq 0 ]; then
    echo "[Git] No changes detected in the vault. Cleaning up branch..."
    git checkout "$ORIG_BRANCH"
    git branch -d "$CURRENT_BRANCH"
    rm -f "$TRACKING_FILE"
    echo "[Git] Workspace reset back to '$ORIG_BRANCH'."
    exit 0
fi
PUSH_SUCCESS=true
echo "[Git] Pushing sync branch to remote..."
if ! git push origin HEAD; then
    echo "[Git Warning] Failed to push branch to remote."
    PUSH_SUCCESS=false
fi

if [ "$PUSH_SUCCESS" = true ]; then
    echo "[Git] Creating Pull Request on GitHub..."
    if PR_URL=$(gh pr create --title "wiki: sync $VAULT_NAME - $(date "+%Y-%m-%d")" \
                            --body "Automated wiki sync pipeline execution for vault $VAULT_NAME." \
                            --base "$ORIG_BRANCH" \
                            --head "$CURRENT_BRANCH" 2>&1); then
        echo "--------------------------------------------------------"
        echo "Successfully created Pull Request:"
        echo "$PR_URL"
        echo "--------------------------------------------------------"
    else
        echo "[Git Warning] Failed to create Pull Request via gh CLI: $PR_URL"
    fi
fi

# Switch back to original branch and clean tracking file
echo "[Git] Returning workspace to original branch '$ORIG_BRANCH'..."
git checkout "$ORIG_BRANCH" || git checkout main
rm -f "$TRACKING_FILE"

printf '\n[Hook] Wiki orchestration post-processing finished.'

