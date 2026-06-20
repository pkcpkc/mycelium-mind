import { describe, it, expect } from "vitest";
import { getVaultWikiDir, listCollections, listOverviews, findInboundLinks } from "./utils.js";
import { handleToolCall } from "./handlers.js";

describe("Generic Collection & Overview MCP Tools", () => {
  const wikiDir = getVaultWikiDir("LLM-Wiki");

  describe("listCollections", () => {
    it("should discover the persons collection folder", async () => {
      const collections = await listCollections(wikiDir);
      expect(collections).toContain("persons");
      // Core folders should be excluded
      expect(collections).not.toContain("topics");
      expect(collections).not.toContain("summaries");
      expect(collections).not.toContain("reports");
      expect(collections).not.toContain("assets");
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
    it("should find links referencing a target across all subdirectories", async () => {
      // In topics/Andrej_Karpathy.md, there is a link to [[Geoff Hinton]]
      const inbound = await findInboundLinks(wikiDir, "Geoff Hinton");
      expect(inbound).toContain("Andrej Karpathy");
    });
  });

  describe("handleToolCall Dispatcher", () => {
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
      expect(data.title).toBe("timeline");
      expect(data.content).toBeDefined();
      expect(data.links.outbound_links).toBeDefined();
    });
  });
});
