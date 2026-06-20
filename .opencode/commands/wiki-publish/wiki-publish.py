import os
import sys
import shutil
import re
import urllib.parse
import subprocess
import yaml

# Register custom YAML loader for !!python/name tags to allow safe loading of custom theme configurations
def python_name_constructor(loader, tag_suffix, node):
    return f"!!python/name:{tag_suffix}"

yaml.SafeLoader.add_multi_constructor('tag:yaml.org,2002:python/name:', python_name_constructor)

def main():
    if len(sys.argv) < 3:
        print("Error: Missing arguments. Usage: wiki-publish.py <VaultName> <ProjectRoot> [TargetDir]", file=sys.stderr)
        sys.exit(1)

    vault_name = sys.argv[1]
    project_root = sys.argv[2]
    
    # 1. Parse target directory
    if len(sys.argv) >= 4 and sys.argv[3].strip():
        site_dir = sys.argv[3].strip()
        if not os.path.isabs(site_dir):
            site_dir = os.path.abspath(os.path.join(project_root, site_dir))
    else:
        site_dir = os.path.join(project_root, "dist", vault_name)

    vault_dir = os.path.join(project_root, "Vaults", vault_name, "wiki")

    if not os.path.isdir(vault_dir):
        print(f"Error: Vault directory '{vault_dir}' does not exist.", file=sys.stderr)
        sys.exit(1)
        
    dist_dir = os.path.join(project_root, "dist")
    build_dir = os.path.join(dist_dir, f"build-{vault_name}")
    docs_dir = os.path.join(build_dir, "docs")

    # 2. Clean and recreate build directory
    if os.path.exists(build_dir):
        shutil.rmtree(build_dir)
    os.makedirs(docs_dir, exist_ok=True)

    # 3. Ensure mkdocs.yml exists in the source vault directory
    source_config = os.path.join(vault_dir, "mkdocs.yml")
    if not os.path.exists(source_config):
        print(f"Writing default config to {source_config}...")
        default_config_content = f"""site_name: {vault_name} Wiki
theme:
  name: material
  palette:
    - media: "(prefers-color-scheme: light)"
      scheme: default
      primary: indigo
      accent: indigo
      toggle:
        icon: material/brightness-7
        name: Switch to dark mode
    - media: "(prefers-color-scheme: dark)"
      scheme: slate
      primary: indigo
      accent: indigo
      toggle:
        icon: material/brightness-4
        name: Switch to light mode
use_directory_urls: false
plugins:
  - search
markdown_extensions:
  - pymdownx.superfences:
      custom_fences:
        - name: mermaid
          class: mermaid
          format: !!python/name:pymdownx.superfences.fence_code_format
"""
        with open(source_config, "w", encoding="utf-8") as f:
            f.write(default_config_content)

    # 4. Copy wiki contents to docs_dir
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
            
    # Ensure mkdocs.yml exists in the build dir with correct settings
    build_config_path = os.path.join(build_dir, "mkdocs.yml")
    config_data = {}
    if os.path.exists(source_config):
        print(f"Loading config from {source_config}...")
        with open(source_config, "r", encoding="utf-8") as f:
            try:
                config_data = yaml.safe_load(f) or {}
            except Exception as e:
                print(f"Error loading YAML: {e}, falling back to default configuration.")
                config_data = {}

    # Update or add required config keys (using them as defaults, allowing user overrides)
    if "site_name" not in config_data:
        config_data["site_name"] = f"{vault_name} Wiki"
        
    if "theme" not in config_data:
        config_data["theme"] = {"name": "material"}
    elif isinstance(config_data["theme"], str):
        config_data["theme"] = {"name": config_data["theme"]}
    elif isinstance(config_data["theme"], dict) and "name" not in config_data["theme"]:
        config_data["theme"]["name"] = "material"

    if isinstance(config_data["theme"], dict) and "palette" not in config_data["theme"]:
        config_data["theme"]["palette"] = [
            {
                "media": "(prefers-color-scheme: light)",
                "scheme": "default",
                "primary": "indigo",
                "accent": "indigo",
                "toggle": {
                    "icon": "material/brightness-7",
                    "name": "Switch to dark mode"
                }
            },
            {
                "media": "(prefers-color-scheme: dark)",
                "scheme": "slate",
                "primary": "indigo",
                "accent": "indigo",
                "toggle": {
                    "icon": "material/brightness-4",
                    "name": "Switch to light mode"
                }
            }
        ]

    if "plugins" not in config_data:
        config_data["plugins"] = ["search"]

    # Default to local navigation compatible URL settings if not explicitly specified
    if "use_directory_urls" not in config_data:
        config_data["use_directory_urls"] = False

    # Force Mermaid support configuration
    extensions = config_data.get("markdown_extensions", [])
    if not isinstance(extensions, list):
        extensions = []

    superfences_configured = False
    for ext in extensions:
        if isinstance(ext, str) and ext == "pymdownx.superfences":
            superfences_configured = True
            idx = extensions.index(ext)
            extensions[idx] = {
                "pymdownx.superfences": {
                    "custom_fences": [
                        {
                            "name": "mermaid",
                            "class": "mermaid",
                            "format": "!!python/name:pymdownx.superfences.fence_code_format"
                        }
                    ]
                }
            }
            break
        elif isinstance(ext, dict) and "pymdownx.superfences" in ext:
            superfences_configured = True
            superfences_config = ext["pymdownx.superfences"] or {}
            custom_fences = superfences_config.get("custom_fences", [])
            
            mermaid_configured = False
            for fence in custom_fences:
                if isinstance(fence, dict) and fence.get("name") == "mermaid":
                    mermaid_configured = True
                    break
            
            if not mermaid_configured:
                custom_fences.append({
                    "name": "mermaid",
                    "class": "mermaid",
                    "format": "!!python/name:pymdownx.superfences.fence_code_format"
                })
                superfences_config["custom_fences"] = custom_fences
                ext["pymdownx.superfences"] = superfences_config
            break

    if not superfences_configured:
        extensions.append({
            "pymdownx.superfences": {
                "custom_fences": [
                    {
                        "name": "mermaid",
                        "class": "mermaid",
                        "format": "!!python/name:pymdownx.superfences.fence_code_format"
                    }
                ]
            }
        })

    config_data["markdown_extensions"] = extensions

    # Dump config and replace quoted YAML tags so MkDocs parses them correctly
    yaml_str = yaml.safe_dump(config_data, default_flow_style=False)
    yaml_str = re.sub(
        r"'!!python/name:([^']+)'",
        r"!!python/name:\1",
        yaml_str
    )

    with open(build_config_path, "w", encoding="utf-8") as f:
        f.write(yaml_str)
                
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

if __name__ == "__main__":
    main()
