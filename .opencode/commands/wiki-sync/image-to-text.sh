#!/bin/bash

# Change to project root
cd "$(dirname "$0")/../../../" || exit 1

echo "--- Semantic Image Analysis ---"

# --- Load Environment Variables ---
ENV_FILE=".env"
if [ -f "$ENV_FILE" ]; then
    export $(grep -v '^#' "$ENV_FILE" | xargs)
else
    echo "Error: $ENV_FILE not found."
    exit 1
fi

VAULT_NAME="$1"
if [ -z "$VAULT_NAME" ]; then
    echo "Error: Vault name not provided."
    exit 1
fi

SOURCE_DIR="./Vaults/$VAULT_NAME/inbox"
if [ ! -d "$SOURCE_DIR" ]; then
    echo "Error: Source directory '$SOURCE_DIR' not found."
    exit 1
fi

# --- Setup Temporary Payload File ---
TEMP_PAYLOAD=$(mktemp)
trap 'rm -f "$TEMP_PAYLOAD"' EXIT

# Process inbox images in the root of /inbox folder first.
echo "Interpreting inbox images with image model: $IMAGE_MODEL_NAME"

find "$SOURCE_DIR" -maxdepth 1 -type f \( -iname "*.png" -o -iname "*.jpg" -o -iname "*.jpeg" \) | while read -r img; do
    md_file="${img}.md"
    [ -f "$md_file" ] && continue

    echo "Analyzing: $img"
    
    extension=$(echo "${img##*.}" | tr '[:upper:]' '[:lower:]')
    [ "$extension" == "jpg" ] && extension="jpeg"
    
    base64_img=$(base64 -i "$img" | tr -d '\n')

cat <<EOF > "$TEMP_PAYLOAD"
{
  "model": "$IMAGE_MODEL_NAME",
  "messages": [
    {
      "role": "user",
      "content": [
        {
          "type": "text",
          "text": "Provide nothing but an into-detail image description for this image."
        },
        {
          "type": "image_url",
          "image_url": {
            "url": "data:image/$extension;base64,$base64_img"
          }
        }
      ]
    }
  ]
}
EOF

    response=$(curl -s -X POST "$API_URL" \
        -H "Authorization: Bearer $API_KEY" \
        -H "Content-Type: application/json" \
        --data-binary @"$TEMP_PAYLOAD")

    content=$(echo "$response" | jq -r '.choices[0].message.content // empty')
    if [[ -n "${content//[[:space:]]/}" ]]; then
        echo "$content" > "$md_file"
        echo "Success: Created $md_file"
    else
        echo "Failed to analyze $img."
    fi
done
