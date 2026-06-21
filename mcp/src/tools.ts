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
      name: "get_concepts",
      description: "Lists all concept nodes in the specified vault.",
      inputSchema: {
        type: "object",
        properties: { vault_name: vaultNameProp },
        required: config.vaultMode === "all" ? ["vault_name"] : [],
      },
    },
    {
      name: "get_concept_details",
      description: "Retrieves metadata, content, and inbound/outbound links for a concept node.",
      inputSchema: {
        type: "object",
        properties: {
          vault_name: vaultNameProp,
          title: { type: "string", description: "The title of the concept (e.g. 'Enigma Machine')" },
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
    {
      name: "get_tags",
      description: "Lists all unique tags found in the YAML frontmatter of any markdown file in the vault, along with their usage counts.",
      inputSchema: {
        type: "object",
        properties: { vault_name: vaultNameProp },
        required: config.vaultMode === "all" ? ["vault_name"] : [],
      },
    },
    {
      name: "get_tagged_documents",
      description: "Lists all documents (concepts, summaries, reports, collections, overviews) that contain a specific tag in their YAML frontmatter.",
      inputSchema: {
        type: "object",
        properties: {
          vault_name: vaultNameProp,
          tag: { type: "string", description: "The tag to filter by (e.g. 'preprint')" },
        },
        required: config.vaultMode === "all" ? ["vault_name", "tag"] : ["tag"],
      },
    },
    {
      name: "get_vault_entities",
      description: "Lists all unique concept or person entities declared in the summaries of a vault.",
      inputSchema: {
        type: "object",
        properties: {
          vault_name: vaultNameProp,
          entity_type: {
            type: "string",
            enum: ["concepts", "persons"],
            description: "The type of entity to extract ('concepts' or 'persons')."
          }
        },
        required: config.vaultMode === "all" ? ["vault_name", "entity_type"] : ["entity_type"],
      },
    },
    {
      name: "check_note_status",
      description: "Checks if a concept or person note is missing or outdated compared to the summaries referencing it.",
      inputSchema: {
        type: "object",
        properties: {
          vault_name: vaultNameProp,
          entity_name: { type: "string", description: "The name of the concept or person entity." },
          entity_type: {
            type: "string",
            enum: ["concepts", "persons"],
            description: "The type of the entity ('concepts' or 'persons')."
          }
        },
        required: config.vaultMode === "all" ? ["vault_name", "entity_name", "entity_type"] : ["entity_name", "entity_type"],
      },
    },
    {
      name: "audit_vault_integrity",
      description: "Performs a vault-wide audit of compliance, schemas, broken wikilinks, orphaned files, and stub pages.",
      inputSchema: {
        type: "object",
        properties: { vault_name: vaultNameProp },
        required: config.vaultMode === "all" ? ["vault_name"] : [],
      },
    },
    {
      name: "get_social_network",
      description: "Extracts a nodes and edges representation of the collaborators listed in person notes.",
      inputSchema: {
        type: "object",
        properties: { vault_name: vaultNameProp },
        required: config.vaultMode === "all" ? ["vault_name"] : [],
      },
    },
  );

  return tools;
}
