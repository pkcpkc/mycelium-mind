import { describe, it, expect } from "vitest";
import { getToolDefinitions } from "../tools.js";
import { McpConfig } from "../config.js";

describe("tools.ts Tests", () => {
  it("should return get_vaults and require vault_name in multi-vault ('all') mode", () => {
    const mockConfig: McpConfig = {
      vaultMode: "all",
      vaultName: "LLM-Wiki",
      vaultsRoot: "../Vaults",
    };

    const definitions = getToolDefinitions(mockConfig);
    
    // get_vaults should be defined
    const hasGetVaults = definitions.some(t => t.name === "get_vaults");
    expect(hasGetVaults).toBe(true);

    // Other tools should require vault_name
    const getConcepts = definitions.find(t => t.name === "get_concepts");
    expect(getConcepts).toBeDefined();
    expect(getConcepts?.inputSchema.required).toContain("vault_name");
  });

  it("should omit get_vaults and not require vault_name in single-vault mode", () => {
    const mockConfig: McpConfig = {
      vaultMode: "single",
      vaultName: "LLM-Wiki",
      vaultsRoot: "../Vaults",
    };

    const definitions = getToolDefinitions(mockConfig);
    
    // get_vaults should NOT be defined
    const hasGetVaults = definitions.some(t => t.name === "get_vaults");
    expect(hasGetVaults).toBe(false);

    // Other tools should not require vault_name
    const getConcepts = definitions.find(t => t.name === "get_concepts");
    expect(getConcepts).toBeDefined();
    expect(getConcepts?.inputSchema.required).not.toContain("vault_name");
  });
});
