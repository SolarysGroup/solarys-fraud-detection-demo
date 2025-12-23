import { Router } from "express";
import { tools, logToolCall } from "@solarys/tools";

const router = Router();

// Get list of available tools
router.get("/", (_req, res) => {
  const toolList = tools.map((tool) => ({
    name: tool.definition.name,
    description: tool.definition.description,
    inputSchema: tool.definition.inputSchema,
  }));

  res.json({ tools: toolList });
});

// Execute a specific tool
router.post("/:toolName", async (req, res) => {
  const { toolName } = req.params;
  const args = req.body;
  const startTime = Date.now();

  const tool = tools.find((t) => t.definition.name === toolName);

  if (!tool) {
    return res.status(404).json({
      error: `Tool not found: ${toolName}`,
      availableTools: tools.map((t) => t.definition.name),
    });
  }

  // Validate input
  const parsed = tool.schema.safeParse(args);
  if (!parsed.success) {
    return res.status(400).json({
      error: "Invalid input",
      details: parsed.error.errors,
    });
  }

  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const result = await tool.handler(parsed.data as any);
    const duration = Date.now() - startTime;

    // Log the tool call (skip audit log to avoid recursion)
    if (toolName !== "get_audit_log") {
      logToolCall(
        toolName,
        parsed.data as Record<string, unknown>,
        result,
        duration,
        result.success
      );
    }

    if (!result.success) {
      return res.status(400).json({
        error: result.error,
        duration,
      });
    }

    return res.json({
      data: result.data,
      duration,
    });
  } catch (error) {
    const duration = Date.now() - startTime;
    const errorMessage = error instanceof Error ? error.message : String(error);

    logToolCall(
      toolName,
      parsed.data as Record<string, unknown>,
      { error: errorMessage },
      duration,
      false
    );

    return res.status(500).json({
      error: "Tool execution failed",
      message: errorMessage,
      duration,
    });
  }
});

export default router;
