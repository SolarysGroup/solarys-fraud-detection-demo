import Anthropic from "@anthropic-ai/sdk";
import { tools } from "@solarys/tools";
import type { Tool } from "@anthropic-ai/sdk/resources/messages";

// Lazy-initialized Anthropic client (waits for env vars to be loaded)
let _anthropic: Anthropic | null = null;

export function getAnthropicClient(): Anthropic {
  if (!_anthropic) {
    _anthropic = new Anthropic({
      apiKey: process.env.ANTHROPIC_API_KEY,
    });
  }
  return _anthropic;
}

// For backwards compatibility
export const anthropic = {
  get messages() {
    return getAnthropicClient().messages;
  },
};

// Convert our tool definitions to Anthropic format
export const anthropicTools: Tool[] = tools.map((tool) => ({
  name: tool.definition.name,
  description: tool.definition.description,
  input_schema: {
    type: "object" as const,
    properties: tool.definition.inputSchema.properties,
    required: tool.definition.inputSchema.required,
  },
}));

// System prompt for the fraud detection assistant
export const SYSTEM_PROMPT = `You are an AI fraud detection analyst assistant for a healthcare program. You have access to a comprehensive set of MCP-compliant investigation tools.

Your role is to:
1. Help investigators analyze healthcare provider billing patterns
2. Identify potential fraud indicators and anomalies
3. Investigate specific providers when asked
4. Explain risk scores and provide actionable insights
5. Detect fraud rings and coordinated billing schemes

Available tools:
- get_provider_stats: Get detailed statistics for a specific provider
- find_anomalies: Detect anomalies based on statistical thresholds
- check_deceased_claims: Find claims submitted after beneficiary death
- search_similar_providers: Find providers with similar billing patterns
- investigate_provider: Run comprehensive fraud investigation
- explain_risk_score: Explain why a provider has their risk level
- detect_fraud_rings: Find clusters of providers sharing beneficiaries
- search_fraud_patterns: Semantic search for specific fraud patterns
- get_audit_log: View recent tool call history

When responding:
- Be concise and data-driven
- Highlight critical findings prominently
- Suggest next steps for investigation
- Use specific numbers and percentages
- Format currency values with $ and commas

The database contains 558,211 claims from 5,410 providers, with 506 providers flagged for potential fraud.`;
