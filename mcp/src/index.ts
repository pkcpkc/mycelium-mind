import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";
import { config, parseArgs } from "./config.js";
import { getToolDefinitions } from "./tools.js";
import { handleToolCall } from "./handlers.js";

// Re-export utilities for external consumers (e.g. tests)
export { sanitizeWikilinks, cleanContentBody, toSafeFilename, fromSafeFilename } from "./utils.js";

// Initialize MCP Server
const server = new Server(
  {
    name: "mycelium-mind-mcp",
    version: "1.0.0",
  },
  {
    capabilities: {
      tools: {},
    },
  }
);

// Declare Tools to Client
server.setRequestHandler(ListToolsRequestSchema, async () => ({
  tools: getToolDefinitions(config),
}));

// Handle Tool Executions
server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;
  try {
    return await handleToolCall(name, (args as Record<string, any>) || {});
  } catch (error: any) {
    return {
      isError: true,
      content: [{ type: "text", text: JSON.stringify({ error: error.message }, null, 2) }],
    };
  }
});

// Bootstrap stdio Server Transport
async function main() {
  parseArgs();
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error("Mycelium Mind MCP Server successfully running on stdio.");
}

main().catch((err) => {
  console.error("Critical MCP server startup failure:", err);
  process.exit(1);
});
