export interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
  timestamp: Date;
}

export type AgentId = "detection" | "investigation";
export type AgentVendor = "anthropic" | "google";
export type AgentStatus = "idle" | "working" | "completed";

export interface AgentState {
  id: AgentId;
  name: string;
  vendor: AgentVendor;
  model: string;
  status: AgentStatus;
}

export interface ToolCall {
  id: string;
  name: string;
  agent: AgentId;
  status: "running" | "success" | "error";
  duration?: number;
  summary?: string;
  startTime: Date;
}

export interface A2ADelegation {
  id: string;
  from: AgentId;
  to: AgentId;
  timestamp: Date;
}

export interface ThinkingEntry {
  id: string;
  agent: AgentId;
  text: string;
  timestamp: Date;
}

export interface ProtocolEvent {
  type: "mcp_tool" | "a2a_delegation" | "agent_active";
  timestamp: Date;
  data: unknown;
}

export interface ChatState {
  messages: Message[];
  toolCalls: ToolCall[];
  agents: Record<AgentId, AgentState>;
  delegations: A2ADelegation[];
  isLoading: boolean;
}

// Default agent states
export const DEFAULT_AGENTS: Record<AgentId, AgentState> = {
  detection: {
    id: "detection",
    name: "Detection Agent",
    vendor: "anthropic",
    model: "Claude",
    status: "idle",
  },
  investigation: {
    id: "investigation",
    name: "Investigation Agent",
    vendor: "google",
    model: "Gemini",
    status: "idle",
  },
};
