import { describe, it, expect } from "vitest";
import { sanitizeWikilinks, cleanContentBody } from "./index.js";

describe("Mycelium Mind MCP Server Core Logic", () => {
  describe("sanitizeWikilinks (Obsidian Wikilink Parser)", () => {
    it("should extract a basic wikilink without brackets", () => {
      const input = "This is a reference to [[Alan Turing]] in the wiki.";
      const result = sanitizeWikilinks(input);
      expect(result).toEqual(["Alan Turing"]);
    });

    it("should extract page name from aliased wikilinks", () => {
      const input = "Read more about the [[Enigma Machine|rotor cipher system]].";
      const result = sanitizeWikilinks(input);
      expect(result).toEqual(["Enigma Machine"]);
    });

    it("should harvest multiple unique wikilinks", () => {
      const input = "Comparing [[Alan Turing]] and [[Grace Hopper]] early work.";
      const result = sanitizeWikilinks(input);
      expect(result).toEqual(["Alan Turing", "Grace Hopper"]);
    });

    it("should deduplicate harvested wikilinks", () => {
      const input = "Referencing [[Alan Turing]] multiple times: [[Alan Turing]].";
      const result = sanitizeWikilinks(input);
      expect(result).toEqual(["Alan Turing"]);
    });

    it("should return empty array for empty inputs or text with no links", () => {
      expect(sanitizeWikilinks("")).toEqual([]);
      expect(sanitizeWikilinks("Prose text with zero double brackets.")).toEqual([]);
    });
  });

  describe("cleanContentBody (Markdown Double-Bracket Body Scrubbing)", () => {
    it("should remove double brackets leaving plain page names in content body", () => {
      const input = "We must explore [[Alan Turing]] to learn computing history.";
      const result = cleanContentBody(input);
      expect(result).toBe("We must explore Alan Turing to learn computing history.");
    });

    it("should substitute aliases correctly inside the body text", () => {
      const input = "They parsed the cipher via the [[Enigma Machine|Germany rotor cipher]].";
      const result = cleanContentBody(input);
      expect(result).toBe("They parsed the cipher via the Germany rotor cipher.");
    });

    it("should clean complex text with multiple links and aliases", () => {
      const input = "Work by [[Alan Turing]] led to [[Colossus computer|Colossus]] and eventually modern [[Machine Learning|ML]].";
      const result = cleanContentBody(input);
      expect(result).toBe("Work by Alan Turing led to Colossus and eventually modern ML.");
    });

    it("should return original text if no brackets exist", () => {
      const input = "Standard prose with simple text details.";
      expect(cleanContentBody(input)).toBe(input);
    });

    it("should return empty string for empty inputs", () => {
      expect(cleanContentBody("")).toBe("");
    });
  });
});
