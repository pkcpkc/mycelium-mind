import { describe, it, expect, beforeAll, afterAll } from "vitest";
import {
  sanitizeWikilinks,
  cleanContentBody,
  toSafeFilename,
  fromSafeFilename,
  getVaultWikiDir,
  listCollections,
  listOverviews,
  findInboundLinks,
} from "../utils.js";
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
    path.join(wikiDir, "persons", "Andrej Karpathy.md"),
    `---
title: "Andrej Karpathy"
---
# Andrej Karpathy
He worked with [[Geoffrey Hinton]].`
  );
}

describe("utils.ts Tests", () => {
  let wikiDir: string;

  beforeAll(async () => {
    config.vaultsRoot = TEST_ROOT;
    config.vaultMode = "all";
    config.vaultName = "LLM-Wiki";
    await setupMockVault();
    wikiDir = getVaultWikiDir("LLM-Wiki");
  });

  afterAll(async () => {
    await fs.rm(TEST_ROOT, { recursive: true, force: true });
  });

  describe("sanitizeWikilinks", () => {
    it("should extract a basic wikilink without brackets", () => {
      const input = "This is a reference to [[Alan Turing]] in the wiki.";
      expect(sanitizeWikilinks(input)).toEqual(["Alan Turing"]);
    });

    it("should extract page name from aliased wikilinks", () => {
      const input = "Read more about the [[Enigma Machine|rotor cipher system]].";
      expect(sanitizeWikilinks(input)).toEqual(["Enigma Machine"]);
    });

    it("should harvest multiple unique wikilinks", () => {
      const input = "Comparing [[Alan Turing]] and [[Grace Hopper]] early work.";
      expect(sanitizeWikilinks(input)).toEqual(["Alan Turing", "Grace Hopper"]);
    });
  });

  describe("cleanContentBody", () => {
    it("should remove double brackets leaving plain page names", () => {
      const input = "We must explore [[Alan Turing]] to learn computing history.";
      expect(cleanContentBody(input)).toBe("We must explore Alan Turing to learn computing history.");
    });

    it("should substitute aliases correctly", () => {
      const input = "They parsed the cipher via the [[Enigma Machine|Germany rotor cipher]].";
      expect(cleanContentBody(input)).toBe("They parsed the cipher via the Germany rotor cipher.");
    });
  });

  describe("toSafeFilename and fromSafeFilename", () => {
    it("should standardize title to safe filename", () => {
      expect(toSafeFilename("Andrej Karpathy")).toBe("Andrej Karpathy.md");
      expect(toSafeFilename("  Large Language Models  ")).toBe("Large Language Models.md");
    });

    it("should parse safe filename back to display title", () => {
      expect(fromSafeFilename("Andrej Karpathy.md")).toBe("Andrej Karpathy");
      expect(fromSafeFilename("persons/Andrej Karpathy.md")).toBe("Andrej Karpathy");
    });
  });

  describe("listCollections", () => {
    it("should discover the persons collection folder", async () => {
      const collections = await listCollections(wikiDir);
      expect(collections).toContain("persons");
      expect(collections).not.toContain("concepts");
    });
  });

  describe("listOverviews", () => {
    it("should discover the root md files except index.md", async () => {
      const overviews = await listOverviews(wikiDir);
      expect(overviews).toContain("timeline");
      expect(overviews).toContain("social-graph");
      expect(overviews).not.toContain("index");
    });
  });

  describe("findInboundLinks", () => {
    it("should find links referencing a target across directories", async () => {
      const inbound = await findInboundLinks(wikiDir, "Geoffrey Hinton");
      expect(inbound).toContain("Andrej Karpathy");
    });
  });
});
