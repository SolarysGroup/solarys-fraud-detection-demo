import { GoogleGenerativeAI, SchemaType, type FunctionDeclaration, type Part } from '@google/generative-ai';
import { config } from '../shared/config.js';
import { callTool } from '../shared/api-client.js';

const toolDefinitions: FunctionDeclaration[] = [
  {
    name: 'investigate_provider',
    description: 'Run a comprehensive fraud investigation on a specific provider. Returns billing analysis, peer comparison, temporal patterns, and risk indicators.',
    parameters: {
      type: SchemaType.OBJECT,
      properties: {
        providerId: {
          type: SchemaType.STRING,
          description: 'The provider ID to investigate (e.g., PRV-1001)',
        },
      },
      required: ['providerId'],
    },
  },
  {
    name: 'explain_risk_score',
    description: 'Get a detailed explanation of why a provider has their current risk score, including contributing factors and evidence.',
    parameters: {
      type: SchemaType.OBJECT,
      properties: {
        providerId: {
          type: SchemaType.STRING,
          description: 'The provider ID to explain risk for',
        },
      },
      required: ['providerId'],
    },
  },
  {
    name: 'search_similar_providers',
    description: 'Find providers with similar billing patterns to a reference provider. Useful for identifying potential fraud rings.',
    parameters: {
      type: SchemaType.OBJECT,
      properties: {
        providerId: {
          type: SchemaType.STRING,
          description: 'The reference provider ID',
        },
        method: {
          type: SchemaType.STRING,
          description: 'Search method: "statistical" for billing patterns, "semantic" for embeddings',
        },
        limit: {
          type: SchemaType.NUMBER,
          description: 'Maximum number of results',
        },
      },
      required: ['providerId'],
    },
  },
  {
    name: 'search_fraud_patterns',
    description: 'Search for providers matching a natural language description of fraud patterns.',
    parameters: {
      type: SchemaType.OBJECT,
      properties: {
        query: {
          type: SchemaType.STRING,
          description: 'Natural language description of fraud pattern to search for',
        },
        limit: {
          type: SchemaType.NUMBER,
          description: 'Maximum number of results',
        },
      },
      required: ['query'],
    },
  },
];

export interface GeminiResponse {
  text: string;
  thinking?: string;
  toolCalls?: { name: string; args: Record<string, unknown> }[];
  finishReason: string;
}

export class GeminiClient {
  private model;
  private chat;

  constructor() {
    if (!config.googleApiKey) {
      throw new Error('GOOGLE_API_KEY environment variable is required');
    }

    const genAI = new GoogleGenerativeAI(config.googleApiKey);
    this.model = genAI.getGenerativeModel({
      model: 'gemini-2.5-flash-preview',
      tools: [{ functionDeclarations: toolDefinitions }],
      generationConfig: {
        // Enable thinking for this model
        thinkingConfig: {
          thinkingBudget: 2048,
        },
      } as Record<string, unknown>,
      systemInstruction: `You are a Claims Investigation Agent for the Solarys healthcare fraud detection platform.

Your role is to conduct thorough investigations into flagged healthcare providers, explain risk assessments, and help analysts understand fraud patterns.

When investigating:
1. Use investigate_provider to get comprehensive data on a provider
2. Use explain_risk_score to understand why a provider is flagged
3. Use search_similar_providers to find related providers that might be part of a fraud ring
4. Use search_fraud_patterns to find providers matching specific fraud descriptions

Always provide clear, professional analysis suitable for compliance review. Cite specific data points from your tool calls.`,
    });

    this.chat = this.model.startChat();
  }

  async sendMessage(message: string): Promise<GeminiResponse> {
    const result = await this.chat.sendMessage(message);
    const response = result.response;
    const candidate = response.candidates?.[0];

    if (!candidate) {
      return { text: 'No response generated', finishReason: 'ERROR' };
    }

    const parts = candidate.content.parts;

    // Extract thinking parts (from thinking-enabled models)
    const thoughtParts = parts.filter((p): p is Part & { text: string; thought: boolean } => 'thought' in p && (p as unknown as { thought?: boolean }).thought === true);
    const thinkingText = thoughtParts.map((p) => p.text).join('');

    // Extract regular text parts (non-thinking)
    const textParts = parts.filter((p): p is Part & { text: string } => 'text' in p && !('thought' in p && (p as unknown as { thought?: boolean }).thought === true));
    const functionCallParts = parts.filter((p): p is Part & { functionCall: { name: string; args: Record<string, unknown> } } => 'functionCall' in p);

    const toolCalls = functionCallParts.map((p) => ({
      name: p.functionCall.name,
      args: p.functionCall.args,
    }));

    console.log(`[GeminiClient] Response parts - thinking: ${thinkingText.length} chars, text: ${textParts.length} parts, tools: ${toolCalls.length}`);

    return {
      text: textParts.map((p) => p.text).join(''),
      thinking: thinkingText || undefined,
      toolCalls: toolCalls.length > 0 ? toolCalls : undefined,
      finishReason: candidate.finishReason || 'STOP',
    };
  }

  async sendToolResults(results: { name: string; response: unknown }[]): Promise<GeminiResponse> {
    // Build function response parts
    const functionResponseParts = results.map((r) => ({
      functionResponse: {
        name: r.name,
        response: { result: r.response },
      },
    }));

    const result = await this.chat.sendMessage(functionResponseParts);
    const response = result.response;
    const candidate = response.candidates?.[0];

    if (!candidate) {
      return { text: 'No response generated', finishReason: 'ERROR' };
    }

    const parts = candidate.content.parts;

    // Extract thinking parts (from thinking-enabled models)
    const thoughtParts = parts.filter((p): p is Part & { text: string; thought: boolean } => 'thought' in p && (p as unknown as { thought?: boolean }).thought === true);
    const thinkingText = thoughtParts.map((p) => p.text).join('');

    // Extract regular text parts (non-thinking)
    const textParts = parts.filter((p): p is Part & { text: string } => 'text' in p && !('thought' in p && (p as unknown as { thought?: boolean }).thought === true));
    const functionCallParts = parts.filter((p): p is Part & { functionCall: { name: string; args: Record<string, unknown> } } => 'functionCall' in p);

    const toolCalls = functionCallParts.map((p) => ({
      name: p.functionCall.name,
      args: p.functionCall.args,
    }));

    console.log(`[GeminiClient] Tool response parts - thinking: ${thinkingText.length} chars, text: ${textParts.length} parts, tools: ${toolCalls.length}`);

    return {
      text: textParts.map((p) => p.text).join(''),
      thinking: thinkingText || undefined,
      toolCalls: toolCalls.length > 0 ? toolCalls : undefined,
      finishReason: candidate.finishReason || 'STOP',
    };
  }
}

export async function executeToolCall(name: string, args: Record<string, unknown>): Promise<unknown> {
  console.log(`[GeminiClient] Executing tool: ${name}`, args);

  const result = await callTool(name, args);

  if (result.success) {
    return result.data;
  } else {
    return { error: result.error };
  }
}
