# Custom Overviews & Sandbox Scripting ⚙️

Overviews are dynamic markdown dashboards and reports generated programmatically by running sandboxed JavaScript scripts against your wiki's compiled graph database.

---

## 🗺️ Script Ingestion & Execution Flow

When compiling overviews, Mycelium Mind:
1. Iterates through all files in `wiki/summaries/` and `wiki/collections/` and parses their frontmatter.
2. Constructs a unified wiki graph in memory.
3. Instantiates an isolated Node.js VM context (`node:vm` sandbox).
4. Runs the scripts inside `plugins/overviews/` using the sandbox context.
5. Emits the generated markdown pages to `wiki/overviews/<script-name>.md`.

```
  wiki/summaries/ & collections/ (frontmatters)
                     │
                     ▼
             Unified Memory Graph
                     │
                     ▼
           Isolated VM Context Sandbox
                     │
                     ▼
           plugins/overviews/*.js
                     │
                     ▼
            wiki/overviews/*.md
```

---

## 🛠️ Sandbox Environment API

Overview scripts run in a restricted VM sandbox with access to the following global helper methods:

- **`getCollection(key, filter)`**: Returns an array of compiled entity cards matching a specific collection name (e.g. `getCollection('persons')`). An optional `filter` matching key-value pairs in frontmatter can be supplied.
- **`getSummaries(filter)`**: Returns an array of parsed inbox summary pages.
- **`getConcepts(filter)`**: Shorthand wrapper to fetch concepts.
- **`getPagesByTag(tag, filter)`**: Returns all compiled entities containing a specific tag.
- **`writePage(pageName, frontmatter, markdownBody)`**: Outputs a markdown page to `wiki/overviews/<pageName>.md`. The compiler automatically appends a `type: "Overview"` header and a `timestamp` property detailing when the page was built.
- **`console`**: Exposes basic logging functions (`console.log`) directly to the shell console.

---

## 🔗 Default Overview Scripts

### 1. Social Graph (`social-graph.js`)

Scans all inbox summaries for `relationships` frontmatter fields (specifying `personA`, `relation`, and `personB`). 
It compiles:
- `wiki/overviews/social-graph.md`: A complete tabular directory mapping relationship registries and their source documents.
- `wiki/overviews/social-graph-graphic.md`: A visual page incorporating a **Mermaid flow chart** displaying connections.

### 2. Chronological Timeline (`timeline.js`)

Extracts `times` properties containing `date` and `event` specifications. 
It compiles:
- `wiki/overviews/timeline.md`: A tabular index listing dates grouped by year.
- `wiki/overviews/timeline-graphic.md`: An interactive chronological **Mermaid timeline chart** highlighting events.
