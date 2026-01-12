"use client";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { CheckCircle2, Search, AlertTriangle } from "lucide-react";
import { cn } from "@/lib/utils";
import type { Provider } from "./types";
import { formatCurrency, formatNumber } from "./data";

interface ProviderTableProps {
  providers: Provider[];
  selectedProviderId: string | null;
  onSelectProvider: (providerId: string) => void;
  onInvestigate: (providerId: string) => void;
  isInvestigating: boolean;
}

export function ProviderTable({
  providers,
  selectedProviderId,
  onSelectProvider,
  onInvestigate,
  isInvestigating,
}: ProviderTableProps) {
  // Find the first uninvestigated provider for the pulsing CTA
  const firstUninvestigatedId = providers.find(p => !p.investigated)?.id;
  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base flex items-center gap-2">
            <AlertTriangle className="h-4 w-4 text-red-400" />
            High-Risk Providers
          </CardTitle>
          <Badge variant="error" className="text-xs">
            {providers.length} Critical
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="p-0">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-y border-zinc-800 bg-zinc-900/50">
                <th className="text-left py-2 px-4 font-medium text-zinc-400">Provider</th>
                <th className="text-left py-2 px-4 font-medium text-zinc-400">Risk</th>
                <th className="text-right py-2 px-4 font-medium text-zinc-400">Total Billed</th>
                <th className="text-right py-2 px-4 font-medium text-zinc-400">Claims</th>
                <th className="text-right py-2 px-4 font-medium text-zinc-400">Action</th>
              </tr>
            </thead>
            <tbody>
              {providers.map((provider) => (
                <ProviderRow
                  key={provider.id}
                  provider={provider}
                  isSelected={provider.id === selectedProviderId}
                  onSelect={() => onSelectProvider(provider.id)}
                  onInvestigate={() => onInvestigate(provider.id)}
                  isInvestigating={isInvestigating && provider.id === selectedProviderId}
                  shouldPulse={provider.id === firstUninvestigatedId && !isInvestigating}
                />
              ))}
            </tbody>
          </table>
        </div>
      </CardContent>
    </Card>
  );
}

interface ProviderRowProps {
  provider: Provider;
  isSelected: boolean;
  onSelect: () => void;
  onInvestigate: () => void;
  isInvestigating: boolean;
  shouldPulse: boolean;
}

function ProviderRow({
  provider,
  isSelected,
  onSelect,
  onInvestigate,
  isInvestigating,
  shouldPulse,
}: ProviderRowProps) {
  const getRiskBadge = () => {
    switch (provider.riskLevel) {
      case "critical":
        return <Badge variant="error">{provider.baselineMultiplier}x</Badge>;
      case "high":
        return <Badge variant="warning">{provider.baselineMultiplier}x</Badge>;
      default:
        return <Badge variant="default">{provider.baselineMultiplier}x</Badge>;
    }
  };

  return (
    <tr
      className={cn(
        "border-b border-zinc-800/50 cursor-pointer transition-colors",
        isSelected ? "bg-zinc-800/50" : "hover:bg-zinc-900/50"
      )}
      onClick={onSelect}
    >
      <td className="py-3 px-4">
        <div className="flex items-center gap-2">
          <span className="font-mono text-zinc-200">{provider.id}</span>
          {provider.investigated && (
            <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400" />
          )}
        </div>
      </td>
      <td className="py-3 px-4">{getRiskBadge()}</td>
      <td className="py-3 px-4 text-right font-mono text-zinc-300">
        {formatCurrency(provider.totalReimbursement)}
      </td>
      <td className="py-3 px-4 text-right">
        <span className="font-mono text-zinc-300">{formatNumber(provider.claimsCount)}</span>
        <span className="text-zinc-500 text-xs ml-1">({provider.claimsBaselineMultiplier}x)</span>
      </td>
      <td className="py-3 px-4 text-right">
        {provider.investigated ? (
          <Button
            variant="ghost"
            size="sm"
            onClick={(e) => {
              e.stopPropagation();
              onSelect();
            }}
            className="text-emerald-400 hover:text-emerald-300"
          >
            View Report
          </Button>
        ) : (
          <Button
            variant="outline"
            size="sm"
            onClick={(e) => {
              e.stopPropagation();
              onInvestigate();
            }}
            disabled={isInvestigating}
            className={cn(
              "gap-1",
              shouldPulse && "animate-pulse-glow border-zinc-400/50 bg-zinc-800/50 text-zinc-100 hover:bg-zinc-700/50 hover:text-white"
            )}
          >
            <Search className="h-3 w-3" />
            {isInvestigating ? "Investigating..." : "Investigate"}
          </Button>
        )}
      </td>
    </tr>
  );
}
