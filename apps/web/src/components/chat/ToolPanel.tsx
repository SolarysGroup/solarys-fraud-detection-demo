"use client";

import { Badge } from "@/components/ui/badge";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Loader2, CheckCircle2, XCircle, ArrowDown } from "lucide-react";
import { cn } from "@/lib/utils";
import type { ToolCall, A2ADelegation, AgentId } from "./types";

interface ToolPanelProps {
  toolCalls: ToolCall[];
  delegations: A2ADelegation[];
}

export function ToolPanel({ toolCalls, delegations }: ToolPanelProps) {
  if (toolCalls.length === 0 && delegations.length === 0) {
    return (
      <Card className="h-full flex flex-col">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm">MCP Tool Calls</CardTitle>
        </CardHeader>
        <CardContent className="flex-1 flex items-center justify-center">
          <p className="text-zinc-500 text-xs text-center px-4">
            Tool calls will appear here as agents investigate fraud patterns.
          </p>
        </CardContent>
      </Card>
    );
  }

  // Group tool calls and delegations by order, inserting delegation markers
  const groupedItems = buildGroupedItems(toolCalls, delegations);

  return (
    <Card className="h-full flex flex-col">
      <CardHeader className="pb-2">
        <CardTitle className="text-sm flex items-center gap-2">
          MCP Tool Calls
          <Badge variant="default" className="text-xs">
            {toolCalls.length}
          </Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="flex-1 p-0 overflow-hidden">
        <ScrollArea className="h-full px-3 pb-3">
          <div className="space-y-1.5">
            {groupedItems.map((item, index) => {
              if (item.type === "agent-header") {
                return (
                  <AgentHeader
                    key={`header-${item.agent}-${index}`}
                    agent={item.agent}
                    isFirst={index === 0}
                  />
                );
              } else if (item.type === "delegation") {
                return (
                  <DelegationMarker key={`delegation-${index}`} />
                );
              } else {
                return (
                  <ToolCallItem key={item.tool.id} tool={item.tool} />
                );
              }
            })}
          </div>
        </ScrollArea>
      </CardContent>
    </Card>
  );
}

type GroupedItem =
  | { type: "agent-header"; agent: AgentId }
  | { type: "delegation" }
  | { type: "tool"; tool: ToolCall };

function buildGroupedItems(
  toolCalls: ToolCall[],
  delegations: A2ADelegation[]
): GroupedItem[] {
  const items: GroupedItem[] = [];
  let currentAgent: AgentId | null = null;
  let delegationInserted = false;

  // Sort tool calls by startTime
  const sortedCalls = [...toolCalls].sort(
    (a, b) => a.startTime.getTime() - b.startTime.getTime()
  );

  for (const tool of sortedCalls) {
    // Check if we need to insert a delegation marker
    if (!delegationInserted && delegations.length > 0) {
      const delegation = delegations[0];
      if (
        delegation &&
        tool.agent === delegation.to &&
        currentAgent === delegation.from
      ) {
        items.push({ type: "delegation" });
        delegationInserted = true;
      }
    }

    // Check if we need an agent header
    if (tool.agent !== currentAgent) {
      items.push({ type: "agent-header", agent: tool.agent });
      currentAgent = tool.agent;
    }

    items.push({ type: "tool", tool });
  }

  return items;
}

function AgentHeader({ agent, isFirst }: { agent: AgentId; isFirst: boolean }) {
  const isDetection = agent === "detection";
  return (
    <div className={cn("flex items-center gap-2 py-1", !isFirst && "pt-3")}>
      <div
        className={cn(
          "w-1.5 h-1.5 rounded-full",
          isDetection ? "bg-blue-400" : "bg-green-400"
        )}
      />
      <span className="text-xs font-medium text-zinc-400">
        {isDetection ? "Detection Agent" : "Investigation Agent"}
      </span>
      <span className="text-xs text-zinc-600">
        ({isDetection ? "Claude" : "Gemini"})
      </span>
    </div>
  );
}

function DelegationMarker() {
  return (
    <div className="flex items-center gap-2 py-2 my-1">
      <div className="flex-1 h-px bg-gradient-to-r from-blue-500/50 to-green-500/50" />
      <div className="flex items-center gap-1 px-2 py-0.5 bg-zinc-900 border border-zinc-700 rounded text-[10px] text-zinc-400">
        <ArrowDown className="h-3 w-3 text-emerald-500" />
        <span>A2A Handoff</span>
      </div>
      <div className="flex-1 h-px bg-gradient-to-r from-green-500/50 to-transparent" />
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

  const getStatusBadge = () => {
    switch (tool.status) {
      case "running":
        return <Badge variant="info" className="text-[10px] px-1.5 py-0">Running</Badge>;
      case "success":
        return <Badge variant="success" className="text-[10px] px-1.5 py-0">{tool.duration}ms</Badge>;
      case "error":
        return <Badge variant="error" className="text-[10px] px-1.5 py-0">Error</Badge>;
    }
  };

  // Format tool name for display
  const formatToolName = (name: string) => {
    return name
      .split("_")
      .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
      .join(" ");
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
        {getStatusBadge()}
      </div>
    </div>
  );
}
