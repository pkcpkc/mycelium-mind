# Custom Collection Plugins 🧩

Mycelium Mind collections (such as concepts, persons, countries, times) are defined as modular plugins under `plugins/collections/<plural-collection-name>/`.

Each collection plugin can contain a schema specification, an extraction prompt template, or both, enabling tailored synthesis rules for different card types.

---

## 📂 Plugin Layout

A plugin folder has the following possible configuration files:

```
plugins/collections/countries/
├── schema.yml                 # Main schema defining compiled card frontmatter fields [Optional]
├── summary-schema-extension.yml # Dynamic properties extracted from summaries [Optional]
└── prompt.md                  # Prompt instructing the LLM on compilation layout [Optional]
```

---

## 📋 Schema Specifications (`schema.yml` & `summary-schema-extension.yml`)

Schemas are parsed to validate extracted fields and tell the LLM exactly what frontmatter structure to output.

### 1. Structure

Schemas define custom attributes using comments to specify type and requirements:

```yaml
$meta:
  type: Schema
  title: "Person Concept Schema"
  description: "Defines attributes for biography cards."

name: [string] # Array | Required | List of alias names.
affiliations: # Array | Required | List of key affiliations.
  - relation: string # String | Required | Role name.
    person: string # String | Required | Target organization.
```

### 2. Auto-Injected System Fields

The compiler automatically manages common system metadata (like `timestamp` and `tags`). If these fields are missing from your `schema.yml`, the system auto-injects them under the hood:
- `timestamp`: Defaults to `$TIMESTAMP`, which the compiler automatically evaluates to the current ISO-8601 date.
- `tags`: Configured as an optional array of strings.

### 3. Silent Validation Leniency

If a collection does not require any custom frontmatter properties (e.g. it only needs the system-wide default `timestamp` and `tags` properties), its `schema.yml` can contain **only the `$meta` block**. 

The plugin validator (`mm check-plugins`) will accept this silently without warnings or termination errors.

---

## 📝 Extraction & Compilation Prompts (`prompt.md`)

The prompt instructs the LLM on how to extract details or merge new summaries into compiled profiles.

### 1. Template Variables

Prompts are standard markdown files that utilize the following compiled variables:
- `$VALUE`: The title or name of the entity being compiled.
- `$EXISTING_CONTENT`: The existing markdown text of the card (or `(empty)` if initializing a new card).
- `$SUMMARY_CONTENT`: A synthesized markdown block compiling new mentions found in inbox summaries.
- `$SCHEMA`: The YAML fields parsed from `schema.yml` (including auto-injected system keys).

### 2. Evaluated Placeholders Order

Placeholders inside `schema.yml` (such as `$VALUE` and `$TIMESTAMP`) are **evaluated first** before the resulting `$SCHEMA` output block is substituted into the `prompt.md` file. 

This makes `schema.yml` the single source of truth for the compiled frontmatter, allowing the prompt to be clean and simple:

```markdown
## Target Output Format (Template)

Ensure your output matches this exact structure.

```markdown
---
$SCHEMA
---

# $VALUE

[Biography details...]
```
```

---

## 🔍 Validation Command (`mm check-plugins`)

The `check-plugins` command scans all active collections and reports errors:
- If a warning or error occurs, the logger prints the **exact absolute path** of the file to ease debugging.
- The `$SCHEMA` and `$TIMESTAMP` placeholders are fully defeatured from prompt validation rules, so your prompt templates do not need to contain them explicitly to pass checks.
