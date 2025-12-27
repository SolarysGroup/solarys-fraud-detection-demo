"use client";

import { useState, useCallback, useRef, useEffect } from "react";
import { ProviderTable } from "./ProviderTable";
import { InvestigationReport } from "./InvestigationReport";
import { LiveInvestigation } from "./LiveInvestigation";
import { HIGH_RISK_PROVIDERS, PRELOADED_INVESTIGATION } from "./data";
import type { Provider, InvestigationResult } from "./types";

export function InvestigationView() {
  const [providers, setProviders] = useState<Provider[]>(HIGH_RISK_PROVIDERS);
  const [selectedProviderId, setSelectedProviderId] = useState<string>("PRV54742");
  const [investigations, setInvestigations] = useState<Record<string, InvestigationResult>>({
    "PRV54742": PRELOADED_INVESTIGATION,
  });
  const [activeInvestigation, setActiveInvestigation] = useState<string | null>(null);
  const [investigationComplete, setInvestigationComplete] = useState(false);

  const reportRef = useRef<HTMLDivElement>(null);

  const selectedInvestigation = selectedProviderId ? investigations[selectedProviderId] : null;

  // Scroll to report when investigation completes
  useEffect(() => {
    if (investigationComplete && reportRef.current) {
      reportRef.current.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  }, [investigationComplete]);

  const handleSelectProvider = useCallback((providerId: string) => {
    // Only clear if selecting a DIFFERENT provider
    if (providerId !== selectedProviderId) {
      setActiveInvestigation(null);
      setInvestigationComplete(false);
    }
    setSelectedProviderId(providerId);
  }, [selectedProviderId]);

  const handleInvestigate = useCallback((providerId: string) => {
    setSelectedProviderId(providerId);
    setActiveInvestigation(providerId);
    setInvestigationComplete(false);
  }, []);

  const handleInvestigationComplete = useCallback(
    (result: InvestigationResult) => {
      setInvestigations((prev) => ({
        ...prev,
        [result.providerId]: result,
      }));
      setProviders((prev) =>
        prev.map((p) =>
          p.id === result.providerId ? { ...p, investigated: true } : p
        )
      );
      // Mark complete but DON'T clear activeInvestigation - keeps the panel mounted
      setInvestigationComplete(true);
    },
    []
  );

  return (
    <div className="space-y-4">
      {/* Provider Table - Full Width */}
      <ProviderTable
        providers={providers}
        selectedProviderId={selectedProviderId}
        onSelectProvider={handleSelectProvider}
        onInvestigate={handleInvestigate}
        isInvestigating={activeInvestigation !== null}
      />

      {/* Investigation Report and/or Live Investigation - Full Width */}
      {activeInvestigation ? (
        // Investigation in progress or just completed
        <>
          {/* Show report above when complete */}
          {investigationComplete && selectedInvestigation && (
            <div ref={reportRef}>
              <InvestigationReport result={selectedInvestigation} />
            </div>
          )}
          {/* LiveInvestigation stays mounted to preserve tool calls/reasoning */}
          <LiveInvestigation
            providerId={activeInvestigation}
            onComplete={handleInvestigationComplete}
          />
        </>
      ) : selectedInvestigation ? (
        // Viewing a previously completed investigation
        <InvestigationReport result={selectedInvestigation} />
      ) : (
        <div className="h-[400px] flex items-center justify-center border border-zinc-800 rounded-lg bg-zinc-900/30">
          <div className="text-center p-6">
            <p className="text-zinc-500 text-sm">
              Select a provider to view their investigation or click &quot;Investigate&quot; to run a new analysis.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
