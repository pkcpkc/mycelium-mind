import * as path from "path";
import { fileURLToPath } from "url";

// Emulate __dirname for ES Modules
const __filename = fileURLToPath(import.meta.url);
export const __dirname = path.dirname(__filename);

// Configuration Interface
export interface McpConfig {
  vaultMode: "all" | "single";
  vaultName: string;
  vaultsRoot: string;
}

export const config: McpConfig = {
  vaultMode: "all",
  vaultName: "LLM-Wiki",
  vaultsRoot: "../Vaults",
};

// Parse command line arguments for configuration
export function parseArgs(): void {
  const args = process.argv.slice(2);
  let vaultSpecified = false;

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg.startsWith("--vault=")) {
      config.vaultName = arg.split("=")[1];
      vaultSpecified = true;
    } else if (arg === "--vault" && i + 1 < args.length) {
      config.vaultName = args[++i];
      vaultSpecified = true;
    } else if (arg.startsWith("--vaults-root=")) {
      config.vaultsRoot = arg.split("=")[1];
    } else if (arg === "--vaults-root" && i + 1 < args.length) {
      config.vaultsRoot = args[++i];
    }
  }

  // If a specific vault is provided, implicitly run in single-vault mode
  config.vaultMode = vaultSpecified ? "single" : "all";

  console.error(`MCP Server started. Mode: ${config.vaultMode}, Target Vault: ${config.vaultName}, Root: ${config.vaultsRoot}`);
}
