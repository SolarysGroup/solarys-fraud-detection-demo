"use client";

import { Badge } from "@/components/ui/badge";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Brain } from "lucide-react";
import { cn } from "@/lib/utils";
import type { ThinkingEntry } from "./types";

interface ThinkingPanelProps {
  thoughts: ThinkingEntry[];
}

export function ThinkingPanel({ thoughts }: ThinkingPanelProps) {
  if (thoughts.length === 0) {
    return (
      <Card className="h-full flex flex-col">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm flex items-center gap-2">
            <Brain className="h-4 w-4" />
            Agent Reasoning
          </CardTitle>
        </CardHeader>
        <CardContent className="flex-1 flex items-center justify-center">
          <p className="text-zinc-500 text-xs text-center px-4">
            Agent reasoning will appear here as they analyze data.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="h-full flex flex-col overflow-hidden">
      <CardHeader className="pb-2 flex-shrink-0">
        <CardTitle className="text-sm flex items-center gap-2">
          <Brain className="h-4 w-4" />
          Agent Reasoning
          <Badge variant="default" className="text-xs">
            {thoughts.length}
          </Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="flex-1 p-0 overflow-hidden relative">
        <div className="absolute inset-0 overflow-y-auto px-3 pb-3">
          <div className="space-y-2">
            {thoughts.map((thought) => (
              <ThinkingEntry key={thought.id} thought={thought} />
            ))}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function ThinkingEntry({ thought }: { thought: ThinkingEntry }) {
  const isDetection = thought.agent === "detection";

  return (
    <div
      className={cn(
        "border rounded p-2",
        isDetection
          ? "border-blue-900/30 bg-blue-950/20"
          : "border-green-900/30 bg-green-950/20"
      )}
    >
      <div className="flex items-center gap-2 mb-1">
        <div
          className={cn(
            "w-1.5 h-1.5 rounded-full",
            isDetection ? "bg-blue-400" : "bg-green-400"
          )}
        />
        <span className="text-[10px] font-medium text-zinc-400">
          {isDetection ? "Claude" : "Gemini"}
        </span>
        <span className="text-[10px] text-zinc-600">
          {thought.timestamp.toLocaleTimeString()}
        </span>
      </div>
      <p className="text-xs text-zinc-300 leading-relaxed whitespace-pre-wrap">
        {thought.text.length > 300
          ? thought.text.substring(0, 300) + "..."
          : thought.text}
      </p>
    </div>
  );
}
