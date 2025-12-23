import { ClientFactory } from '@a2a-js/sdk/client';
import type { MessageSendParams, Task, Message, TaskStatusUpdateEvent, TaskArtifactUpdateEvent } from '@a2a-js/sdk';
import { v4 as uuidv4 } from 'uuid';

const DETECTION_AGENT_URL = process.env.DETECTION_AGENT_URL || 'http://localhost:3002';

/**
 * A2A Event types that we emit to the frontend
 */
export type A2AEventType =
  | 'agent_active'
  | 'mcp_tool'
  | 'a2a_delegation'
  | 'thinking'
  | 'text'
  | 'done'
  | 'error';

export interface AgentActiveEvent {
  type: 'agent_active';
  agent: 'detection' | 'investigation';
  vendor: 'anthropic' | 'google';
  status: 'working' | 'completed' | 'idle';
}

export interface McpToolEvent {
  type: 'mcp_tool';
  agent: 'detection' | 'investigation';
  tool: string;
  status: 'start' | 'end';
  duration?: number;
  success?: boolean;
}

export interface A2ADelegationEvent {
  type: 'a2a_delegation';
  from: 'detection' | 'investigation';
  to: 'detection' | 'investigation';
}

export interface ThinkingEvent {
  type: 'thinking';
  agent: 'detection' | 'investigation';
  text: string;
}

export interface TextEvent {
  type: 'text';
  text: string;
}

export interface DoneEvent {
  type: 'done';
  taskId?: string;
}

export interface ErrorEvent {
  type: 'error';
  message: string;
}

export type A2AEvent =
  | AgentActiveEvent
  | McpToolEvent
  | A2ADelegationEvent
  | ThinkingEvent
  | TextEvent
  | DoneEvent
  | ErrorEvent;

/**
 * Parse structured event data from A2A status-update messages
 * Agents embed JSON in text parts for tool calls and delegations
 */
function parseStructuredEvent(text: string): { type: string; [key: string]: unknown } | null {
  try {
    const parsed = JSON.parse(text);
    if (parsed && typeof parsed === 'object' && 'type' in parsed) {
      return parsed;
    }
  } catch {
    // Not JSON, that's fine - it's just regular text
  }
  return null;
}

/**
 * Extract text from A2A Message parts
 */
function extractTextFromMessage(message: Message): string {
  const textParts = message.parts
    .filter((p) => p.kind === 'text')
    .map((p) => ('text' in p ? p.text : ''));
  return textParts.join('');
}

/**
 * Send a message to the Detection Agent via A2A protocol with streaming
 * Yields A2A events as they arrive
 */
export async function* sendToDetectionAgent(userMessage: string): AsyncGenerator<A2AEvent> {
  console.log(`[A2A-Client] Connecting to Detection Agent at ${DETECTION_AGENT_URL}`);

  try {
    const factory = new ClientFactory();
    const client = await factory.createFromUrl(DETECTION_AGENT_URL);

    const sendParams: MessageSendParams = {
      message: {
        messageId: uuidv4(),
        role: 'user',
        parts: [{ kind: 'text', text: userMessage }],
        kind: 'message',
      },
    };

    // Emit that Detection Agent is now active
    yield {
      type: 'agent_active',
      agent: 'detection',
      vendor: 'anthropic',
      status: 'working',
    };

    console.log(`[A2A-Client] Sending message via A2A streaming...`);

    // Use streaming to get real-time updates
    const stream = client.sendMessageStream(sendParams);
    let taskId: string | undefined;
    let finalText = '';

    for await (const event of stream) {
      console.log(`[A2A-Client] Received event: ${event.kind}`);

      if (event.kind === 'task') {
        const task = event as Task;
        taskId = task.id;
        console.log(`[A2A-Client] Task created: ${task.id}, status: ${task.status.state}`);

        // If task has a final message, extract and yield it
        if (task.status.message) {
          const text = extractTextFromMessage(task.status.message);
          if (text && task.status.state === 'completed') {
            finalText = text;
          }
        }
      } else if (event.kind === 'status-update') {
        const statusUpdate = event as TaskStatusUpdateEvent;
        console.log(`[A2A-Client] Status update: ${statusUpdate.status.state}`);

        if (statusUpdate.status.message) {
          const text = extractTextFromMessage(statusUpdate.status.message);

          // Check if this is a structured event (tool call, delegation, etc.)
          const structured = parseStructuredEvent(text);

          if (structured) {
            // Handle structured events
            if (structured.type === 'mcp_tool') {
              yield {
                type: 'mcp_tool',
                agent: (structured.agent as 'detection' | 'investigation') || 'detection',
                tool: structured.tool as string,
                status: structured.status as 'start' | 'end',
                duration: structured.duration as number | undefined,
                success: structured.success as boolean | undefined,
              };
            } else if (structured.type === 'a2a_delegation') {
              yield {
                type: 'a2a_delegation',
                from: structured.from as 'detection' | 'investigation',
                to: structured.to as 'detection' | 'investigation',
              };
              // Also emit that the target agent is now active
              yield {
                type: 'agent_active',
                agent: structured.to as 'detection' | 'investigation',
                vendor: structured.to === 'investigation' ? 'google' : 'anthropic',
                status: 'working',
              };
            } else if (structured.type === 'agent_active') {
              yield {
                type: 'agent_active',
                agent: structured.agent as 'detection' | 'investigation',
                vendor: structured.vendor as 'anthropic' | 'google',
                status: structured.status as 'working' | 'completed' | 'idle',
              };
            } else if (structured.type === 'thinking') {
              yield {
                type: 'thinking',
                agent: structured.agent as 'detection' | 'investigation',
                text: structured.text as string,
              };
            }
          } else if (text && !text.startsWith('{')) {
            // Regular text message - only yield non-empty, non-JSON text
            // Skip progress messages like "Analyzing..." or "Executing..."
            if (statusUpdate.final) {
              finalText = text;
            }
          }
        }

        // If this is the final status, emit done
        if (statusUpdate.final) {
          // Emit that detection agent completed
          yield {
            type: 'agent_active',
            agent: 'detection',
            vendor: 'anthropic',
            status: 'completed',
          };
        }
      } else if (event.kind === 'artifact-update') {
        // Handle artifact updates if needed
        const artifactUpdate = event as TaskArtifactUpdateEvent;
        console.log(`[A2A-Client] Artifact update:`, artifactUpdate);
      } else if (event.kind === 'message') {
        // Direct message response
        const message = event as Message;
        const text = extractTextFromMessage(message);
        if (text) {
          finalText = text;
        }
      }
    }

    // Emit the final text response
    if (finalText) {
      yield {
        type: 'text',
        text: finalText,
      };
    }

    yield {
      type: 'done',
      taskId,
    };

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error(`[A2A-Client] Error:`, errorMessage);
    yield {
      type: 'error',
      message: errorMessage,
    };
  }
}

/**
 * Send a message to the Detection Agent and wait for completion (non-streaming)
 * Returns the final response text
 */
export async function callDetectionAgent(userMessage: string): Promise<string> {
  let responseText = '';

  for await (const event of sendToDetectionAgent(userMessage)) {
    if (event.type === 'text') {
      responseText = event.text;
    } else if (event.type === 'error') {
      throw new Error(event.message);
    }
  }

  return responseText;
}
