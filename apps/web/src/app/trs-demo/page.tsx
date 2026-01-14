"use client";

import Image from "next/image";
import { InvestigationView } from "@/components/investigation";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Database, Users, Wrench, ExternalLink, Github, ArrowDown, Bot, Network } from "lucide-react";

export default function TRSDemoPage() {
  const scrollToDemo = () => {
    document.getElementById("demo-section")?.scrollIntoView({ behavior: "smooth" });
  };

  const scrollToCapabilities = () => {
    document.getElementById("protocol-section")?.scrollIntoView({ behavior: "smooth" });
  };

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100">
      {/* Hero Section */}
      <section className="border-b border-zinc-800">
        <div className="max-w-[1600px] mx-auto px-6 py-16">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
            {/* Left: Text Content */}
            <div>
              <p className="text-base text-zinc-500 uppercase tracking-widest font-medium mb-4">
                Labs
              </p>
              <h1 className="text-4xl font-bold tracking-tight mb-4">
                Solarys Fraud Detection Demo
              </h1>
              <p className="text-xl text-zinc-400 mb-8">
                A fraud investigation system running against 558K healthcare claims, with Claude and Gemini sharing the same detection tools via MCP and coordinating investigations through A2A.
              </p>
              <div className="flex flex-wrap gap-3">
                <Button variant="primary" onClick={scrollToDemo}>
                  Try it yourself
                  <ArrowDown className="ml-2 h-4 w-4" />
                </Button>
                <Button variant="outline" onClick={scrollToCapabilities}>
                  <Wrench className="mr-2 h-4 w-4" />
                  See Capabilities
                </Button>
                <a
                  href="https://github.com/SolarysGroup/solarys-fraud-detection-demo"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center justify-center h-9 px-4 py-2 text-sm font-medium border border-zinc-700 bg-transparent text-zinc-300 hover:bg-zinc-800 transition-colors"
                >
                  <Github className="mr-2 h-4 w-4" />
                  View Source
                </a>
              </div>
            </div>

            {/* Right: Architecture Diagram */}
            <div className="border border-zinc-800 bg-zinc-900 p-6">
              <div className="text-xs text-zinc-500 uppercase tracking-wider mb-4">Architecture</div>
              <div className="space-y-4">
                {/* Frontend to API */}
                <div className="flex items-center gap-3">
                  <div className="w-24 text-right text-sm text-zinc-400">Frontend</div>
                  <div className="flex-1 h-px bg-zinc-700" />
                  <div className="px-2 py-1 bg-zinc-800 text-xs font-mono text-zinc-400">HTTP</div>
                  <div className="flex-1 h-px bg-zinc-700" />
                  <div className="w-24 text-sm text-zinc-400">API</div>
                </div>

                {/* API to Detection Agent */}
                <div className="flex items-center gap-3">
                  <div className="w-24 text-right text-sm text-zinc-400">API</div>
                  <div className="flex-1 h-px bg-blue-500/50" />
                  <div className="px-2 py-1 bg-blue-950 border border-blue-800 text-xs font-mono text-blue-400">A2A</div>
                  <div className="flex-1 h-px bg-blue-500/50" />
                  <div className="w-24 text-sm text-blue-400">Claude</div>
                </div>

                {/* Detection to Investigation */}
                <div className="flex items-center gap-3">
                  <div className="w-24 text-right text-sm text-blue-400">Claude</div>
                  <div className="flex-1 h-px bg-gradient-to-r from-blue-500/50 to-green-500/50" />
                  <div className="px-2 py-1 bg-emerald-950 border border-emerald-800 text-xs font-mono text-emerald-400">A2A</div>
                  <div className="flex-1 h-px bg-gradient-to-r from-green-500/50 to-green-500/50" />
                  <div className="w-24 text-sm text-green-400">Gemini</div>
                </div>

                {/* Agents to MCP */}
                <div className="flex items-center gap-3">
                  <div className="w-24 text-right text-sm text-zinc-400">Agents</div>
                  <div className="flex-1 h-px bg-amber-500/50" />
                  <div className="px-2 py-1 bg-amber-950 border border-amber-800 text-xs font-mono text-amber-400">MCP</div>
                  <div className="flex-1 h-px bg-amber-500/50" />
                  <div className="w-24 text-sm text-amber-400">Tools</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Stats Bar */}
      <section className="border-b border-zinc-800 bg-zinc-900/50">
        <div className="max-w-[1600px] mx-auto px-6 py-6">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
            <StatItem
              icon={<Database className="h-5 w-5" />}
              value="558K"
              label="Claims"
            />
            <StatItem
              icon={<Users className="h-5 w-5" />}
              value="5,410"
              label="Providers"
            />
            <StatItem
              icon={<Bot className="h-5 w-5" />}
              value="2"
              label="AI Agents"
            />
            <StatItem
              icon={<Wrench className="h-5 w-5" />}
              value="9"
              label="MCP Tools"
            />
          </div>
        </div>
      </section>

      {/* Interactive Demo Section */}
      <section id="demo-section" className="py-12">
        <div className="max-w-[1600px] mx-auto px-6">
          <div className="mb-6">
            <h2 className="text-2xl font-bold mb-2">Fraud Investigation Dashboard</h2>
            <p className="text-zinc-400">
              Review high-risk providers and investigation reports. Click &quot;Investigate&quot; to run a live AI analysis.
            </p>
          </div>
          <InvestigationView />
        </div>
      </section>

      {/* Protocol Explanation */}
      <section id="protocol-section" className="border-t border-zinc-800 py-12 bg-zinc-900/30">
        <div className="max-w-[1600px] mx-auto px-6">
          <h2 className="text-2xl font-bold mb-8">Protocol Integration</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-12">
            <div className="border border-zinc-800 bg-zinc-900 p-6">
              <div className="flex items-center gap-3 mb-4">
                <Network className="h-5 w-5 text-blue-400" />
                <h3 className="text-lg font-semibold">Agent-to-Agent (A2A)</h3>
              </div>
              <p className="text-zinc-400 text-sm mb-4">
                Google&apos;s A2A protocol enables seamless communication between AI agents from different vendors.
                The Detection Agent (Claude) delegates complex investigations to the Investigation Agent (Gemini).
              </p>
              <div className="flex gap-2">
                <Badge variant="outline" className="text-xs border-blue-800 text-blue-400">Claude</Badge>
                <Badge variant="outline" className="text-xs border-green-800 text-green-400">Gemini</Badge>
              </div>
            </div>
            <div className="border border-zinc-800 bg-zinc-900 p-6">
              <div className="flex items-center gap-3 mb-4">
                <Wrench className="h-5 w-5 text-amber-400" />
                <h3 className="text-lg font-semibold">Model Context Protocol (MCP)</h3>
              </div>
              <p className="text-zinc-400 text-sm mb-4">
                Anthropic&apos;s MCP provides a standardized way for AI models to interact with external tools.
                Both agents access the same MCP server for fraud detection capabilities.
              </p>
              <div className="flex gap-2">
                <Badge variant="outline" className="text-xs border-amber-800 text-amber-400">9 Tools</Badge>
                <Badge variant="outline" className="text-xs border-zinc-600 text-zinc-400">HTTP Transport</Badge>
              </div>
            </div>
          </div>

          <h3 className="text-xl font-bold mb-6">Available MCP Tools</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            <ToolCard
              name="find_anomalies"
              description="Detects statistical outliers by comparing each provider's claim volume and reimbursement totals against system-wide baselines. Uses configurable threshold (0-1) to control sensitivity. Returns severity-ranked anomalies with deviation metrics showing how far each provider deviates from normal patterns."
              agent="detection"
              params={["threshold: number (0-1)"]}
              returns={["anomalyId", "severity (medium/high/critical)", "deviationMultiplier", "metrics breakdown"]}
            />
            <ToolCard
              name="detect_fraud_rings"
              description="Identifies coordinated fraud by finding clusters of providers who share an unusually high number of beneficiaries. Uses union-find algorithm to group connected providers into rings. Calculates risk based on flagged member rate, combined reimbursement, and pattern strength."
              agent="detection"
              params={["minSharedBeneficiaries: number (default: 10)"]}
              returns={["ringId", "members[]", "sharedBeneficiaryCount", "flaggedMemberRate", "riskLevel"]}
            />
            <ToolCard
              name="check_deceased_claims"
              description="Queries claims database for billing submitted after a beneficiary's recorded date of death—a primary fraud indicator. Returns claim details including days after death elapsed and amounts. Can filter by specific provider or scan system-wide."
              agent="detection"
              params={["providerId?: string (optional filter)"]}
              returns={["claimId", "dateOfDeath", "claimDate", "daysAfterDeath", "claimAmount"]}
            />
            <ToolCard
              name="get_provider_stats"
              description="Retrieves comprehensive statistics for a single provider including claim counts, reimbursement totals, and deviation ratios vs. system baselines. Calculates risk score (0-1) based on multiple factors and identifies specific risk indicators like high volume or deceased claims."
              agent="detection"
              params={["providerId: string"]}
              returns={["totalClaims", "totalReimbursement", "riskScore", "deviationFromBaseline", "riskIndicators[]"]}
            />
            <ToolCard
              name="delegate_investigation"
              description="A2A protocol bridge that hands off complex investigations to the Gemini-powered Investigation Agent. Packages case context and transfers control for deep analysis. Enables multi-vendor AI collaboration within a single workflow."
              agent="a2a"
              params={["providerId: string", "context: object"]}
              returns={["Investigation Agent response via A2A"]}
            />
            <ToolCard
              name="investigate_provider"
              description="Runs comprehensive multi-factor fraud analysis on a single provider. Combines baseline deviation analysis, deceased claims check, network analysis for fraud ring connections, and generates natural language summary with confidence score. Produces compliance-ready report with recommended actions."
              agent="investigation"
              params={["providerId: string"]}
              returns={["overallRiskLevel", "confidenceScore", "summary", "riskIndicators[]", "deceasedClaimsAnalysis", "networkAnalysis", "recommendedActions[]"]}
            />
            <ToolCard
              name="explain_risk_score"
              description="Generates detailed, plain-English explanation of why a provider received their risk level. Breaks down each contributing factor (claim volume, reimbursement, deceased claims, historical flags) with specific point values. Includes percentile comparison against other flagged providers and mitigation recommendations."
              agent="investigation"
              params={["providerId: string"]}
              returns={["riskScore (0-100)", "scoreBreakdown[]", "factorBreakdown[]", "percentileRanking", "mitigatingFactors[]", "conclusion"]}
            />
            <ToolCard
              name="search_similar_providers"
              description="Finds providers with matching billing patterns using two methods: 'statistical' (within 30% of metrics) or 'semantic' (AI embeddings via pgvector for deeper pattern matching). Useful for expanding fraud ring investigations or identifying copycat behavior patterns."
              agent="investigation"
              params={["providerId: string", "method: 'statistical' | 'semantic'"]}
              returns={["similarityScore", "sharedPatterns[]", "flaggedForFraud status", "profileSummary (semantic only)"]}
            />
            <ToolCard
              name="search_fraud_patterns"
              description="Natural language search for fraud patterns using AI embeddings. Accepts plain English queries like 'high claim volume providers treating elderly patients' or 'unusual billing patterns for outpatient procedures'. Converts query to vector embedding and searches against provider profiles using pgvector similarity."
              agent="investigation"
              params={["query: string", "limit?: number (1-20)", "minSimilarity?: number (0-1)"]}
              returns={["similarity score", "flaggedForFraud", "totalClaims", "totalReimbursement", "profileSummary"]}
            />
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-zinc-800 py-8">
        <div className="max-w-[1600px] mx-auto px-6">
          <div className="flex flex-col md:flex-row justify-between items-center gap-4">
            <a
              href="https://solarys.ai"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-2 text-zinc-400 hover:text-white transition-colors group"
            >
              <Image
                src="/mcpa2a/solaryslogo.svg"
                alt="Solarys"
                width={20}
                height={20}
                className="opacity-60 group-hover:opacity-100 transition-opacity"
              />
              <span className="text-sm font-medium tracking-wide">Engineered by the Solarys Group</span>
            </a>
            <div className="flex gap-6 text-sm">
              <a
                href="https://github.com/SolarysGroup/solarys-fraud-detection-demo#architecture"
                target="_blank"
                rel="noopener noreferrer"
                className="text-zinc-500 hover:text-zinc-300 flex items-center gap-1"
              >
                Architecture
                <ExternalLink className="h-3 w-3" />
              </a>
              <a
                href="https://github.com/SolarysGroup/solarys-fraud-detection-demo"
                target="_blank"
                rel="noopener noreferrer"
                className="text-zinc-500 hover:text-zinc-300 flex items-center gap-1"
              >
                GitHub
                <ExternalLink className="h-3 w-3" />
              </a>
              <a
                href="https://www.solarys.ai/"
                target="_blank"
                rel="noopener noreferrer"
                className="text-zinc-500 hover:text-zinc-300 flex items-center gap-1"
              >
                Contact
                <ExternalLink className="h-3 w-3" />
              </a>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}

function StatItem({
  icon,
  value,
  label,
}: {
  icon: React.ReactNode;
  value: string;
  label: string;
}) {
  return (
    <div className="flex items-center gap-3">
      <div className="text-zinc-500">{icon}</div>
      <div>
        <div className="text-2xl font-bold font-mono">{value}</div>
        <div className="text-xs text-zinc-500">{label}</div>
      </div>
    </div>
  );
}

function ToolCard({
  name,
  description,
  agent,
  params,
  returns,
}: {
  name: string;
  description: string;
  agent: "detection" | "investigation" | "a2a";
  params?: string[];
  returns?: string[];
}) {
  const getBorderColor = () => {
    switch (agent) {
      case "detection":
        return "border-blue-900/50";
      case "investigation":
        return "border-green-900/50";
      case "a2a":
        return "border-emerald-900/50";
    }
  };

  const getAgentBadge = () => {
    switch (agent) {
      case "detection":
        return <Badge variant="outline" className="text-[10px] border-blue-800 text-blue-400">Claude</Badge>;
      case "investigation":
        return <Badge variant="outline" className="text-[10px] border-green-800 text-green-400">Gemini</Badge>;
      case "a2a":
        return <Badge variant="outline" className="text-[10px] border-emerald-800 text-emerald-400">A2A</Badge>;
    }
  };

  return (
    <div className={`border ${getBorderColor()} bg-zinc-900 p-4`}>
      <div className="flex items-center justify-between mb-3">
        <code className="text-sm text-zinc-200 font-mono font-semibold">{name}</code>
        {getAgentBadge()}
      </div>
      <p className="text-sm text-zinc-400 mb-4 leading-relaxed">{description}</p>
      {params && params.length > 0 && (
        <div className="mb-3">
          <div className="text-[10px] uppercase tracking-wider text-zinc-600 mb-1">Parameters</div>
          <div className="flex flex-wrap gap-1">
            {params.map((param, i) => (
              <code key={i} className="text-[11px] px-1.5 py-0.5 bg-zinc-800 text-zinc-400 font-mono">
                {param}
              </code>
            ))}
          </div>
        </div>
      )}
      {returns && returns.length > 0 && (
        <div>
          <div className="text-[10px] uppercase tracking-wider text-zinc-600 mb-1">Returns</div>
          <div className="flex flex-wrap gap-1">
            {returns.map((ret, i) => (
              <code key={i} className="text-[11px] px-1.5 py-0.5 bg-zinc-800/50 text-zinc-500 font-mono">
                {ret}
              </code>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
