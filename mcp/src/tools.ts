import { McpConfig } from "./config.js";

/**
 * Builds the tool definitions array for the ListToolsRequestSchema handler.
 * Adapts required parameters based on vault mode (single vs multi).
 */
export function getToolDefinitions(config: McpConfig) {
  const vaultNameProp = {
    type: "string",
    description: config.vaultMode === "single"
      ? "Optional and ignored. Defaults strictly to configured vault."
      : "Required. The name of the target vault.",
  };

  const tools = [];

  // Expose get_vaults ONLY in multi-vault ("all") mode
  if (config.vaultMode === "all") {
    tools.push({
      name: "get_vaults",
      description: "Discovers and lists all configured vaults in the Mycelium Mind environment.",
      inputSchema: { type: "object", properties: {} },
    });
  }

  tools.push(
    {
      name: "get_topics",
      description: "Lists all topic nodes in the specified vault.",
      inputSchema: {
        type: "object",
        properties: { vault_name: vaultNameProp },
        required: config.vaultMode === "all" ? ["vault_name"] : [],
      },
    },
    {
      name: "get_topic_details",
      description: "Retrieves metadata, content, and inbound/outbound links for a topic node.",
      inputSchema: {
        type: "object",
        properties: {
          vault_name: vaultNameProp,
          title: { type: "string", description: "The title of the topic (e.g. 'Enigma Machine')" },
        },
        required: config.vaultMode === "all" ? ["vault_name", "title"] : ["title"],
      },
    },
    {
      name: "get_summaries",
      description: "Lists all ingested document summaries in the specified vault.",
      inputSchema: {
        type: "object",
        properties: { vault_name: vaultNameProp },
        required: config.vaultMode === "all" ? ["vault_name"] : [],
      },
    },
    {
      name: "get_summary",
      description: "Retrieves complete content, clean wikilinks, metadata, and original source asset titles for an entry.",
      inputSchema: {
        type: "object",
        properties: {
          vault_name: vaultNameProp,
          title: { type: "string", description: "The title of the summary" },
        },
        required: config.vaultMode === "all" ? ["vault_name", "title"] : ["title"],
      },
    },
    {
      name: "get_reports",
      description: "Lists all compiled cross-vault thematic reports in the specified vault.",
      inputSchema: {
        type: "object",
        properties: { vault_name: vaultNameProp },
        required: config.vaultMode === "all" ? ["vault_name"] : [],
      },
    },
    {
      name: "get_report",
      description: "Retrieves comprehensive synthesis report content and clean links.",
      inputSchema: {
        type: "object",
        properties: {
          vault_name: vaultNameProp,
          title: { type: "string", description: "The title of the report" },
        },
        required: config.vaultMode === "all" ? ["vault_name", "title"] : ["title"],
      },
    },
    {
      name: "get_collections",
      description: "Discovers and lists all custom sub-collections in the specified vault (e.g. persons).",
      inputSchema: {
        type: "object",
        properties: { vault_name: vaultNameProp },
        required: config.vaultMode === "all" ? ["vault_name"] : [],
      },
    },
    {
      name: "get_collection_items",
      description: "Lists all item titles in a named sub-collection.",
      inputSchema: {
        type: "object",
        properties: {
          vault_name: vaultNameProp,
          collection: { type: "string", description: "The collection directory name (e.g. 'persons')" },
        },
        required: config.vaultMode === "all" ? ["vault_name", "collection"] : ["collection"],
      },
    },
    {
      name: "get_collection_item",
      description: "Retrieves metadata, content, and inbound/outbound links for an item in a custom collection.",
      inputSchema: {
        type: "object",
        properties: {
          vault_name: vaultNameProp,
          collection: { type: "string", description: "The collection directory name (e.g. 'persons')" },
          title: { type: "string", description: "The title/filename of the collection item" },
        },
        required: config.vaultMode === "all" ? ["vault_name", "collection", "title"] : ["collection", "title"],
      },
    },
    {
      name: "get_overviews",
      description: "Discovers and lists all root-level overview pages (excluding index.md).",
      inputSchema: {
        type: "object",
        properties: { vault_name: vaultNameProp },
        required: config.vaultMode === "all" ? ["vault_name"] : [],
      },
    },
    {
      name: "get_overview",
      description: "Retrieves content and inbound/outbound links for a root-level overview page.",
      inputSchema: {
        type: "object",
        properties: {
          vault_name: vaultNameProp,
          title: { type: "string", description: "The title of the overview page (e.g. 'timeline')" },
        },
        required: config.vaultMode === "all" ? ["vault_name", "title"] : ["title"],
      },
    },
  );

  return tools;
}
