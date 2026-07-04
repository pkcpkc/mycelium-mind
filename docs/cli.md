# Mycelium Mind CLI Command Reference 🧠

The `mycelium-mind` CLI tool can be executed using its binary alias `mm` or through `npx mm`. 

All commands that require a `<wiki-path>` parameter (e.g., `sync`, `resync`, `publish`, `check-plugins`) have it configured as **optional** and default to `.` (the current working directory) if omitted.

---

## 🚀 Commands

### `init [wiki-path]`

Initializes a new wiki vault layout in the targeted directory:
- **Default configurations**: Creates a base MkDocs config at `config/mkdocs.yml`.
- **Default collection plugins**: Populates `plugins/collections/` with `concepts`, `persons`, and `times`.
- **Default overview scripts**: Adds `plugins/overviews/social-graph.js` and `plugins/overviews/timeline.js`.
- **Git Repo**: Initializes a local git repository inside the target directory so that changes and compilations can be version-controlled local to the vault.

```bash
# Initialize a new wiki in a subdirectory
mm init ./my-sovereign-wiki

# Initialize a new wiki in the current working directory
mm init
```

---

### `sync [wiki-path] [options]`

Runs the main incremental compiler pipeline on new documents dropped in `inbox/`:
1. **Summarization**: Summarizes each document into `wiki/summaries/`.
2. **Asset Archiving**: Archives raw source files into dated folders inside `wiki/assets/YYYY-MM-DD/`.
3. **Entity Compilation**: Batches and updates cards under `wiki/collections/` (`concepts`, `persons`, `times`, etc.) by merging new details into existing profiles.
4. **Overviews**: Re-runs overview scripts inside a VM sandbox to regenerate registry and graph pages.
5. **MOC Rebuilding**: Rebuilds tag index pages and relationship clouds.
6. **Git Isolation**: Commits all compiled outputs local to the vault's git repository.

**Options**:
- `-v, --verbose`: Prints assembled LLM prompts (summaries and entity card merges) to standard output before calling the model API.
- `--branch`: Creates and checkouts a temporary git branch (e.g. `sync-YYYYMMDD-HHMMSS`) before compilation, committing all updates there.
- `--pr`: Pushes the sync branch to origin and triggers `gh pr create` (requires the GitHub CLI).

```bash
# Sync the current directory vault
mm sync

# Sync a specific vault in verbose mode
mm sync ./my-vault -v
```

---

### `resync [wiki-path] [options]`

Wipes the compiled entity and summary states and fully re-ingests/re-compiles all source material from archived assets. This is useful when you tweak collection prompts, update schema definitions, or modify overview scripts and want to rebuild the entire wiki from scratch.

**Options**:
- Supports the same `-v, --verbose`, `--branch`, and `--pr` options as `sync`.

```bash
# Rebuild the wiki from archived assets
mm resync
```

---

### `check-plugins [wiki-path]`

Scans and validates all collection plugins inside the vault's `plugins/collections/` directory in a single scan:
- **Schema Validation**: Validates `schema.yml` formatting and syntax, reporting any parsing issues.
- **Leniency**: Schemas with no custom properties (only containing `$meta` blocks) are accepted silently without errors or warnings.
- **Prompt Validation**: Validates `prompt.md` files to ensure they contain critical expected placeholders (`$VALUE`, `$EXISTING_CONTENT`, `$SUMMARY_CONTENT`).
- **Verbose Diagnostic Logging**: All warning and error logs output the **exact absolute path** of the failing schema/prompt files for straightforward troubleshooting.

```bash
# Scan and validate all collection plugins in the current vault
mm check-plugins
```

---

### `publish [wiki-path] [target-dir]`

Compiles the flat Obsidian-style markdown wiki into a standardized MkDocs static website:
- **Link Conversion**: Preprocesses flat wiki links (e.g., `[[Andrej Karpathy]]`) into relative path markdown links (e.g., `../collections/persons/Andrej_Karpathy.md`).
- **Tag Mapping**: Compiles tag relationships into a root metadata file (`tags.json`) for interactive Cytoscape graphic cloud renderings.
- **MkDocs Compilation**: Builds and compiles static HTML/JS/CSS assets to `[target-dir]`.

```bash
# Compile site to a static folder
mm publish . ./dist/site
```
