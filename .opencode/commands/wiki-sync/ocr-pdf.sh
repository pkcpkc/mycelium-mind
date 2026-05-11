#!/bin/bash

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"

# Change to project root
cd "$SCRIPT_DIR/../../../" || exit 1
PROJECT_ROOT="$(pwd)"

printf "\n--- OCR Analysis ---\n"

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

# --- PDF to Image Conversion ---
echo "Converting PDFs to images"
cd "$SOURCE_DIR" || exit
for pdf in *.pdf; do
    [ -e "$pdf" ] || continue
    folder_name="${pdf%.*}"
    mkdir -p "$folder_name"
    pdftoppm -png -r 300 "$pdf" "$folder_name/temp"
    count=0
    for img in "$folder_name"/temp-*.png; do
        mv "$img" "$folder_name/$count.png"
        ((count++))
    done
done
cd "$PROJECT_ROOT" || exit 1

# --- Setup Temporary Payload File ---
TEMP_PAYLOAD=$(mktemp)
trap 'rm -f "$TEMP_PAYLOAD"' EXIT

# Process converted PDF pages (in subfolders) second.
echo "Interpreting image with OCR model: $OCR_MODEL_NAME"

find "$SOURCE_DIR" -mindepth 2 -type f \( -iname "*.png" -o -iname "*.jpg" -o -iname "*.jpeg" \) | while read -r img; do
    md_file="${img}.md"
    [ -f "$md_file" ] && continue

    echo "OCRing: $img"
    
    extension=$(echo "${img##*.}" | tr '[:upper:]' '[:lower:]')
    [ "$extension" == "jpg" ] && extension="jpeg"
    
    base64_img=$(base64 -i "$img" | tr -d '\n')

cat <<EOF > "$TEMP_PAYLOAD"
{
  "model": "$OCR_MODEL_NAME",
  "messages": [
    {
      "role": "user",
      "content": [
        {
          "type": "text",
          "text": "Perform OCR on this image and return the text."
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
        echo "Failed to OCR $img."
    fi
done

# --- Concatenate and Cleanup ---
printf "\nConcatenating and cleaning up PDF folders\n"
cd "$SOURCE_DIR" || exit
for pdf in *.pdf; do
    [ -e "$pdf" ] || continue
    folder_name="${pdf%.*}"
    
    if [ -d "$folder_name" ]; then
        output_md="${folder_name}.md"
        echo "Concatenating results from $folder_name into $output_md"
        
        # Clear output file first if it exists
        > "$output_md"
        
        # Sort files numerically and append them to the output file
        find "$folder_name" -name "*.png.md" | sort -V | while read -r f; do
            cat "$f" >> "$output_md"
            echo "" >> "$output_md" # Add a newline between pages for readability
        done
        
        if [ -s "$output_md" ]; then
            rm -rf "$folder_name"
            printf "\nSuccessfully created $output_md and removed $folder_name"
        else
            printf "\nWarning: $output_md is empty. Not removing $folder_name"
            rm -f "$output_md" # Remove empty file
        fi
        echo ""
    fi
done
cd ..
