#!/usr/bin/env node

import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  type CallToolRequest,
  type CallToolResult,
} from "@modelcontextprotocol/sdk/types.js";
import { tools, logToolCall } from "@solarys/tools";

// Create MCP server
const server = new Server(
  {
    name: "solarys-fraud-detection",
    version: "0.1.0",
  },
  {
    capabilities: {
      tools: {},
    },
  }
);

// Register tool definitions
server.setRequestHandler(ListToolsRequestSchema, async () => ({
  tools: tools.map((tool) => tool.definition),
}));

// Helper to convert tool result to MCP format
function toMcpResult(result: { success: boolean; data?: unknown; error?: string }): CallToolResult {
  if (!result.success) {
    return {
      content: [
        {
          type: "text",
          text: JSON.stringify({ error: result.error }),
        },
      ],
      isError: true,
    };
  }

  return {
    content: [
      {
        type: "text",
        text: JSON.stringify(result.data, null, 2),
      },
    ],
  };
}

// Route tool calls to handlers with audit logging
server.setRequestHandler(
  CallToolRequestSchema,
  async (request: CallToolRequest) => {
    const { name, arguments: args } = request.params;
    const startTime = Date.now();

    const tool = tools.find((t) => t.definition.name === name);

    if (!tool) {
      const errorResult: CallToolResult = {
        content: [
          {
            type: "text",
            text: JSON.stringify({ error: `Unknown tool: ${name}` }),
          },
        ],
        isError: true,
      };

      logToolCall(
        name,
        (args as Record<string, unknown>) ?? {},
        errorResult,
        Date.now() - startTime,
        false
      );

      return errorResult;
    }

    // Validate input against schema
    const parsed = tool.schema.safeParse(args);
    if (!parsed.success) {
      const errorResult: CallToolResult = {
        content: [
          {
            type: "text",
            text: JSON.stringify({ error: `Invalid input: ${parsed.error.message}` }),
          },
        ],
        isError: true,
      };

      logToolCall(
        name,
        (args as Record<string, unknown>) ?? {},
        errorResult,
        Date.now() - startTime,
        false
      );

      return errorResult;
    }

    // Execute handler with timing
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const result = await tool.handler(parsed.data as any);
      const duration = Date.now() - startTime;
      const mcpResult = toMcpResult(result);

      // Log successful execution (skip logging get_audit_log to avoid recursion)
      if (name !== "get_audit_log") {
        logToolCall(
          name,
          parsed.data as Record<string, unknown>,
          mcpResult,
          duration,
          result.success
        );
      }

      return mcpResult;
    } catch (error) {
      const duration = Date.now() - startTime;
      const errorMessage = error instanceof Error ? error.message : String(error);

      const errorResult: CallToolResult = {
        content: [
          {
            type: "text",
            text: JSON.stringify({ error: "Tool execution failed", message: errorMessage }),
          },
        ],
        isError: true,
      };

      logToolCall(
        name,
        parsed.data as Record<string, unknown>,
        errorResult,
        duration,
        false
      );

      return errorResult;
    }
  }
);

// Start server
async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error("Solarys Fraud Detection MCP Server running on stdio");
}

main().catch((error) => {
  console.error("Fatal error:", error);
  process.exit(1);
});
