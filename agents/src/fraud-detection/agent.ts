import { v4 as uuidv4 } from 'uuid';
import type { Task, TaskStatusUpdateEvent, Message } from '@a2a-js/sdk';
import type { AgentExecutor, RequestContext, ExecutionEventBus } from '@a2a-js/sdk/server';
import { ClaudeClient, executeToolCall } from './claude.js';

const MAX_ITERATIONS = 10;

/**
 * Helper to publish structured events via A2A status-update
 * These structured events are parsed by the API's A2A client
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
 * Fraud Detection Agent
 * Uses Claude to analyze healthcare claims for fraud patterns via the REST API
 * Emits structured events for tool calls and delegations for protocol visualization
 */
export class FraudDetectionAgent implements AgentExecutor {
  async cancelTask(_taskId: string, _eventBus: ExecutionEventBus): Promise<void> {
    console.log(`[FraudDetectionAgent] Task ${_taskId} cancelled`);
  }

  async execute(requestContext: RequestContext, eventBus: ExecutionEventBus): Promise<void> {
    const userMessage = requestContext.userMessage;
    const existingTask = requestContext.task;
    const taskId = requestContext.taskId;
    const contextId = requestContext.contextId;

    console.log(`[FraudDetectionAgent] Processing message for task ${taskId}`);

    // 1. Publish initial Task if new
    if (!existingTask) {
      const initialTask: Task = {
        kind: 'task',
        id: taskId,
        contextId: contextId,
        status: {
          state: 'submitted',
          timestamp: new Date().toISOString(),
        },
        history: [userMessage],
        metadata: userMessage.metadata,
      };
      eventBus.publish(initialTask);
    }

    // 2. Publish "working" status with agent_active event
    publishStructuredEvent(eventBus, taskId, contextId, {
      type: 'agent_active',
      agent: 'detection',
      vendor: 'anthropic',
      status: 'working',
    });

    // Also publish a human-readable working message
    const workingUpdate: TaskStatusUpdateEvent = {
      kind: 'status-update',
      taskId: taskId,
      contextId: contextId,
      status: {
        state: 'working',
        message: {
          kind: 'message',
          role: 'agent',
          messageId: uuidv4(),
          parts: [{ kind: 'text', text: 'Analyzing for fraud patterns...' }],
          taskId: taskId,
          contextId: contextId,
        },
        timestamp: new Date().toISOString(),
      },
      final: false,
    };
    eventBus.publish(workingUpdate);

    // 3. Extract user query
    const textPart = userMessage.parts.find((p) => p.kind === 'text');
    const query = textPart && 'text' in textPart ? textPart.text.trim() : '';

    let responseText: string;

    try {
      // Initialize Claude client
      const claude = new ClaudeClient();

      // Send initial message to Claude
      let response = await claude.sendMessage(query);
      let iterations = 0;

      // Emit initial thinking if Claude provided reasoning before tools
      if (response.text && response.toolCalls) {
        publishStructuredEvent(eventBus, taskId, contextId, {
          type: 'thinking',
          agent: 'detection',
          text: response.text,
        });
      }

      // Agentic loop: keep processing until Claude stops calling tools
      while (response.toolCalls && iterations < MAX_ITERATIONS) {
        iterations++;
        console.log(`[FraudDetectionAgent] Iteration ${iterations}: ${response.toolCalls.length} tool calls`);

        // Execute all tool calls with event publishing
        const toolResults = await Promise.all(
          response.toolCalls.map(async (tc) => {
            // Emit tool start event
            publishStructuredEvent(eventBus, taskId, contextId, {
              type: 'mcp_tool',
              agent: 'detection',
              tool: tc.name,
              status: 'start',
            });

            const startTime = Date.now();

            // Check if this is a delegation to Investigation Agent
            if (tc.name === 'delegate_investigation') {
              // Emit delegation event
              publishStructuredEvent(eventBus, taskId, contextId, {
                type: 'a2a_delegation',
                from: 'detection',
                to: 'investigation',
              });
            }

            try {
              const result = await executeToolCall(tc.name, tc.input, eventBus, taskId, contextId);
              const duration = Date.now() - startTime;

              // Emit tool end event (success)
              publishStructuredEvent(eventBus, taskId, contextId, {
                type: 'mcp_tool',
                agent: 'detection',
                tool: tc.name,
                status: 'end',
                duration,
                success: true,
              });

              return {
                toolUseId: tc.id,
                result,
              };
            } catch (error) {
              const duration = Date.now() - startTime;

              // Emit tool end event (error)
              publishStructuredEvent(eventBus, taskId, contextId, {
                type: 'mcp_tool',
                agent: 'detection',
                tool: tc.name,
                status: 'end',
                duration,
                success: false,
              });

              return {
                toolUseId: tc.id,
                result: { error: error instanceof Error ? error.message : 'Unknown error' },
              };
            }
          })
        );

        // Send results back to Claude
        response = await claude.sendToolResults(toolResults);

        // Emit thinking if Claude provided reasoning after processing tools
        if (response.text && response.toolCalls) {
          publishStructuredEvent(eventBus, taskId, contextId, {
            type: 'thinking',
            agent: 'detection',
            text: response.text,
          });
        }
      }

      if (iterations >= MAX_ITERATIONS) {
        console.log(`[FraudDetectionAgent] Reached max iterations (${MAX_ITERATIONS})`);
      } else {
        console.log(`[FraudDetectionAgent] Completed after ${iterations} tool iterations`);
      }

      responseText = response.text || 'Analysis complete. No additional details available.';
    } catch (error) {
      console.log(`[FraudDetectionAgent] Error:`, error);
      responseText = `Error: ${error instanceof Error ? error.message : 'Unknown error'}`;
    }

    // 4. Publish agent completed event
    publishStructuredEvent(eventBus, taskId, contextId, {
      type: 'agent_active',
      agent: 'detection',
      vendor: 'anthropic',
      status: 'completed',
    });

    // 5. Publish final status
    const agentMessage: Message = {
      kind: 'message',
      role: 'agent',
      messageId: uuidv4(),
      parts: [{ kind: 'text', text: responseText }],
      taskId: taskId,
      contextId: contextId,
    };

    const finalUpdate: TaskStatusUpdateEvent = {
      kind: 'status-update',
      taskId: taskId,
      contextId: contextId,
      status: {
        state: 'completed',
        message: agentMessage,
        timestamp: new Date().toISOString(),
      },
      final: true,
    };
    eventBus.publish(finalUpdate);

    console.log(`[FraudDetectionAgent] Task ${taskId} completed`);
  }
}
