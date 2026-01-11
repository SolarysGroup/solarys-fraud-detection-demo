import { ClientFactory } from '@a2a-js/sdk/client';
import type { MessageSendParams, Task, Message, TaskStatusUpdateEvent } from '@a2a-js/sdk';
import type { ExecutionEventBus } from '@a2a-js/sdk/server';
import { v4 as uuidv4 } from 'uuid';
import { config } from './config.js';

/**
 * Helper to publish structured events via A2A status-update
 */
function publishStructuredEvent(
  eventBus: ExecutionEventBus,
  taskId: string,
  contextId: string,
  data: Record<string, unknown>
): void {
  const update: TaskStatusUpdateEvent = {
    kind: 'status-update',
    taskId: taskId,
    contextId: contextId,
    status: {
      state: 'working',
      message: {
        kind: 'message',
        role: 'agent',
        messageId: uuidv4(),
        parts: [{ kind: 'text', text: JSON.stringify(data) }],
        taskId: taskId,
        contextId: contextId,
      },
      timestamp: new Date().toISOString(),
    },
    final: false,
  };
  eventBus.publish(update);
}

/**
 * Extract text from a Task or Message response
 */
function extractResponseText(result: Task | Message): string {
  if ('status' in result && 'id' in result) {
    // It's a Task
    const task = result as Task;
    if (task.status.message) {
      const textPart = task.status.message.parts.find((p) => p.kind === 'text');
      return textPart && 'text' in textPart ? textPart.text : 'No text in response';
    } else if (task.history && task.history.length > 0) {
      const agentMessages = task.history.filter((m) => m.role === 'agent');
      if (agentMessages.length > 0) {
        const lastMessage = agentMessages[agentMessages.length - 1];
        const textPart = lastMessage.parts.find((p) => p.kind === 'text');
        return textPart && 'text' in textPart ? textPart.text : 'No text in response';
      }
    }
    return 'Investigation complete but no details available';
  } else {
    // It's a Message
    const message = result as Message;
    const textPart = message.parts.find((p) => p.kind === 'text');
    return textPart && 'text' in textPart ? textPart.text : 'No text in response';
  }
}

/**
 * A2A Client for agent-to-agent communication
 * Delegates requests to the Claims Investigation Agent via A2A protocol
 */
export async function callInvestigationAgent(request: string): Promise<string> {
  const investigationAgentUrl = config.investigationAgentUrl;

  console.log(`[A2A-Client] Delegating to Investigation Agent at ${investigationAgentUrl}`);
  console.log(`[A2A-Client] Request: ${request}`);

  try {
    // Create A2A client using ClientFactory
    const factory = new ClientFactory();
    const client = await factory.createFromUrl(investigationAgentUrl);

    // Build message send params
    const sendParams: MessageSendParams = {
      message: {
        messageId: uuidv4(),
        role: 'user',
        parts: [{ kind: 'text', text: request }],
        kind: 'message',
      },
    };

    // Send message to Investigation Agent
    console.log(`[A2A-Client] Sending A2A message...`);
    const result = await client.sendMessage(sendParams);

    const responseText = extractResponseText(result);
    console.log(`[A2A-Client] Investigation Agent response received (${responseText.length} chars)`);
    return responseText;
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error(`[A2A-Client] Error calling Investigation Agent:`, errorMessage);
    return `Error delegating to Investigation Agent: ${errorMessage}`;
  }
}

/**
 * A2A Client with event emission for protocol visualization
 * Emits structured events as the Investigation Agent works
 */
export async function callInvestigationAgentWithEvents(
  request: string,
  eventBus: ExecutionEventBus,
  taskId: string,
  contextId: string
): Promise<string> {
  const investigationAgentUrl = config.investigationAgentUrl;

  console.log(`[A2A-Client] Delegating to Investigation Agent at ${investigationAgentUrl}`);
  console.log(`[A2A-Client] Request: ${request}`);

  // Emit that Investigation Agent is now active
  publishStructuredEvent(eventBus, taskId, contextId, {
    type: 'agent_active',
    agent: 'investigation',
    vendor: 'google',
    status: 'working',
  });

  try {
    const factory = new ClientFactory();
    const client = await factory.createFromUrl(investigationAgentUrl);

    const sendParams: MessageSendParams = {
      message: {
        messageId: uuidv4(),
        role: 'user',
        parts: [{ kind: 'text', text: request }],
        kind: 'message',
      },
    };

    console.log(`[A2A-Client] Sending A2A message with streaming...`);

    // Use streaming to get real-time updates from Investigation Agent
    const stream = client.sendMessageStream(sendParams);
    let responseText = '';

    for await (const event of stream) {
      console.log(`[A2A-Client] Investigation Agent event: ${event.kind}`);

      if (event.kind === 'task') {
        const task = event as Task;
        if (task.status.state === 'completed' && task.status.message) {
          responseText = extractResponseText(task);
        }
      } else if (event.kind === 'status-update') {
        const statusUpdate = event as TaskStatusUpdateEvent;

        // Check if the Investigation Agent is emitting structured events
        if (statusUpdate.status.message) {
          const textPart = statusUpdate.status.message.parts.find((p) => p.kind === 'text');
          if (textPart && 'text' in textPart) {
            try {
              const parsed = JSON.parse(textPart.text);
              if (parsed && typeof parsed === 'object' && 'type' in parsed) {
                console.log(`[A2A-Client] Forwarding Investigation Agent event: ${parsed.type}`);
                // Forward structured events from Investigation Agent
                // Update the agent field to ensure it's marked as investigation
                if (parsed.type === 'mcp_tool') {
                  publishStructuredEvent(eventBus, taskId, contextId, {
                    ...parsed,
                    agent: 'investigation',
                  });
                } else {
                  publishStructuredEvent(eventBus, taskId, contextId, parsed);
                }
              }
            } catch {
              // Not a structured event, might be progress text
              console.log(`[A2A-Client] Non-JSON event from Investigation Agent`);
            }
          }
        }

        // If this is the final status, extract the response
        if (statusUpdate.final && statusUpdate.status.message) {
          const text = extractResponseText({
            kind: 'message',
            messageId: uuidv4(),
            role: 'agent',
            parts: statusUpdate.status.message.parts,
          } as Message);
          if (text && !text.startsWith('{')) {
            responseText = text;
          }
        }
      } else if (event.kind === 'message') {
        responseText = extractResponseText(event as Message);
      }
    }

    // Emit that Investigation Agent completed
    publishStructuredEvent(eventBus, taskId, contextId, {
      type: 'agent_active',
      agent: 'investigation',
      vendor: 'google',
      status: 'completed',
    });

    console.log(`[A2A-Client] Investigation Agent response received (${responseText.length} chars)`);
    return responseText || 'Investigation complete but no details available';
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error(`[A2A-Client] Error calling Investigation Agent:`, errorMessage);

    // Emit error status for Investigation Agent
    publishStructuredEvent(eventBus, taskId, contextId, {
      type: 'agent_active',
      agent: 'investigation',
      vendor: 'google',
      status: 'completed',
    });

    return `Error delegating to Investigation Agent: ${errorMessage}`;
  }
}
