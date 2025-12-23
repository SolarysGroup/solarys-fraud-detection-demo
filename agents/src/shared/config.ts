// Use getters so env vars are evaluated at access time, not import time
// This allows dotenv to load before values are read
export const config = {
  // REST API (apps/api) - kept for backwards compatibility
  get apiBaseUrl() {
    return process.env.API_BASE_URL || 'http://localhost:3001';
  },

  // MCP Server (primary tool access)
  get mcpServerUrl() {
    return process.env.MCP_SERVER_URL || 'http://localhost:3004';
  },

  // Agent ports
  get detectionAgentPort() {
    return parseInt(process.env.DETECTION_AGENT_PORT || '3002', 10);
  },
  get investigationAgentPort() {
    return parseInt(process.env.INVESTIGATION_AGENT_PORT || '3003', 10);
  },

  // LLM API keys
  get anthropicApiKey() {
    return process.env.ANTHROPIC_API_KEY;
  },
  get openaiApiKey() {
    return process.env.OPENAI_API_KEY;
  },
  get googleApiKey() {
    return process.env.GOOGLE_API_KEY;
  },
};
