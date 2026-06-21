import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { config, parseArgs } from "../config.js";

describe("config.ts Tests", () => {
  let originalArgv: string[];
  let originalRoot: string;
  let originalMode: "all" | "single";
  let originalName: string;

  beforeEach(() => {
    originalArgv = process.argv;
    originalRoot = config.vaultsRoot;
    originalMode = config.vaultMode;
    originalName = config.vaultName;
  });

  afterEach(() => {
    process.argv = originalArgv;
    config.vaultsRoot = originalRoot;
    config.vaultMode = originalMode;
    config.vaultName = originalName;
  });

  it("should parse --vault and trigger single mode", () => {
    process.argv = ["node", "index.js", "--vault=CustomVault", "--vaults-root=/tmp/vaults"];
    parseArgs();
    expect(config.vaultName).toBe("CustomVault");
    expect(config.vaultsRoot).toBe("/tmp/vaults");
    expect(config.vaultMode).toBe("single");
  });

  it("should parse --vault as a separate argument", () => {
    process.argv = ["node", "index.js", "--vault", "SecondVault", "--vaults-root", "/tmp/root2"];
    parseArgs();
    expect(config.vaultName).toBe("SecondVault");
    expect(config.vaultsRoot).toBe("/tmp/root2");
    expect(config.vaultMode).toBe("single");
  });

  it("should default to all mode if no vault is specified", () => {
    process.argv = ["node", "index.js", "--vaults-root=/tmp/vaults-all"];
    parseArgs();
    expect(config.vaultsRoot).toBe("/tmp/vaults-all");
    expect(config.vaultMode).toBe("all");
  });
});
