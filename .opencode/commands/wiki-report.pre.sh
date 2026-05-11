#!/bin/bash

# Change to the directory where the script is located
SCRIPT_DIR="$(dirname "$0")"
SUB_SCRIPTS_DIR="$SCRIPT_DIR/wiki-sync"

VAULT_NAME="${1%%,*}"

run_sub_script() {
    local script="$1"
    local label="$2"

    if [ ! -f "$script" ]; then
        echo "Error: $script not found."
        exit 1
    fi

    bash "$script" "$VAULT_NAME"
    local status=$?
    if [ "$status" -ne 0 ]; then
        echo "Error: $label failed with exit code $status."
        exit "$status"
    fi
}

# Ensure folder structure exists
echo ""
run_sub_script "$SUB_SCRIPTS_DIR/ensure-folders.sh" "Ensure folders"
