"use client";

import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { AlertTriangle, Users, ArrowDown } from "lucide-react";
import type { InvestigationResult } from "./types";
import { formatCurrency, formatNumber } from "./data";

interface InvestigationReportProps {
  result: InvestigationResult;
}

export function InvestigationReport({ result }: InvestigationReportProps) {
  return (
    <Card>
      <CardHeader className="pb-4">
        <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-3">
          <CardTitle className="text-base sm:text-lg">Investigation: {result.providerId}</CardTitle>
          <Badge variant="error">Critical Risk</Badge>
        </div>
      </CardHeader>

      <CardContent className="space-y-6">
        {/* Top Section: Metrics + Protocol */}
        <div className="flex flex-col lg:flex-row gap-6">
          {/* Left: Key Metrics */}
          <div className="flex-1 min-w-0">
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-4">
              <MetricBox label="Risk Score" value={`${result.riskScore}/100`} sublabel={`${result.riskPercentile}th percentile`} />
              <MetricBox label="Confidence" value={`${result.confidence}%`} />
              <MetricBox label="Total Claims" value={formatNumber(result.totalClaims)} sublabel={`${result.claimsBaselineMultiplier}x baseline`} />
              <MetricBox label="Total Billed" value={formatCurrency(result.totalReimbursements)} sublabel={`${result.reimbursementBaselineMultiplier}x baseline`} />
            </div>
            <p className="text-sm text-zinc-400">{result.summary}</p>
          </div>

          {/* Right: Protocol Steps */}
          <div className="w-full lg:w-56 shrink-0">
            <div className="text-sm font-medium text-zinc-400 mb-3">Protocol</div>
            <ProtocolMini steps={result.protocolSteps} />
          </div>
        </div>

        {/* Fraud Ring */}
        <div>
          <div className="flex flex-col sm:flex-row sm:items-center gap-2 mb-3">
            <div className="flex items-center gap-2">
              <Users className="h-4 w-4 text-orange-400" />
              <span className="text-sm font-medium text-zinc-300">Fraud Ring Detected</span>
              <Badge variant="warning">{result.fraudRing.length + 1} Providers</Badge>
            </div>
            <span className="text-sm text-zinc-500 sm:ml-auto">
              Combined exposure: <span className="text-red-400 font-mono">{formatCurrency(result.fraudRingTotal)}</span>
            </span>
          </div>
          <div className="flex flex-wrap gap-2">
            <div className="px-3 py-1.5 bg-red-950/30 border border-red-900/50 rounded text-xs">
              <span className="font-mono text-zinc-300">{result.providerId}</span>
              <span className="text-zinc-500 ml-2">Primary</span>
            </div>
            {result.fraudRing.map((member) => (
              <div key={member.id} className="px-3 py-1.5 bg-zinc-900 border border-zinc-800 rounded text-xs">
                <span className="font-mono text-zinc-300">{member.id}</span>
                <span className="text-zinc-500 ml-2">{member.similarity}% match</span>
              </div>
            ))}
          </div>
        </div>

        {/* Two Column: Red Flags + Recommendations */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <div className="flex items-center gap-2 mb-3">
              <AlertTriangle className="h-4 w-4 text-red-400" />
              <span className="text-sm font-medium text-zinc-300">Red Flags</span>
            </div>
            <ul className="space-y-1.5">
              {result.redFlags.map((flag, i) => (
                <li key={i} className="flex items-start gap-2 text-sm text-zinc-400">
                  <span className="text-red-400 mt-0.5">•</span>
                  {flag}
                </li>
              ))}
            </ul>
          </div>
          <div>
            <div className="flex items-center gap-2 mb-3">
              <span className="text-sm font-medium text-zinc-300">Recommended Actions</span>
            </div>
            <ol className="space-y-1.5">
              {result.recommendations.map((rec, i) => (
                <li key={i} className="flex items-start gap-2 text-sm text-zinc-400">
                  <span className="text-emerald-400 font-mono text-xs">{i + 1}.</span>
                  {rec}
                </li>
              ))}
            </ol>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function MetricBox({ label, value, sublabel }: { label: string; value: string; sublabel?: string }) {
  return (
    <div className="bg-zinc-900/50 border border-zinc-800 rounded p-3">
      <div className="text-[10px] text-zinc-500 uppercase tracking-wider">{label}</div>
      <div className="text-lg font-mono font-bold text-zinc-200">{value}</div>
      {sublabel && <div className="text-[10px] text-zinc-500">{sublabel}</div>}
    </div>
  );
}

interface ProtocolMiniProps {
  steps: InvestigationResult["protocolSteps"];
}

function ProtocolMini({ steps }: ProtocolMiniProps) {
  const claudeSteps = steps.filter((s) => s.agent === "detection");
  const geminiSteps = steps.filter((s) => s.agent === "investigation");
  const claudeTime = claudeSteps.reduce((sum, s) => sum + s.duration, 0);
  const geminiTime = geminiSteps.reduce((sum, s) => sum + s.duration, 0);

  return (
    <div className="bg-zinc-900/50 border border-zinc-800 rounded-lg p-4 space-y-2">
      {/* Claude */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-2.5 h-2.5 rounded-full bg-blue-400" />
          <span className="text-sm font-medium text-zinc-300">Claude</span>
        </div>
        <div className="text-xs text-zinc-500 text-right">
          <span>{claudeSteps.length} tools</span>
          <span className="mx-1.5">·</span>
          <span className="font-mono">{claudeTime.toLocaleString()}ms</span>
        </div>
      </div>

      {/* A2A Arrow */}
      <div className="flex items-center gap-2 py-2">
        <div className="flex-1 h-px bg-gradient-to-r from-blue-500/50 to-green-500/50" />
        <ArrowDown className="h-4 w-4 text-emerald-500" />
        <div className="flex-1 h-px bg-gradient-to-r from-green-500/50 to-transparent" />
      </div>

      {/* Gemini */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-2.5 h-2.5 rounded-full bg-green-400" />
          <span className="text-sm font-medium text-zinc-300">Gemini</span>
        </div>
        <div className="text-xs text-zinc-500 text-right">
          <span>{geminiSteps.length} tools</span>
          <span className="mx-1.5">·</span>
          <span className="font-mono">{geminiTime.toLocaleString()}ms</span>
        </div>
      </div>
    </div>
  );
}
