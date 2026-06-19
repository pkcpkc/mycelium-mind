#!/bin/bash
# Exit on any error
set -e

VAULT_NAME="$1"
if [ -z "$VAULT_NAME" ]; then
    echo "Error: Vault name parameter is required. Usage: /wiki-publish <VaultName>" >&2
    exit 1
fi

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/../../" && pwd)"

# Run python preprocessing and compile inline
"$PROJECT_ROOT/.venv/bin/python" - "$VAULT_NAME" "$PROJECT_ROOT" << 'EOF'
import os
import sys
import shutil
import re
import urllib.parse
import subprocess

vault_name = sys.argv[1]
project_root = sys.argv[2]
vault_dir = os.path.join(project_root, "Vaults", vault_name, "wiki")

if not os.path.isdir(vault_dir):
    print(f"Error: Vault directory '{vault_dir}' does not exist.", file=sys.stderr)
    sys.exit(1)
    
dist_dir = os.path.join(project_root, "dist")
build_dir = os.path.join(dist_dir, f"build-{vault_name}")
docs_dir = os.path.join(build_dir, "docs")
site_dir = os.path.join(dist_dir, vault_name)

# 1. Clean and recreate build directory
if os.path.exists(build_dir):
    shutil.rmtree(build_dir)
os.makedirs(docs_dir, exist_ok=True)

# 2. Copy wiki contents to docs_dir
print(f"Copying wiki files from {vault_dir} to {docs_dir}...")
for item in os.listdir(vault_dir):
    s = os.path.join(vault_dir, item)
    d = os.path.join(docs_dir, item)
    # Skip mkdocs.yml in docs copy (it goes in the build parent directory)
    if item == "mkdocs.yml":
        shutil.copy2(s, os.path.join(build_dir, "mkdocs.yml"))
        continue
    if os.path.isdir(s):
        shutil.copytree(s, d, dirs_exist_ok=True)
    else:
        shutil.copy2(s, d)
        
# Ensure mkdocs.yml exists in the build dir
build_config_path = os.path.join(build_dir, "mkdocs.yml")
if not os.path.exists(build_config_path):
    source_config = os.path.join(vault_dir, "mkdocs.yml")
    if os.path.exists(source_config):
        shutil.copy2(source_config, build_config_path)
    else:
        print("Warning: mkdocs.yml not found, writing default config.")
        with open(build_config_path, "w") as f:
            f.write(f"site_name: {vault_name} Wiki\ntheme:\n  name: material\n")
            
# 3. Build filename-to-relative-path map (case-insensitive)
file_map = {}
for root, _, files in os.walk(docs_dir):
    for file in files:
        if file.endswith(".md"):
            full_path = os.path.join(root, file)
            rel_path = os.path.relpath(full_path, docs_dir)
            basename = os.path.splitext(file)[0]
            file_map[basename.lower()] = rel_path
            
print(f"Indexed {len(file_map)} markdown files.")

# Helper to find a fuzzy case-insensitive prefix match for files that might have been renamed/truncated
def find_fuzzy_match(target_lower):
    if not target_lower:
        return None
    if target_lower in file_map:
        return file_map[target_lower]
    # Sort keys by length descending to find the longest matching prefix
    for k in sorted(file_map.keys(), key=len, reverse=True):
        if len(k) >= 3 and len(target_lower) >= 3:
            if target_lower.startswith(k) or k.startswith(target_lower):
                return file_map[k]
    return None

# 4. Regex patterns
wikilink_re = re.compile(r'\[\[([^\]]+)\]\]')
std_link_re = re.compile(r'\[([^\]]+)\]\(((?!https?://|mailto:)[^)]+?\.md)(#[^)]*)?\)')

def process_file(file_path):
    current_dir_abs = os.path.dirname(file_path)
    
    with open(file_path, "r", encoding="utf-8") as f:
        content = f.read()
        
    def replace_wikilink(match):
        link_content = match.group(1)
        if '|' in link_content:
            target_part, label = link_content.split('|', 1)
        else:
            target_part = link_content
            label = None
            
        if '#' in target_part:
            target, anchor = target_part.split('#', 1)
            anchor_part = f"#{anchor}"
        else:
            target = target_part
            anchor_part = ""
            
        target_clean = target.strip()
        target_lower = target_clean.lower()
        
        target_rel_path = find_fuzzy_match(target_lower)
        if target_rel_path:
            target_abs_path = os.path.join(docs_dir, target_rel_path)
            rel_path = os.path.relpath(target_abs_path, current_dir_abs)
            url_path = rel_path.replace(os.path.sep, '/')
            
            if not label:
                label = target_clean if not anchor_part else f"{target_clean} > {anchor}"
                
            return f"[{label.strip()}]({url_path}{anchor_part})"
        else:
            if target_clean.startswith("#"):
                if not label:
                    label = target_clean[1:]
                return f"[{label.strip()}]({target_clean})"
            return label.strip() if label else target_clean
            
    def replace_std_link(match):
        label = match.group(1)
        path_part = match.group(2)
        anchor_part = match.group(3) or ""
        
        # Clean path_part: strip leading 'wiki/' or './wiki/'
        cleaned_path = path_part
        if cleaned_path.startswith("wiki/"):
            cleaned_path = cleaned_path[5:]
        elif cleaned_path.startswith("./wiki/"):
            cleaned_path = cleaned_path[7:]
            
        # Get filename without directory and extension for map lookup
        base_name_with_ext = os.path.basename(cleaned_path)
        base_name_no_ext = os.path.splitext(base_name_with_ext)[0]
        base_name_lower = base_name_no_ext.lower()
        
        # Check if we can find a fuzzy match for this note
        target_rel_path = find_fuzzy_match(base_name_lower)
        if target_rel_path:
            target_abs_path = os.path.join(docs_dir, target_rel_path)
            rel_path = os.path.relpath(target_abs_path, current_dir_abs)
            normalized_path = rel_path.replace(os.path.sep, '/')
            return f"[{label}]({normalized_path}{anchor_part})"
        else:
            # Fallback: if the target does not exist in the vault, return the label as plain text to prevent 404
            return label
        
    new_content = wikilink_re.sub(replace_wikilink, content)
    new_content = std_link_re.sub(replace_std_link, new_content)
    
    if new_content != content:
        with open(file_path, "w", encoding="utf-8") as f:
            f.write(new_content)
            
# 5. Process all markdown files in-place
for root, _, files in os.walk(docs_dir):
    for file in files:
        if file.endswith(".md"):
            process_file(os.path.join(root, file))
            
print("Link preprocessing completed successfully.")

# 6. Run mkdocs build
venv_mkdocs = os.path.join(project_root, ".venv", "bin", "mkdocs")
if not os.path.exists(venv_mkdocs):
    venv_mkdocs = "mkdocs"
    
print(f"Building static site with MkDocs Material...")
build_cmd = [
    venv_mkdocs,
    "build",
    "-f", build_config_path,
    "-d", site_dir
]

try:
    result = subprocess.run(build_cmd, capture_output=True, text=True, check=True)
    print(result.stdout)
    print(f"Success! Wiki '{vault_name}' rendered to {site_dir}")
except subprocess.CalledProcessError as e:
    print(f"Error building MkDocs site:\n{e.stderr}", file=sys.stderr)
    sys.exit(1)
finally:
    # Clean up intermediate staging files
    if os.path.exists(build_dir):
        shutil.rmtree(build_dir)
EOF
