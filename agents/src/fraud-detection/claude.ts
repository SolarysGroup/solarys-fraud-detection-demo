import Anthropic from '@anthropic-ai/sdk';
import type { Tool, MessageParam, ToolResultBlockParam } from '@anthropic-ai/sdk/resources/messages';
import type { ExecutionEventBus } from '@a2a-js/sdk/server';
import { config } from '../shared/config.js';
import { callTool } from '../shared/api-client.js';
import { callInvestigationAgentWithEvents } from '../shared/a2a-client.js';

const toolDefinitions: Tool[] = [
  {
    name: 'find_anomalies',
    description: 'Find statistical anomalies in claims data. Returns providers with unusual billing patterns, outlier amounts, or suspicious frequencies.',
    input_schema: {
      type: 'object' as const,
      properties: {
        limit: {
          type: 'number',
          description: 'Maximum number of anomalies to return (default: 10)',
        },
        threshold: {
          type: 'number',
          description: 'Z-score threshold for anomaly detection (default: 2.0)',
        },
      },
      required: [],
    },
  },
  {
    name: 'detect_fraud_rings',
    description: 'Detect potential fraud rings by analyzing shared beneficiaries, referral patterns, and coordinated billing across providers.',
    input_schema: {
      type: 'object' as const,
      properties: {
        minSharedBeneficiaries: {
          type: 'number',
          description: 'Minimum shared beneficiaries to flag as potential ring (default: 3)',
        },
      },
      required: [],
    },
  },
  {
    name: 'check_deceased_claims',
    description: 'Find claims submitted after beneficiary death dates. Critical for identifying billing fraud.',
    input_schema: {
      type: 'object' as const,
      properties: {
        limit: {
          type: 'number',
          description: 'Maximum number of claims to return (default: 10)',
        },
        daysAfterDeath: {
          type: 'number',
          description: 'Minimum days after death to flag (default: 0)',
        },
      },
      required: [],
    },
  },
  {
    name: 'search_providers',
    description: 'Search for providers by name, specialty, or location. Use this to look up specific providers.',
    input_schema: {
      type: 'object' as const,
      properties: {
        query: {
          type: 'string',
          description: 'Search query (provider name, specialty, or location)',
        },
        limit: {
          type: 'number',
          description: 'Maximum results to return (default: 10)',
        },
      },
      required: ['query'],
    },
  },
  {
    name: 'get_provider_details',
    description: 'Get detailed information about a specific provider including claims history, risk score, and billing patterns.',
    input_schema: {
      type: 'object' as const,
      properties: {
        providerId: {
          type: 'string',
          description: 'The provider ID (e.g., PRV-1001 or PRV52019)',
        },
      },
      required: ['providerId'],
    },
  },
  {
    name: 'delegate_investigation',
    description: 'Delegate a deep-dive investigation to the Claims Investigation Agent (powered by Gemini AI). Use this when you find suspicious providers that need thorough investigation, risk score explanation, or when searching for similar fraud patterns. The Investigation Agent has specialized tools for comprehensive provider analysis.',
    input_schema: {
      type: 'object' as const,
      properties: {
        request: {
          type: 'string',
          description: 'The investigation request to send to the Investigation Agent. Be specific about what you want investigated (e.g., "Investigate provider PRV52019 and explain their risk score" or "Find providers with similar billing patterns to PRV-1001")',
        },
      },
      required: ['request'],
    },
  },
];

export interface ClaudeResponse {
  text: string;
  toolCalls?: { id: string; name: string; input: Record<string, unknown> }[];
  stopReason: string;
}

export class ClaudeClient {
  private client: Anthropic;
  private conversationHistory: MessageParam[];

  constructor() {
    if (!config.anthropicApiKey) {
      throw new Error('ANTHROPIC_API_KEY environment variable is required');
    }

    this.client = new Anthropic({
      apiKey: config.anthropicApiKey,
    });

    this.conversationHistory = [];
  }

  async sendMessage(message: string): Promise<ClaudeResponse> {
    this.conversationHistory.push({
      role: 'user',
      content: message,
    });

    const response = await this.client.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 4096,
      system: `You are a Fraud Detection Agent for the Texas Retirement System healthcare fraud detection program.

Your role is to identify and analyze potential fraud in healthcare claims data. You have access to tools that query the fraud detection database.

When analyzing fraud:
1. Use find_anomalies to identify statistical outliers in billing patterns
2. Use detect_fraud_rings to find coordinated fraud across providers
3. Use check_deceased_claims to find billing after beneficiary death
4. Use search_providers to look up specific providers
5. Use get_provider_details for basic provider information

IMPORTANT - Agent Delegation:
When you find suspicious providers or need deep-dive analysis, use delegate_investigation to send the case to the Claims Investigation Agent (Gemini AI). The Investigation Agent specializes in:
- Comprehensive provider investigations with billing analysis and peer comparison
- Detailed risk score explanations with contributing factors
- Finding providers with similar fraud patterns (potential fraud rings)
- Generating compliance-ready investigation reports

Example delegation: If find_anomalies returns a high-risk provider, delegate to Investigation Agent with: "Investigate provider PRV52019 and explain their risk factors"

Always provide clear, professional analysis suitable for compliance review. Cite specific data points from your tool calls.`,
      tools: toolDefinitions,
      messages: this.conversationHistory,
    });

    // Extract text and tool calls from response
    const textBlocks = response.content.filter((block) => block.type === 'text');
    const toolUseBlocks = response.content.filter((block) => block.type === 'tool_use');

    const text = textBlocks.map((block) => ('text' in block ? block.text : '')).join('');
    const toolCalls = toolUseBlocks.map((block) => {
      if (block.type === 'tool_use') {
        return {
          id: block.id,
          name: block.name,
          input: block.input as Record<string, unknown>,
        };
      }
      throw new Error('Unexpected block type');
    });

    // Add assistant response to history
    this.conversationHistory.push({
      role: 'assistant',
      content: response.content,
    });

    return {
      text,
      toolCalls: toolCalls.length > 0 ? toolCalls : undefined,
      stopReason: response.stop_reason || 'end_turn',
    };
  }

  async sendToolResults(
    results: { toolUseId: string; result: unknown }[]
  ): Promise<ClaudeResponse> {
    // Build tool result message
    const toolResultContent: ToolResultBlockParam[] = results.map((r) => ({
      type: 'tool_result' as const,
      tool_use_id: r.toolUseId,
      content: JSON.stringify(r.result),
    }));

    this.conversationHistory.push({
      role: 'user',
      content: toolResultContent,
    });

    const response = await this.client.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 4096,
      system: `You are a Fraud Detection Agent for the Texas Retirement System healthcare fraud detection program.

Your role is to identify and analyze potential fraud in healthcare claims data. You have access to tools that query the fraud detection database.

When analyzing fraud:
1. Use find_anomalies to identify statistical outliers in billing patterns
2. Use detect_fraud_rings to find coordinated fraud across providers
3. Use check_deceased_claims to find billing after beneficiary death
4. Use search_providers to look up specific providers
5. Use get_provider_details for basic provider information

IMPORTANT - Agent Delegation:
When you find suspicious providers or need deep-dive analysis, use delegate_investigation to send the case to the Claims Investigation Agent (Gemini AI). The Investigation Agent specializes in:
- Comprehensive provider investigations with billing analysis and peer comparison
- Detailed risk score explanations with contributing factors
- Finding providers with similar fraud patterns (potential fraud rings)
- Generating compliance-ready investigation reports

Example delegation: If find_anomalies returns a high-risk provider, delegate to Investigation Agent with: "Investigate provider PRV52019 and explain their risk factors"

Always provide clear, professional analysis suitable for compliance review. Cite specific data points from your tool calls.`,
      tools: toolDefinitions,
      messages: this.conversationHistory,
    });

    const textBlocks = response.content.filter((block) => block.type === 'text');
    const toolUseBlocks = response.content.filter((block) => block.type === 'tool_use');

    const text = textBlocks.map((block) => ('text' in block ? block.text : '')).join('');
    const toolCalls = toolUseBlocks.map((block) => {
      if (block.type === 'tool_use') {
        return {
          id: block.id,
          name: block.name,
          input: block.input as Record<string, unknown>,
        };
      }
      throw new Error('Unexpected block type');
    });

    // Add assistant response to history
    this.conversationHistory.push({
      role: 'assistant',
      content: response.content,
    });

    return {
      text,
      toolCalls: toolCalls.length > 0 ? toolCalls : undefined,
      stopReason: response.stop_reason || 'end_turn',
    };
  }
}

export async function executeToolCall(
  name: string,
  args: Record<string, unknown>,
  eventBus?: ExecutionEventBus,
  taskId?: string,
  contextId?: string
): Promise<unknown> {
  console.log(`[ClaudeClient] Executing tool: ${name}`, args);

  // Handle delegation to Investigation Agent via A2A protocol
  if (name === 'delegate_investigation') {
    const request = args.request as string;
    console.log(`[ClaudeClient] Delegating to Investigation Agent via A2A...`);

    // If we have eventBus context, use the version that emits events
    if (eventBus && taskId && contextId) {
      const investigationResult = await callInvestigationAgentWithEvents(
        request,
        eventBus,
        taskId,
        contextId
      );
      return { investigation_report: investigationResult };
    } else {
      // Fallback to simple version
      const { callInvestigationAgent } = await import('../shared/a2a-client.js');
      const investigationResult = await callInvestigationAgent(request);
      return { investigation_report: investigationResult };
    }
  }

  // Map tool names to API endpoints
  const toolMapping: Record<string, string> = {
    find_anomalies: 'find_anomalies',
    detect_fraud_rings: 'detect_fraud_rings',
    check_deceased_claims: 'check_deceased_claims',
    search_providers: 'search_providers',
    get_provider_details: 'investigate_provider',
  };

  const apiTool = toolMapping[name] || name;
  const result = await callTool(apiTool, args);

  if (result.success) {
    return result.data;
  } else {
    return { error: result.error };
  }
}
