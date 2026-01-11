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

  // Agent ports (for local development)
  get detectionAgentPort() {
    return parseInt(process.env.DETECTION_AGENT_PORT || '3002', 10);
  },
  get investigationAgentPort() {
    return parseInt(process.env.INVESTIGATION_AGENT_PORT || '3003', 10);
  },

  // Agent URLs (for Railway/production - use full URLs instead of localhost)
  // These are used by OTHER services to call this agent
  get detectionAgentUrl() {
    return process.env.DETECTION_AGENT_URL || `http://localhost:${this.detectionAgentPort}`;
  },
  get investigationAgentUrl() {
    return process.env.INVESTIGATION_AGENT_URL || `http://localhost:${this.investigationAgentPort}`;
  },

  // Public URLs for agent cards (what the agent advertises as its own URL)
  // On Railway, set these to the public URLs of the services
  get detectionAgentPublicUrl() {
    return process.env.DETECTION_AGENT_PUBLIC_URL || `http://localhost:${this.detectionAgentPort}`;
  },
  get investigationAgentPublicUrl() {
    return process.env.INVESTIGATION_AGENT_PUBLIC_URL || `http://localhost:${this.investigationAgentPort}`;
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
