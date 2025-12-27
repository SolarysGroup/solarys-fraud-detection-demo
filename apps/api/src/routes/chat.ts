import { Router } from "express";
import { sendToDetectionAgent, type A2AEvent } from "../lib/a2a-client.js";

const router = Router();

interface ChatRequest {
  messages: Array<{
    role: "user" | "assistant";
    content: string;
  }>;
}

/**
 * POST /api/chat - Chat with the Fraud Detection Agent via A2A protocol
 *
 * This route forwards messages to the Detection Agent (Claude) via A2A,
 * which may delegate to the Investigation Agent (Gemini) for deep analysis.
 *
 * SSE Events emitted:
 * - agent_active: Agent status changes (working/completed/idle)
 * - mcp_tool: Tool execution start/end
 * - a2a_delegation: Agent delegation events
 * - text: Final response text
 * - done: Stream complete
 * - error: Error occurred
 */
router.post("/", async (req, res) => {
  const { messages } = req.body as ChatRequest;

  if (!messages || !Array.isArray(messages)) {
    return res.status(400).json({ error: "messages array is required" });
  }

  // Build a combined message that preserves full context and conversation history
  // The frontend sends: [context + first question, ...history, new question]
  // We need to send all of this to the agent as a single coherent message
  let combinedMessage: string;

  if (messages.length === 1) {
    // Single message - just send it (includes context prefix if present)
    combinedMessage = messages[0]?.content || "";
  } else {
    // Multiple messages - combine them to preserve conversation flow
    // First message contains the system context, subsequent messages are the conversation
    const parts: string[] = [];

    for (const msg of messages) {
      if (msg.role === "user") {
        parts.push(`User: ${msg.content}`);
      } else {
        parts.push(`Assistant: ${msg.content}`);
      }
    }

    combinedMessage = parts.join("\n\n");
  }

  if (!combinedMessage.trim()) {
    return res.status(400).json({ error: "No message content found" });
  }

  // Set up SSE
  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");
  res.setHeader("Access-Control-Allow-Origin", "*");

  // Helper to send SSE events
  const sendEvent = (eventType: string, data: unknown) => {
    res.write(`event: ${eventType}\ndata: ${JSON.stringify(data)}\n\n`);
  };

  try {
    console.log(`[Chat Route] Sending message to Detection Agent via A2A...`);

    // Stream events from the Detection Agent
    for await (const event of sendToDetectionAgent(combinedMessage)) {
      // Forward A2A events to the frontend as SSE
      switch (event.type) {
        case 'agent_active':
          sendEvent('agent_active', {
            agent: event.agent,
            vendor: event.vendor,
            status: event.status,
          });
          break;

        case 'mcp_tool':
          sendEvent('mcp_tool', {
            agent: event.agent,
            tool: event.tool,
            status: event.status,
            duration: event.duration,
            success: event.success,
          });
          break;

        case 'a2a_delegation':
          sendEvent('a2a_delegation', {
            from: event.from,
            to: event.to,
          });
          break;

        case 'thinking':
          sendEvent('thinking', {
            agent: event.agent,
            text: event.text,
          });
          break;

        case 'text':
          sendEvent('text', { text: event.text });
          break;

        case 'done':
          sendEvent('done', { taskId: event.taskId });
          break;

        case 'error':
          sendEvent('error', { message: event.message });
          break;
      }
    }

    res.end();
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error("[Chat Route] Error:", errorMessage);
    sendEvent("error", { message: errorMessage });
    res.end();
  }
});

export default router;
