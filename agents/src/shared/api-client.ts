import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";
import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import { config } from './config.js';

export interface ToolResult<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
}

// Singleton MCP client
let mcpClient: Client | null = null;
let connectionPromise: Promise<Client> | null = null;

/**
 * Get or create an MCP client connection
 */
async function getMcpClient(): Promise<Client> {
  // Return existing client if connected
  if (mcpClient) {
    return mcpClient;
  }

  // Wait for existing connection attempt
  if (connectionPromise) {
    return connectionPromise;
  }

  // Start new connection
  connectionPromise = connectMcpClient();

  try {
    mcpClient = await connectionPromise;
    return mcpClient;
  } catch (error) {
    connectionPromise = null;
    throw error;
  }
}

/**
 * Connect to the MCP server
 */
async function connectMcpClient(): Promise<Client> {
  const mcpUrl = `${config.mcpServerUrl}/mcp`;
  console.log(`[MCP-Client] Connecting to MCP server at ${mcpUrl}`);

  const transport = new StreamableHTTPClientTransport(new URL(mcpUrl));

  const client = new Client(
    {
      name: "solarys-agent-client",
      version: "1.0.0",
    },
    {
      capabilities: {},
    }
  );

  await client.connect(transport);
  console.log(`[MCP-Client] Connected to MCP server`);

  return client;
}

/**
 * Call a tool via the MCP protocol
 */
export async function callTool<T = unknown>(
  toolName: string,
  params: Record<string, unknown> = {}
): Promise<ToolResult<T>> {
  console.log(`[MCP-Client] Calling tool: ${toolName}`, params);

  try {
    const client = await getMcpClient();

    const result = await client.callTool({
      name: toolName,
      arguments: params,
    }) as CallToolResult;

    // Parse the result from MCP format
    if (result.isError) {
      const errorContent = result.content.find((c: { type: string }) => c.type === 'text');
      const errorText = errorContent && 'text' in errorContent ? (errorContent as { text: string }).text : 'Unknown error';

      try {
        const errorData = JSON.parse(errorText);
        console.log(`[MCP-Client] Tool ${toolName} returned error:`, errorData);
        return {
          success: false,
          error: errorData.error || errorData.message || errorText,
        };
      } catch {
        return {
          success: false,
          error: errorText,
        };
      }
    }

    // Extract successful result
    const textContent = result.content.find((c: { type: string }) => c.type === 'text');
    if (textContent && 'text' in textContent) {
      const text = (textContent as { text: string }).text;
      try {
        const data = JSON.parse(text);
        console.log(`[MCP-Client] Tool ${toolName} succeeded`);
        return {
          success: true,
          data: data as T,
        };
      } catch {
        // Return raw text if not JSON
        return {
          success: true,
          data: text as unknown as T,
        };
      }
    }

    return {
      success: true,
      data: undefined,
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error(`[MCP-Client] Tool ${toolName} failed:`, errorMessage);

    // Reset client on connection errors to allow reconnection
    if (errorMessage.includes('connect') || errorMessage.includes('ECONNREFUSED')) {
      mcpClient = null;
      connectionPromise = null;
    }

    return {
      success: false,
      error: errorMessage,
    };
  }
}

/**
 * List available tools via MCP protocol
 */
export async function listTools(): Promise<{ name: string; description: string }[]> {
  try {
    const client = await getMcpClient();
    const result = await client.listTools();

    return result.tools.map(tool => ({
      name: tool.name,
      description: tool.description || '',
    }));
  } catch (error) {
    console.error('[MCP-Client] Failed to list tools:', error);
    return [];
  }
}

/**
 * Close the MCP client connection
 */
export async function closeMcpClient(): Promise<void> {
  if (mcpClient) {
    await mcpClient.close();
    mcpClient = null;
    connectionPromise = null;
    console.log(`[MCP-Client] Connection closed`);
  }
}
