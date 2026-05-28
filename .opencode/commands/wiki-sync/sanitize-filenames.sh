#!/bin/bash

# Change to project root
cd "$(dirname "$0")/../../../" || exit 1

printf "\n--- Filename Sanitization ---\n"

# --- Load Environment Variables ---
SOURCE_DIR="./Vaults/$1/inbox"
ENV_FILE=".env"
REQUESTED_SOURCE_DIR="${SOURCE_DIR:-}"
if [ -f "$ENV_FILE" ]; then
    export $(grep -v '^#' "$ENV_FILE" | xargs)
fi

VAULT_NAME="$1"
if [ -z "$VAULT_NAME" ]; then
    echo "Error: Vault name not provided."
    echo "Usage: /wiki-sync <vault-name>"
    exit 1
fi

SOURCE_DIR="${REQUESTED_SOURCE_DIR:-./Vaults/$VAULT_NAME/inbox}"
if [ ! -d "$SOURCE_DIR" ]; then
    echo "Error: Source directory '$SOURCE_DIR' not found."
    exit 1
fi

sanitize_name() {
    # Remove characters that are invalid or troublesome in common filesystems,
    # and replace all whitespaces with underscores.
    printf '%s' "$1" | sed -e 's#[\\/:*?"<>|]##g' -e 's#[[:space:]][[:space:]]*#_#g'
}

unique_target() {
    local dir="$1"
    local name="$2"
    local target="$dir/$name"

    if [ ! -e "$target" ]; then
        printf '%s' "$target"
        return
    fi

    local base="$name"
    local ext=""
    if [[ "$name" == *.* && "$name" != .* ]]; then
        base="${name%.*}"
        ext=".${name##*.}"
    fi

    local count=1
    while [ -e "$dir/${base}-${count}${ext}" ]; do
        ((count++))
    done

    printf '%s' "$dir/${base}-${count}${ext}"
}

renamed_count=0

while read -r file; do
    dir="$(dirname "$file")"
    filename="$(basename "$file")"
    sanitized="$(sanitize_name "$filename")"

    if [ -z "$sanitized" ]; then
        sanitized="untitled"
    fi

    [ "$filename" = "$sanitized" ] && continue

    target="$(unique_target "$dir" "$sanitized")"
    mv "$file" "$target"
    echo "Renamed: $file -> $target"
    ((renamed_count++))
done < <(find "$SOURCE_DIR" -depth -type f)

printf "Filename sanitization complete. Renamed %s file(s).\n" "$renamed_count"
