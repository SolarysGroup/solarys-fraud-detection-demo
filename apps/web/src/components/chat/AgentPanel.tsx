"use client";

import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import type { AgentId, AgentState, A2ADelegation } from "./types";

interface AgentPanelProps {
  agents: Record<AgentId, AgentState>;
  activeDelegation: A2ADelegation | null;
}

export function AgentPanel({ agents, activeDelegation }: AgentPanelProps) {
  return (
    <Card className="flex flex-col">
      <CardHeader className="pb-2">
        <CardTitle className="text-sm">AI Agents</CardTitle>
      </CardHeader>
      <CardContent className="pt-0">
        <div className="relative flex flex-col gap-2">
          {/* Detection Agent */}
          <AgentCard agent={agents.detection} />

          {/* A2A Connection Line */}
          <div className="relative py-1 flex justify-center">
            <div
              className={cn(
                "absolute left-1/2 -translate-x-1/2 w-0.5 h-full transition-all duration-300",
                activeDelegation
                  ? "bg-gradient-to-b from-blue-500 to-green-500"
                  : "bg-zinc-800"
              )}
            />
            <div
              className={cn(
                "relative z-10 px-2 py-0.5 text-[10px] font-mono rounded transition-all duration-300",
                activeDelegation
                  ? "bg-zinc-900 text-emerald-400 border border-emerald-800"
                  : "bg-zinc-900 text-zinc-600 border border-zinc-800"
              )}
            >
              A2A
            </div>
          </div>

          {/* Investigation Agent */}
          <AgentCard agent={agents.investigation} />
        </div>
      </CardContent>
    </Card>
  );
}

function AgentCard({ agent }: { agent: AgentState }) {
  const isActive = agent.status === "working";
  const isCompleted = agent.status === "completed";

  const getVendorColor = () => {
    return agent.vendor === "anthropic" ? "blue" : "green";
  };

  const color = getVendorColor();

  return (
    <div
      className={cn(
        "relative border rounded-lg p-3 transition-all duration-300",
        isActive && color === "blue" && "border-blue-500/50 bg-blue-950/20",
        isActive && color === "green" && "border-green-500/50 bg-green-950/20",
        isCompleted && "border-zinc-700 bg-zinc-900/50",
        !isActive && !isCompleted && "border-zinc-800 bg-zinc-950"
      )}
    >
      <div className="flex items-center gap-2">
        {/* Status Indicator */}
        <div
          className={cn(
            "w-2 h-2 rounded-full transition-all duration-300",
            isActive && color === "blue" && "bg-blue-400 animate-pulse",
            isActive && color === "green" && "bg-green-400 animate-pulse",
            isCompleted && "bg-zinc-500",
            !isActive && !isCompleted && "bg-zinc-700 border border-zinc-600"
          )}
        />

        {/* Agent Name */}
        <span
          className={cn(
            "text-sm font-medium transition-colors duration-300",
            isActive && "text-white",
            !isActive && "text-zinc-400"
          )}
        >
          {agent.name}
        </span>
      </div>

      {/* Agent Details */}
      <div className="mt-1 flex items-center gap-2 text-xs text-zinc-500">
        <span className="font-mono">{agent.model}</span>
        <span className="text-zinc-700">•</span>
        <span className="capitalize">{agent.vendor}</span>
      </div>

      {/* Status Badge */}
      <div className="mt-2">
        <span
          className={cn(
            "inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-medium",
            isActive && color === "blue" && "bg-blue-500/20 text-blue-300",
            isActive && color === "green" && "bg-green-500/20 text-green-300",
            isCompleted && "bg-zinc-800 text-zinc-400",
            !isActive && !isCompleted && "bg-zinc-900 text-zinc-600"
          )}
        >
          {isActive && (
            <span className="w-1.5 h-1.5 rounded-full bg-current animate-pulse" />
          )}
          {agent.status === "idle" && "Idle"}
          {agent.status === "working" && "Working"}
          {agent.status === "completed" && "Completed"}
        </span>
      </div>
    </div>
  );
}
