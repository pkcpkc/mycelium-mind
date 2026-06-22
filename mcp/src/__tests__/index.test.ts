import { describe, it, expect } from "vitest";
import { sanitizeWikilinks, cleanContentBody, toSafeFilename, fromSafeFilename } from "../index.js";

describe("index.ts Exports Tests", () => {
  it("should export core utility functions correctly", () => {
    expect(sanitizeWikilinks).toBeDefined();
    expect(cleanContentBody).toBeDefined();
    expect(toSafeFilename).toBeDefined();
    expect(fromSafeFilename).toBeDefined();
  });

  it("should verify exports perform as expected", () => {
    const links = sanitizeWikilinks("Reference [[Alan Turing]]");
    expect(links).toEqual(["Alan Turing"]);

    const cleaned = cleanContentBody("A [[link|alias]]");
    expect(cleaned).toBe("A alias");

    const safeName = toSafeFilename("Test Concept");
    expect(safeName).toBe("Test Concept.md");

    const parsedName = fromSafeFilename("Test Concept.md");
    expect(parsedName).toBe("Test Concept");
  });
});
