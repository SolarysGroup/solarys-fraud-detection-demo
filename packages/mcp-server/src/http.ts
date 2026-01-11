#!/usr/bin/env node

import { config as dotenvConfig } from 'dotenv';
import { dirname, resolve } from 'path';
import { fileURLToPath } from 'url';

// Load .env from monorepo root
const __dirname = dirname(fileURLToPath(import.meta.url));
const envPath = resolve(__dirname, '../../../.env');
console.log('[MCP Server] Loading .env from:', envPath);
dotenvConfig({ path: envPath });
console.log('[MCP Server] DATABASE_URL loaded:', !!process.env.DATABASE_URL);

import express from 'express';
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  type CallToolRequest,
  type CallToolResult,
} from "@modelcontextprotocol/sdk/types.js";
import { tools, logToolCall } from "@solarys/tools";

// Railway provides PORT env var - use it, otherwise fall back to MCP_SERVER_PORT or default
const MCP_PORT = parseInt(process.env.PORT || process.env.MCP_SERVER_PORT || '3004', 10);

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

// Create and configure MCP server
function createMcpServer(): Server {
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

  // Route tool calls to handlers with audit logging
  server.setRequestHandler(
    CallToolRequestSchema,
    async (request: CallToolRequest) => {
      const { name, arguments: args } = request.params;
      const startTime = Date.now();

      console.log(`[MCP Server] Tool call: ${name}`, args);

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

        console.log(`[MCP Server] Tool ${name} completed in ${duration}ms`);

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

        console.error(`[MCP Server] Tool ${name} failed:`, errorMessage);

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

  return server;
}

// Start HTTP server
async function main() {
  const app = express();
  app.use(express.json());

  // Create MCP server
  const mcpServer = createMcpServer();

  // Create stateless HTTP transport (new transport per request)
  // For a stateless server, we handle each request independently
  const transports = new Map<string, StreamableHTTPServerTransport>();

  // Handle MCP requests via POST
  app.post('/mcp', async (req, res) => {
    console.log('[MCP Server] Received request');

    try {
      // Create a new transport for this request (stateless mode)
      const transport = new StreamableHTTPServerTransport({
        sessionIdGenerator: undefined, // Stateless mode
      });

      // Connect server to transport
      await mcpServer.connect(transport);

      // Handle the request
      await transport.handleRequest(req, res, req.body);
    } catch (error) {
      console.error('[MCP Server] Request error:', error);
      if (!res.headersSent) {
        res.status(500).json({ error: 'Internal server error' });
      }
    }
  });

  // Handle GET requests for SSE streaming (if needed)
  app.get('/mcp', async (req, res) => {
    console.log('[MCP Server] SSE connection request');

    try {
      const transport = new StreamableHTTPServerTransport({
        sessionIdGenerator: undefined,
      });

      await mcpServer.connect(transport);
      await transport.handleRequest(req, res);
    } catch (error) {
      console.error('[MCP Server] SSE error:', error);
      if (!res.headersSent) {
        res.status(500).json({ error: 'Internal server error' });
      }
    }
  });

  // Root route for Railway health check (default path)
  app.get('/', (req, res) => {
    res.json({ status: 'ok', service: 'mcp-server' });
  });

  // Health check endpoint
  app.get('/health', (req, res) => {
    res.json({ status: 'ok', service: 'mcp-server', transport: 'http' });
  });

  // List available tools endpoint (for debugging)
  app.get('/tools', (req, res) => {
    res.json({
      tools: tools.map((t) => ({
        name: t.definition.name,
        description: t.definition.description,
      })),
    });
  });

  app.listen(MCP_PORT, '0.0.0.0', () => {
    console.log(`[MCP Server] Running on http://0.0.0.0:${MCP_PORT}`);
    console.log(`[MCP Server] MCP endpoint: http://localhost:${MCP_PORT}/mcp`);
    console.log(`[MCP Server] Health check: http://localhost:${MCP_PORT}/health`);
    console.log(`[MCP Server] Tools list: http://localhost:${MCP_PORT}/tools`);
    console.log(`[MCP Server] Available tools: ${tools.map((t) => t.definition.name).join(', ')}`);
  });
}

main().catch((error) => {
  console.error("Fatal error:", error);
  process.exit(1);
});
