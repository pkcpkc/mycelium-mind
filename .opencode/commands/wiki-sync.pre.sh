#!/bin/bash

# Change to the directory where the script is located
SCRIPT_DIR="$(dirname "$0")"
SUB_SCRIPTS_DIR="$SCRIPT_DIR/wiki-sync"

VAULT_NAME="$1"

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

# Sanitize inbox filenames before processing
run_sub_script "$SUB_SCRIPTS_DIR/sanitize-filenames.sh" "Filename sanitization"

# Ensure folder structure exists
echo ""
run_sub_script "$SUB_SCRIPTS_DIR/ensure-folders.sh" "Ensure folders"

# Execute the image analysis sub-script
echo ""
run_sub_script "$SUB_SCRIPTS_DIR/image-to-text.sh" "Image analysis"

# Execute the OCR analysis sub-script
echo ""
run_sub_script "$SUB_SCRIPTS_DIR/ocr-pdf.sh" "OCR analysis"

printf '\n[Hook] Pre-processing finished.\n'
