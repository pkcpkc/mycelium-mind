import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { getVaultWikiDir } from "../utils.js";
import { handleToolCall } from "../handlers.js";
import { config } from "../config.js";
import { fileURLToPath } from "url";
import * as path from "path";
import * as fs from "fs/promises";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const TEST_ROOT = path.resolve(__dirname, "../../temp-vaults");

async function setupMockVault() {
  const vaultPath = path.join(TEST_ROOT, "LLM-Wiki");
  const wikiDir = path.join(vaultPath, "wiki");

  // Create directories
  await fs.mkdir(path.join(wikiDir, "concepts"), { recursive: true });
  await fs.mkdir(path.join(wikiDir, "persons"), { recursive: true });
  await fs.mkdir(path.join(wikiDir, "summaries"), { recursive: true });
  await fs.mkdir(path.join(wikiDir, "reports"), { recursive: true });
  await fs.mkdir(path.join(wikiDir, "assets"), { recursive: true });

  // Create files
  await fs.writeFile(
    path.join(wikiDir, "timeline.md"),
    `---
title: "Timeline Schema"
---
# Timeline`
  );

  await fs.writeFile(
    path.join(wikiDir, "social-graph.md"),
    `# Social Graph`
  );

  await fs.writeFile(
    path.join(wikiDir, "index.md"),
    `# Index`
  );

  await fs.writeFile(
    path.join(wikiDir, "summaries", "summary1.md"),
    `---
type: "Summary"
title: "Summary Title"
resource: "assets/2026-06-21/summary1.md"
timestamp: "2026-06-21T00:00:00Z"
entities:
  concepts: ["Arxiv"]
  persons: ["Andrej Karpathy"]
---
# Summary 1`
  );

  await fs.writeFile(
    path.join(wikiDir, "concepts", "Arxiv.md"),
    `---
type: "Concept"
title: "Arxiv"
tags: ["preprint"]
timestamp: "2026-06-21T00:00:00Z"
---
# Arxiv`
  );

  await fs.writeFile(
    path.join(wikiDir, "persons", "Andrej_Karpathy.md"),
    `---
type: "Person"
title: "Andrej Karpathy"
tags: ["researcher"]
timestamp: "2026-06-21T00:00:00Z"
---
# Andrej Karpathy
He worked with [[Geoffrey Hinton]] and [[Fei-Fei Li]].`
  );

  await fs.writeFile(
    path.join(wikiDir, "persons", "Fei-Fei_Li.md"),
    `---
type: "Person"
title: "Fei-Fei Li"
tags: ["researcher"]
timestamp: "2026-06-21T00:00:00Z"
---
# Fei-Fei Li`
  );

  await fs.writeFile(
    path.join(wikiDir, "persons", "Geoffrey_Hinton.md"),
    `---
type: "Person"
title: "Geoffrey Hinton"
timestamp: "2026-06-21T00:00:00Z"
---
# Geoffrey Hinton`
  );
}

describe("handlers.ts Dispatcher Tests", () => {
  beforeAll(async () => {
    config.vaultsRoot = TEST_ROOT;
    config.vaultMode = "all";
    config.vaultName = "LLM-Wiki";
    await setupMockVault();
  });

  afterAll(async () => {
    await fs.rm(TEST_ROOT, { recursive: true, force: true });
  });

  it("should handle get_collections", async () => {
    const response = await handleToolCall("get_collections", { vault_name: "LLM-Wiki" });
    const data = JSON.parse(response.content[0].text);
    expect(data.collections).toContain("persons");
  });

  it("should handle get_collection_items", async () => {
    const response = await handleToolCall("get_collection_items", {
      vault_name: "LLM-Wiki",
      collection: "persons",
    });
    const data = JSON.parse(response.content[0].text);
    expect(data.collection).toBe("persons");
    expect(data.items.length).toBeGreaterThan(0);
    expect(data.items.map((i: any) => i.title)).toContain("Andrej Karpathy");
  });

  it("should handle get_collection_item", async () => {
    const response = await handleToolCall("get_collection_item", {
      vault_name: "LLM-Wiki",
      collection: "persons",
      title: "Andrej Karpathy",
    });
    const data = JSON.parse(response.content[0].text);
    expect(data.title).toBe("Andrej Karpathy");
    expect(data.content).toContain("Andrej Karpathy");
    expect(data.links.inbound_links).toBeDefined();
  });

  it("should handle get_overviews", async () => {
    const response = await handleToolCall("get_overviews", { vault_name: "LLM-Wiki" });
    const data = JSON.parse(response.content[0].text);
    expect(data.overviews).toContain("timeline");
    expect(data.overviews).toContain("social-graph");
  });

  it("should handle get_overview", async () => {
    const response = await handleToolCall("get_overview", {
      vault_name: "LLM-Wiki",
      title: "timeline",
    });
    const data = JSON.parse(response.content[0].text);
    expect(data.title).toBe("Timeline Schema");
    expect(data.content).toBeDefined();
    expect(data.links.outbound_links).toBeDefined();
  });

  it("should handle get_tags", async () => {
    const response = await handleToolCall("get_tags", { vault_name: "LLM-Wiki" });
    const data = JSON.parse(response.content[0].text);
    expect(data.vault).toBe("LLM-Wiki");
    expect(data.tags).toBeDefined();
    expect(data.tags.length).toBeGreaterThan(0);
    
    const tagNames = data.tags.map((t: any) => t.tag);
    expect(tagNames).toContain("preprint");
    expect(tagNames).toContain("researcher");
  });

  it("should handle get_tagged_documents", async () => {
    const response = await handleToolCall("get_tagged_documents", {
      vault_name: "LLM-Wiki",
      tag: "preprint",
    });
    const data = JSON.parse(response.content[0].text);
    expect(data.vault).toBe("LLM-Wiki");
    expect(data.tag).toBe("preprint");
    expect(data.documents).toBeDefined();
    expect(data.documents.length).toBeGreaterThan(0);

    const docTitles = data.documents.map((d: any) => d.title);
    expect(docTitles).toContain("Arxiv");
  });

  it("should handle get_vault_entities", async () => {
    const response = await handleToolCall("get_vault_entities", {
      vault_name: "LLM-Wiki",
      entity_type: "concepts",
    });
    const data = JSON.parse(response.content[0].text);
    expect(data.vault).toBe("LLM-Wiki");
    expect(data.entity_type).toBe("concepts");
    expect(data.entities).toBeDefined();
    expect(data.entities).toContain("Arxiv");
  });

  it("should handle check_note_status", async () => {
    const response = await handleToolCall("check_note_status", {
      vault_name: "LLM-Wiki",
      entity_name: "Arxiv",
      entity_type: "concepts",
    });
    const data = JSON.parse(response.content[0].text);
    expect(data.vault).toBe("LLM-Wiki");
    expect(data.entity_name).toBe("Arxiv");
    expect(data.exists).toBe(true);
    expect(data.outdated).toBeDefined();
  });

  it("should handle audit_vault_integrity", async () => {
    const response = await handleToolCall("audit_vault_integrity", {
      vault_name: "LLM-Wiki",
    });
    const data = JSON.parse(response.content[0].text);
    expect(data.vault).toBe("LLM-Wiki");
    expect(data.complianceScore).toContain("OKF Compliance");
    expect(data.issues).toBeDefined();
  });

  it("should handle get_social_network", async () => {
    const response = await handleToolCall("get_social_network", {
      vault_name: "LLM-Wiki",
    });
    const data = JSON.parse(response.content[0].text);
    expect(data.vault).toBe("LLM-Wiki");
    expect(data.nodes).toBeDefined();
    expect(data.edges).toBeDefined();

    const nodeNames = data.nodes.map((n: any) => n.name);
    expect(nodeNames).toContain("Andrej Karpathy");

    const hasConnection = data.edges.length > 0;
    expect(hasConnection).toBe(true);
  });
});
