"use client";

import { Badge } from "@/components/ui/badge";
import { CheckCircle2 } from "lucide-react";

export function ProtocolBadges() {
  return (
    <div className="flex flex-wrap gap-2">
      <Badge variant="outline" className="text-xs gap-1 border-emerald-800 text-emerald-400">
        <CheckCircle2 className="h-3 w-3" />
        MCP
      </Badge>
      <Badge variant="outline" className="text-xs gap-1 border-emerald-800 text-emerald-400">
        <CheckCircle2 className="h-3 w-3" />
        A2A v0.3
      </Badge>
      <Badge variant="outline" className="text-xs gap-1 border-emerald-800 text-emerald-400">
        <CheckCircle2 className="h-3 w-3" />
        Multi-vendor
      </Badge>
    </div>
  );
}
