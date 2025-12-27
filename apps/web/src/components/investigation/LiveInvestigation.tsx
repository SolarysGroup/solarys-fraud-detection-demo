"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Loader2,
  CheckCircle2,
  XCircle,
  ArrowDown,
  Brain,
  Wrench,
} from "lucide-react";
import { cn } from "@/lib/utils";
import type { InvestigationResult, ProtocolStep, ToolCall, ThinkingEntry } from "./types";
import type { AgentId } from "@/components/chat/types";
import { HIGH_RISK_PROVIDERS } from "./data";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001";

interface LiveInvestigationProps {
  providerId: string;
  onComplete: (result: InvestigationResult) => void;
}

interface AgentState {
  status: "idle" | "working" | "completed";
}

export function LiveInvestigation({ providerId, onComplete }: LiveInvestigationProps) {
  const [agents, setAgents] = useState<Record<AgentId, AgentState>>({
    detection: { status: "idle" },
    investigation: { status: "idle" },
  });
  const [toolCalls, setToolCalls] = useState<ToolCall[]>([]);
  const [thoughts, setThoughts] = useState<ThinkingEntry[]>([]);
  const [streamingContent, setStreamingContent] = useState("");
  const [isComplete, setIsComplete] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const hasStarted = useRef(false);

  // Refs for auto-scrolling within containers
  const toolCallsContainerRef = useRef<HTMLDivElement>(null);
  const thoughtsContainerRef = useRef<HTMLDivElement>(null);

  // Auto-scroll tool calls when new entries are added
  useEffect(() => {
    if (toolCallsContainerRef.current) {
      toolCallsContainerRef.current.scrollTop = toolCallsContainerRef.current.scrollHeight;
    }
  }, [toolCalls]);

  // Auto-scroll thoughts when new entries are added
  useEffect(() => {
    if (thoughtsContainerRef.current) {
      thoughtsContainerRef.current.scrollTop = thoughtsContainerRef.current.scrollHeight;
    }
  }, [thoughts]);

  const runInvestigation = useCallback(async () => {
    if (hasStarted.current) return;
    hasStarted.current = true;

    try {
      const response = await fetch(`${API_URL}/api/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: [
            {
              role: "user",
              content: `Run a full investigation on provider ${providerId}`,
            },
          ],
        }),
      });

      if (!response.ok) {
        throw new Error(`HTTP error: ${response.status}`);
      }

      const reader = response.body?.getReader();
      if (!reader) throw new Error("No response body");

      const decoder = new TextDecoder();
      let buffer = "";
      let currentContent = "";
      const protocolSteps: ProtocolStep[] = [];

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() || "";

        for (const line of lines) {
          if (line.startsWith("data: ")) {
            const data = line.slice(6);
            try {
              const parsed = JSON.parse(data);

              // Handle agent_active events
              if ("agent" in parsed && "status" in parsed && !("tool" in parsed) && !("text" in parsed)) {
                const agentId = parsed.agent as AgentId;
                setAgents((prev) => ({
                  ...prev,
                  [agentId]: {
                    status: parsed.status === "working" ? "working" :
                           parsed.status === "completed" ? "completed" : "idle",
                  },
                }));
              }
              // Handle mcp_tool events
              else if ("tool" in parsed && "status" in parsed) {
                const agentId = (parsed.agent as AgentId) || "detection";

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
                        ? { ...t, status: parsed.success ? "success" : "error", duration: parsed.duration }
                        : t
                    )
                  );
                  // Track for protocol steps
                  protocolSteps.push({
                    agent: agentId,
                    tool: formatToolName(parsed.tool),
                    duration: parsed.duration || 0,
                  });
                }
              }
              // Handle thinking events
              else if ("agent" in parsed && "text" in parsed && !("tool" in parsed)) {
                const thought: ThinkingEntry = {
                  id: crypto.randomUUID(),
                  agent: parsed.agent as AgentId,
                  text: parsed.text as string,
                  timestamp: new Date(),
                };
                setThoughts((prev) => [...prev, thought]);
              }
              // Handle text events
              else if ("text" in parsed && !("agent" in parsed)) {
                currentContent += parsed.text;
                setStreamingContent(currentContent);
              }
              // Handle done events
              else if ("taskId" in parsed || Object.keys(parsed).length === 0) {
                setIsComplete(true);
                // Parse the response to create an investigation result
                const result = parseInvestigationResult(providerId, currentContent, protocolSteps);
                onComplete(result);
              }
            } catch {
              // Ignore parse errors
            }
          }
        }
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Investigation failed");
    }
  }, [providerId, onComplete]);

  useEffect(() => {
    runInvestigation();
  }, [runInvestigation]);

  const hasActiveDelegation = agents.detection.status === "completed" && agents.investigation.status === "working";

  return (
    <Card className="h-full flex flex-col">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base">
            Investigating {providerId}
          </CardTitle>
          {isComplete ? (
            <Badge variant="success">Complete</Badge>
          ) : error ? (
            <Badge variant="error">Error</Badge>
          ) : (
            <Badge variant="info" className="gap-1">
              <Loader2 className="h-3 w-3 animate-spin" />
              Running
            </Badge>
          )}
        </div>
      </CardHeader>
      <CardContent className="flex-1 overflow-hidden flex flex-col gap-4">
        {error ? (
          <div className="flex-1 flex items-center justify-center">
            <p className="text-red-400 text-sm">{error}</p>
          </div>
        ) : (
          <>
            {/* Agent Status */}
            <div className="flex gap-2">
              <AgentBadge agent="detection" status={agents.detection.status} />
              <div className={cn(
                "flex items-center gap-1 px-2 text-[10px]",
                hasActiveDelegation ? "text-emerald-400" : "text-zinc-600"
              )}>
                <ArrowDown className="h-3 w-3" />
                A2A
              </div>
              <AgentBadge agent="investigation" status={agents.investigation.status} />
            </div>

            {/* Two Column Layout: Tool Calls + Reasoning */}
            <div className="flex-1 min-h-0 grid grid-cols-2 gap-4">
              {/* Tool Calls */}
              <div className="min-h-0 overflow-hidden rounded-lg border border-zinc-800 bg-zinc-900/30 p-3">
                <div className="flex items-center gap-2 mb-3 pb-2 border-b border-zinc-800">
                  <Wrench className="h-3.5 w-3.5 text-blue-400" />
                  <span className="text-xs font-medium text-zinc-300">MCP Tool Calls</span>
                  {toolCalls.length > 0 && (
                    <Badge variant="default" className="text-[10px]">{toolCalls.length}</Badge>
                  )}
                </div>
                <div ref={toolCallsContainerRef} className="h-[260px] overflow-y-auto pr-2">
                  <div className="space-y-1.5">
                    {toolCalls.map((tool, index) => {
                      const prevTool = toolCalls[index - 1];
                      const showHandoff = prevTool?.agent === "detection" && tool.agent === "investigation";

                      return (
                        <div key={tool.id}>
                          {showHandoff && (
                            <div className="flex items-center gap-2 py-2 my-1">
                              <div className="flex-1 h-px bg-gradient-to-r from-blue-500/50 to-green-500/50" />
                              <div className="flex items-center gap-1 px-2 py-0.5 bg-zinc-900 border border-zinc-700 rounded text-[10px] text-zinc-400">
                                <ArrowDown className="h-3 w-3 text-emerald-500" />
                                A2A Handoff
                              </div>
                              <div className="flex-1 h-px bg-gradient-to-r from-green-500/50 to-transparent" />
                            </div>
                          )}
                          <ToolCallItem tool={tool} />
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>

              {/* Reasoning */}
              <div className="min-h-0 overflow-hidden rounded-lg border border-zinc-800 bg-zinc-900/30 p-3">
                <div className="flex items-center gap-2 mb-3 pb-2 border-b border-zinc-800">
                  <Brain className="h-3.5 w-3.5 text-purple-400" />
                  <span className="text-xs font-medium text-zinc-300">Agent Reasoning</span>
                </div>
                <div ref={thoughtsContainerRef} className="h-[260px] overflow-y-auto pr-2">
                  <div className="space-y-2">
                    {thoughts.map((thought) => (
                      <div
                        key={thought.id}
                        className={cn(
                          "text-xs p-2 rounded border",
                          thought.agent === "detection"
                            ? "border-blue-900/30 bg-blue-950/10"
                            : "border-green-900/30 bg-green-950/10"
                        )}
                      >
                        <div className="flex items-center gap-1 mb-1">
                          <div
                            className={cn(
                              "w-1.5 h-1.5 rounded-full",
                              thought.agent === "detection" ? "bg-blue-400" : "bg-green-400"
                            )}
                          />
                          <span className="text-zinc-500">
                            {thought.agent === "detection" ? "Claude" : "Gemini"}
                          </span>
                        </div>
                        <p className="text-zinc-400 line-clamp-3">{thought.text}</p>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}

function AgentBadge({ agent, status }: { agent: AgentId; status: AgentState["status"] }) {
  const isDetection = agent === "detection";
  const isWorking = status === "working";
  const isCompleted = status === "completed";

  return (
    <div
      className={cn(
        "flex items-center gap-1.5 px-2 py-1 rounded text-xs",
        isWorking && isDetection && "bg-blue-950/30 text-blue-400",
        isWorking && !isDetection && "bg-green-950/30 text-green-400",
        isCompleted && "bg-zinc-800/50 text-zinc-400",
        !isWorking && !isCompleted && "bg-zinc-900 text-zinc-600"
      )}
    >
      {isWorking && <Loader2 className="h-3 w-3 animate-spin" />}
      {isCompleted && <CheckCircle2 className="h-3 w-3" />}
      {!isWorking && !isCompleted && <div className="w-1.5 h-1.5 rounded-full bg-zinc-700" />}
      <span>{isDetection ? "Claude" : "Gemini"}</span>
    </div>
  );
}

function ToolCallItem({ tool }: { tool: ToolCall }) {
  const isDetection = tool.agent === "detection";

  const getStatusIcon = () => {
    switch (tool.status) {
      case "running":
        return <Loader2 className="h-3.5 w-3.5 animate-spin text-blue-400" />;
      case "success":
        return <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400" />;
      case "error":
        return <XCircle className="h-3.5 w-3.5 text-red-400" />;
    }
  };

  return (
    <div
      className={cn(
        "border bg-zinc-950 p-2 rounded",
        isDetection ? "border-blue-900/30" : "border-green-900/30"
      )}
    >
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1.5">
          {getStatusIcon()}
          <span className="font-mono text-[11px] text-zinc-300">
            {formatToolName(tool.name)}
          </span>
        </div>
        {tool.status === "success" && tool.duration && (
          <Badge variant="success" className="text-[10px] px-1.5 py-0">
            {tool.duration}ms
          </Badge>
        )}
        {tool.status === "running" && (
          <Badge variant="info" className="text-[10px] px-1.5 py-0">
            Running
          </Badge>
        )}
      </div>
    </div>
  );
}

function formatToolName(name: string): string {
  return name
    .split("_")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}

function parseInvestigationResult(
  providerId: string,
  content: string,
  protocolSteps: ProtocolStep[]
): InvestigationResult {
  // Try to parse JSON from ```json code blocks first
  const jsonMatch = content.match(/```json\s*([\s\S]*?)\s*```/);
  if (jsonMatch && jsonMatch[1]) {
    try {
      const parsed = JSON.parse(jsonMatch[1]);
      // Validate required fields and return structured result
      if (parsed.providerId && parsed.riskScore !== undefined) {
        return {
          providerId: parsed.providerId,
          riskLevel: parsed.riskLevel || "critical",
          riskScore: parsed.riskScore,
          riskPercentile: parsed.riskPercentile || 99,
          confidence: parsed.confidence || 85,
          totalClaims: parsed.totalClaims || 0,
          claimsBaselineMultiplier: parsed.claimsBaselineMultiplier || 0,
          totalReimbursements: parsed.totalReimbursements || 0,
          reimbursementBaselineMultiplier: parsed.reimbursementBaselineMultiplier || 0,
          averageClaimAmount: parsed.averageClaimAmount || 0,
          summary: parsed.summary || `Investigation of ${providerId} complete.`,
          fraudRing: parsed.fraudRing || [],
          fraudRingTotal: parsed.fraudRingTotal || 0,
          fraudRingClaimsTotal: parsed.fraudRingClaimsTotal || 0,
          redFlags: parsed.redFlags || [],
          recommendations: parsed.recommendations || [],
          protocolSteps,
        };
      }
    } catch {
      console.warn("Failed to parse JSON from response, falling back to regex parsing");
    }
  }

  // Fallback: regex parsing for non-JSON responses
  console.warn("No JSON found in response, using regex parsing");

  // Get known provider data as fallback
  const providerData = HIGH_RISK_PROVIDERS.find(p => p.id === providerId);

  // Extract risk score
  const riskScoreMatch = content.match(/Risk Score[:\s]*(\d+)\/100/i) || content.match(/(\d+)\/100/);
  const riskScore = riskScoreMatch?.[1] ? parseInt(riskScoreMatch[1]) : 80;

  // Extract confidence
  const confidenceMatch = content.match(/(\d+)%\s*confidence/i) || content.match(/confidence[:\s]*(\d+)%/i);
  const confidence = confidenceMatch?.[1] ? parseInt(confidenceMatch[1]) : 85;

  // Extract claims count
  const claimsMatch = content.match(/(\d{1,3}(?:,\d{3})*)\s*claims/i) || content.match(/Claims[:\s]*(\d{1,3}(?:,\d{3})*)/i);
  const totalClaims = claimsMatch?.[1] ? parseInt(claimsMatch[1].replace(/,/g, "")) : (providerData?.claimsCount || 0);

  // Extract baseline multiplier for claims
  const claimsBaselineMatch = content.match(/(\d+(?:\.\d+)?)[x×]\s*(?:above\s*)?baseline/i);
  const claimsBaselineMultiplier = claimsBaselineMatch?.[1] ? parseFloat(claimsBaselineMatch[1]) : (providerData?.claimsBaselineMultiplier || 0);

  // Extract total reimbursements
  let totalReimbursements = 0;
  const patterns = [
    /Total\s*Reimbursements?[:\s]*\$?([\d,]+)/i,
    /\$?([\d.]+)\s*M(?:illion)?/i,
    /\$?([\d.]+)\s*million/i,
  ];

  for (const pattern of patterns) {
    const match = content.match(pattern);
    if (match?.[1]) {
      const valStr = match[1].replace(/,/g, "");
      const val = parseFloat(valStr);
      if (val > 0) {
        totalReimbursements = val < 1000 ? val * 1000000 : val;
        break;
      }
    }
  }

  if (totalReimbursements === 0 && providerData) {
    totalReimbursements = providerData.totalReimbursement;
  }

  const reimbursementBaselineMultiplier = providerData?.baselineMultiplier || 0;

  // Extract fraud ring members
  const fraudRingMatches = content.match(/PRV\d{5}/g) || [];
  const uniqueProviders = [...new Set(fraudRingMatches)].filter(id => id !== providerId);
  const fraudRing = uniqueProviders.slice(0, 6).map((id, index) => ({
    id,
    similarity: 90 - (index * 5),
    totalReimbursement: 2000000,
    baselineMultiplier: 15,
  }));

  // Extract red flags
  const redFlagsSection = content.match(/(?:Red Flags?|Risk Indicators?)[:\s]*\n([\s\S]*?)(?=\n(?:##|Recommend|$))/i);
  const redFlags: string[] = [];
  if (redFlagsSection?.[1]) {
    const lines = redFlagsSection[1].split('\n');
    for (const line of lines) {
      const cleaned = line.replace(/^[\s\-\*•\d.]+/, '').trim();
      if (cleaned.length > 10 && cleaned.length < 200) {
        redFlags.push(cleaned);
      }
    }
  }

  // Extract recommendations
  const recommendSection = content.match(/(?:Recommend|Action)[:\s]*\n([\s\S]*?)(?=\n(?:##|$))/i);
  const recommendations: string[] = [];
  if (recommendSection?.[1]) {
    const lines = recommendSection[1].split('\n');
    for (const line of lines) {
      const cleaned = line.replace(/^[\s\-\*•\d.]+/, '').trim();
      if (cleaned.length > 10 && cleaned.length < 200) {
        recommendations.push(cleaned);
      }
    }
  }

  // Extract summary
  const summaryMatch = content.match(/^(.{50,300}?\.)/);
  const summary = summaryMatch
    ? summaryMatch[0].trim()
    : `Investigation of ${providerId} reveals critical risk indicators requiring immediate attention.`;

  return {
    providerId,
    riskLevel: "critical",
    riskScore,
    riskPercentile: 99,
    confidence,
    totalClaims,
    claimsBaselineMultiplier,
    totalReimbursements,
    reimbursementBaselineMultiplier,
    averageClaimAmount: totalClaims > 0 ? Math.round(totalReimbursements / totalClaims) : 0,
    summary,
    fraudRing,
    fraudRingTotal: totalReimbursements * (fraudRing.length + 1),
    fraudRingClaimsTotal: fraudRing.length * 1500,
    redFlags: redFlags.slice(0, 4),
    recommendations: recommendations.slice(0, 5),
    protocolSteps,
  };
}
