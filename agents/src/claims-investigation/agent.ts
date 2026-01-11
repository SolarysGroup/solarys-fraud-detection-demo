import { v4 as uuidv4 } from 'uuid';
import type { Task, TaskStatusUpdateEvent, Message } from '@a2a-js/sdk';
import type { AgentExecutor, RequestContext, ExecutionEventBus } from '@a2a-js/sdk/server';
import { GeminiClient, executeToolCall } from './gemini.js';

const MAX_ITERATIONS = 10;

/**
 * Helper to publish structured events via A2A status-update
 * These structured events are parsed by the Detection Agent's A2A client
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
 * Claims Investigation Agent
 * Uses Gemini to conduct deep investigations with tool calling
 * Emits structured events for tool calls for protocol visualization
 */
export class ClaimsInvestigationAgent implements AgentExecutor {
  async cancelTask(_taskId: string, _eventBus: ExecutionEventBus): Promise<void> {
    console.log(`[ClaimsInvestigationAgent] Task ${_taskId} cancelled`);
  }

  async execute(requestContext: RequestContext, eventBus: ExecutionEventBus): Promise<void> {
    const userMessage = requestContext.userMessage;
    const existingTask = requestContext.task;
    const taskId = requestContext.taskId;
    const contextId = requestContext.contextId;

    console.log(`[ClaimsInvestigationAgent] Processing message for task ${taskId}`);

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
      agent: 'investigation',
      vendor: 'google',
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
          parts: [{ kind: 'text', text: 'Initiating investigation with Gemini AI...' }],
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
      // 4. Initialize Gemini client and run agentic loop
      console.log(`[ClaimsInvestigationAgent] ========== CALLING GEMINI ==========`);
      const gemini = new GeminiClient();
      let response = await gemini.sendMessage(query);
      console.log(`[ClaimsInvestigationAgent] ========== GEMINI RESPONDED ==========`);
      console.log(`[ClaimsInvestigationAgent] Full response:`, JSON.stringify({ thinking: response.thinking?.substring(0, 200), text: response.text, toolCalls: response.toolCalls?.map(t => t.name), finishReason: response.finishReason }));
      let iterations = 0;

      // Emit initial thinking if Gemini provided any reasoning
      console.log(`[ClaimsInvestigationAgent] Initial response - thinking: ${response.thinking ? response.thinking.substring(0, 100) + '...' : 'NONE'}, text: ${response.text ? response.text.substring(0, 100) + '...' : 'NONE'}, toolCalls: ${response.toolCalls?.length || 0}`);

      // Prefer thinking content (from thinking-enabled models), fall back to text
      const thinkingContent = response.thinking || response.text;
      if (thinkingContent) {
        console.log(`[ClaimsInvestigationAgent] Emitting initial thinking: ${thinkingContent.substring(0, 100)}...`);
        publishStructuredEvent(eventBus, taskId, contextId, {
          type: 'thinking',
          agent: 'investigation',
          text: thinkingContent,
        });
      }

      while (response.toolCalls && response.toolCalls.length > 0 && iterations < MAX_ITERATIONS) {
        iterations++;
        console.log(`[ClaimsInvestigationAgent] Iteration ${iterations}: ${response.toolCalls.length} tool calls`);

        // Execute all tool calls with event emission
        const toolResults = await Promise.all(
          response.toolCalls.map(async (tc) => {
            // Emit tool start event
            publishStructuredEvent(eventBus, taskId, contextId, {
              type: 'mcp_tool',
              agent: 'investigation',
              tool: tc.name,
              status: 'start',
            });

            const startTime = Date.now();

            try {
              const result = await executeToolCall(tc.name, tc.args);
              const duration = Date.now() - startTime;

              // Emit tool end event (success)
              publishStructuredEvent(eventBus, taskId, contextId, {
                type: 'mcp_tool',
                agent: 'investigation',
                tool: tc.name,
                status: 'end',
                duration,
                success: true,
              });

              return {
                name: tc.name,
                response: result,
              };
            } catch (error) {
              const duration = Date.now() - startTime;

              // Emit tool end event (error)
              publishStructuredEvent(eventBus, taskId, contextId, {
                type: 'mcp_tool',
                agent: 'investigation',
                tool: tc.name,
                status: 'end',
                duration,
                success: false,
              });

              return {
                name: tc.name,
                response: { error: error instanceof Error ? error.message : 'Unknown error' },
              };
            }
          })
        );

        // Send results back to Gemini
        response = await gemini.sendToolResults(toolResults);

        // Emit thinking if Gemini provided any reasoning after processing tools
        const intermediateThinking = response.thinking || response.text;
        if (intermediateThinking && response.toolCalls && response.toolCalls.length > 0) {
          console.log(`[ClaimsInvestigationAgent] Emitting intermediate thinking: ${intermediateThinking.substring(0, 100)}...`);
          publishStructuredEvent(eventBus, taskId, contextId, {
            type: 'thinking',
            agent: 'investigation',
            text: intermediateThinking,
          });
        }
      }

      if (iterations >= MAX_ITERATIONS) {
        responseText = `Investigation reached maximum iterations (${MAX_ITERATIONS}). Partial results:\n\n${response.text}`;
      } else {
        responseText = response.text || 'Investigation complete. No additional findings to report.';
      }

      console.log(`[ClaimsInvestigationAgent] Completed after ${iterations} tool iterations`);
    } catch (error) {
      console.error('[ClaimsInvestigationAgent] Error:', error);
      responseText = `Investigation error: ${error instanceof Error ? error.message : 'Unknown error'}`;
    }

    // 5. Publish agent completed event
    publishStructuredEvent(eventBus, taskId, contextId, {
      type: 'agent_active',
      agent: 'investigation',
      vendor: 'google',
      status: 'completed',
    });

    // 6. Publish final status
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

    console.log(`[ClaimsInvestigationAgent] Task ${taskId} completed`);
  }
}
