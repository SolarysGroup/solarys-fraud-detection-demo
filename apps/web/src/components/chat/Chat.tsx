"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { ChatMessage } from "./ChatMessage";
import { ChatInput } from "./ChatInput";
import { ToolPanel } from "./ToolPanel";
import { AgentPanel } from "./AgentPanel";
import { ProtocolBadges } from "./ProtocolBadges";
import { ThinkingPanel } from "./ThinkingPanel";
import type { Message, ToolCall, AgentId, AgentState, A2ADelegation, ThinkingEntry } from "./types";
import { DEFAULT_AGENTS } from "./types";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001";

export function Chat() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [toolCalls, setToolCalls] = useState<ToolCall[]>([]);
  const [agents, setAgents] = useState<Record<AgentId, AgentState>>(DEFAULT_AGENTS);
  const [delegations, setDelegations] = useState<A2ADelegation[]>([]);
  const [thoughts, setThoughts] = useState<ThinkingEntry[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [streamingContent, setStreamingContent] = useState("");
  const scrollAreaRef = useRef<HTMLDivElement>(null);

  // Get active delegation (the most recent one that hasn't completed)
  const getActiveDelegation = (): A2ADelegation | null => {
    if (delegations.length === 0) return null;
    if (agents.investigation.status !== "working" && agents.detection.status !== "working") return null;
    const last = delegations[delegations.length - 1];
    return last ?? null;
  };
  const activeDelegation = getActiveDelegation();

  // Auto-scroll to bottom when messages change
  useEffect(() => {
    if (scrollAreaRef.current) {
      scrollAreaRef.current.scrollTop = scrollAreaRef.current.scrollHeight;
    }
  }, [messages, streamingContent]);

  // Reset state for new conversation
  const resetState = useCallback(() => {
    setToolCalls([]);
    setDelegations([]);
    setThoughts([]);
    setAgents(DEFAULT_AGENTS);
  }, []);

  const handleSend = useCallback(async (content: string) => {
    // Reset state for new message
    resetState();

    // Add user message
    const userMessage: Message = {
      id: crypto.randomUUID(),
      role: "user",
      content,
      timestamp: new Date(),
    };
    setMessages((prev) => [...prev, userMessage]);
    setIsLoading(true);
    setStreamingContent("");

    try {
      // Prepare messages for API
      const chatMessages = [...messages, userMessage].map((m) => ({
        role: m.role,
        content: m.content,
      }));

      const response = await fetch(`${API_URL}/api/chat`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ messages: chatMessages }),
      });

      if (!response.ok) {
        // Try to get error message from response body
        try {
          const errorData = await response.json();
          throw new Error(errorData.message || errorData.error || `HTTP error: ${response.status}`);
        } catch {
          throw new Error(`HTTP error: ${response.status}`);
        }
      }

      const reader = response.body?.getReader();
      if (!reader) {
        throw new Error("No response body");
      }

      const decoder = new TextDecoder();
      let buffer = "";
      let currentContent = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() || "";

        for (const line of lines) {
          if (line.startsWith("event: ")) {
            // We now use event types from the SSE
            continue;
          }
          if (line.startsWith("data: ")) {
            const data = line.slice(6);
            try {
              const parsed = JSON.parse(data);
              console.log('[Chat] SSE event received:', parsed);

              // Handle agent_active events
              if ("agent" in parsed && "vendor" in parsed && "status" in parsed && !("tool" in parsed)) {
                const agentId = parsed.agent as AgentId;
                console.log(`[Chat] agent_active: ${agentId} -> ${parsed.status}`);
                setAgents((prev) => ({
                  ...prev,
                  [agentId]: {
                    ...prev[agentId],
                    status: parsed.status === "working" ? "working" :
                           parsed.status === "completed" ? "completed" : "idle",
                  },
                }));
              }
              // Handle mcp_tool events
              else if ("tool" in parsed && "status" in parsed) {
                const agentId = (parsed.agent as AgentId) || "detection";
                console.log(`[Chat] mcp_tool: ${agentId} - ${parsed.tool} (${parsed.status})`);

                if (parsed.status === "start") {
                  const newToolCall: ToolCall = {
                    id: crypto.randomUUID(),
                    name: parsed.tool,
                    agent: agentId,
                    status: "running",
                    startTime: new Date(),
                  };
                  setToolCalls((prev) => [...prev, newToolCall]);
                } else if (parsed.status === "end") {
                  setToolCalls((prev) =>
                    prev.map((t) =>
                      t.name === parsed.tool && t.status === "running" && t.agent === agentId
                        ? {
                            ...t,
                            status: parsed.success ? "success" : "error",
                            duration: parsed.duration,
                          }
                        : t
                    )
                  );
                }
              }
              // Handle a2a_delegation events
              else if ("from" in parsed && "to" in parsed) {
                const delegation: A2ADelegation = {
                  id: crypto.randomUUID(),
                  from: parsed.from as AgentId,
                  to: parsed.to as AgentId,
                  timestamp: new Date(),
                };
                setDelegations((prev) => [...prev, delegation]);
              }
              // Handle thinking events (has agent and text, but not tool)
              else if ("agent" in parsed && "text" in parsed && !("tool" in parsed)) {
                console.log(`[Chat] thinking: ${parsed.agent}`);
                const thought: ThinkingEntry = {
                  id: crypto.randomUUID(),
                  agent: parsed.agent as AgentId,
                  text: parsed.text as string,
                  timestamp: new Date(),
                };
                setThoughts((prev) => [...prev, thought]);
              }
              // Handle text events (final response text, no agent field)
              else if ("text" in parsed && !("agent" in parsed)) {
                currentContent += parsed.text;
                setStreamingContent(currentContent);
              }
              // Handle done events
              else if ("taskId" in parsed || Object.keys(parsed).length === 0) {
                if (currentContent) {
                  const assistantMessage: Message = {
                    id: crypto.randomUUID(),
                    role: "assistant",
                    content: currentContent,
                    timestamp: new Date(),
                  };
                  setMessages((prev) => [...prev, assistantMessage]);
                }
              }
              // Handle error events
              else if ("message" in parsed) {
                console.error("Stream error:", parsed.message);
              }
            } catch {
              // Ignore parse errors
            }
          }
        }
      }
    } catch (error) {
      console.error("Chat error:", error);
      const errorMessage: Message = {
        id: crypto.randomUUID(),
        role: "assistant",
        content: `Error: ${error instanceof Error ? error.message : "Failed to connect to API"}`,
        timestamp: new Date(),
      };
      setMessages((prev) => [...prev, errorMessage]);
    } finally {
      setIsLoading(false);
      setStreamingContent("");
      // Reset agent states to idle after completion
      setAgents((prev) => ({
        detection: { ...prev.detection, status: "idle" },
        investigation: { ...prev.investigation, status: "idle" },
      }));
    }
  }, [messages, resetState]);

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 h-[800px]">
      {/* Chat Panel - takes 2 columns */}
      <div className="lg:col-span-2">
        <Card className="h-full flex flex-col">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-lg">Investigation Chat</CardTitle>
            <ProtocolBadges />
          </CardHeader>
          <CardContent className="flex-1 p-0 overflow-hidden relative">
            <div ref={scrollAreaRef} className="absolute inset-0 overflow-y-auto px-4">
              <div className="space-y-4 py-4">
                {messages.length === 0 && !streamingContent && (
                  <div className="text-center py-8">
                    <p className="text-zinc-500 text-sm">
                      Start an investigation by asking a question.
                    </p>
                    <div className="mt-4 space-y-2 text-xs text-zinc-600">
                      <p>Try: &quot;Find providers with anomalous billing patterns&quot;</p>
                      <p>Try: &quot;Investigate provider PRV00001&quot;</p>
                      <p>Try: &quot;Detect fraud rings in the system&quot;</p>
                    </div>
                  </div>
                )}
                {messages.map((message) => (
                  <ChatMessage key={message.id} message={message} />
                ))}
                {streamingContent && (
                  <ChatMessage
                    message={{
                      id: "streaming",
                      role: "assistant",
                      content: streamingContent,
                      timestamp: new Date(),
                    }}
                  />
                )}
                {isLoading && !streamingContent && (
                  <div className="flex justify-start">
                    <div className="bg-zinc-800 px-4 py-3 text-sm text-zinc-400">
                      <span className="animate-pulse">Thinking...</span>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </CardContent>
          <div className="border-t border-zinc-800">
            <ChatInput
              onSend={handleSend}
              disabled={isLoading}
              placeholder="Ask about fraud patterns, investigate providers, or detect anomalies..."
            />
          </div>
        </Card>
      </div>

      {/* Protocol Panel - takes 1 column */}
      <div className="lg:col-span-1 flex flex-col gap-3 overflow-hidden">
        <AgentPanel agents={agents} activeDelegation={activeDelegation} />
        <div className="flex-1 min-h-0 overflow-hidden">
          <ThinkingPanel thoughts={thoughts} />
        </div>
        <div className="flex-1 min-h-0 overflow-hidden">
          <ToolPanel toolCalls={toolCalls} delegations={delegations} />
        </div>
      </div>
    </div>
  );
}
