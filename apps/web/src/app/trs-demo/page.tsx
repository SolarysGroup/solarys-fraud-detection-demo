"use client";

import { Chat } from "@/components/chat/Chat";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Database, Users, AlertTriangle, Wrench, ExternalLink, Github, ArrowDown, Bot, Network } from "lucide-react";

export default function TRSDemoPage() {
  const scrollToChat = () => {
    document.getElementById("chat-section")?.scrollIntoView({ behavior: "smooth" });
  };

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100">
      {/* Hero Section */}
      <section className="border-b border-zinc-800">
        <div className="max-w-6xl mx-auto px-6 py-16">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
            {/* Left: Text Content */}
            <div>
              <div className="flex flex-wrap gap-2 mb-4">
                <Badge variant="info">
                  MCP-Compliant
                </Badge>
                <Badge variant="success">
                  A2A Protocol
                </Badge>
                <Badge variant="outline" className="border-zinc-700">
                  Multi-Vendor
                </Badge>
              </div>
              <h1 className="text-4xl font-bold tracking-tight mb-4">
                Solarys Fraud Detection Demo
              </h1>
              <p className="text-xl text-zinc-400 mb-6">
                AI-powered healthcare fraud investigation with Claude and Gemini working together via A2A protocol.
              </p>
              <p className="text-zinc-500 mb-8">
                Watch two AI agents collaborate: Claude (Anthropic) orchestrates 9 MCP tools
                and delegates deep investigations to Gemini (Google) via the A2A protocol.
                See protocol-compliant multi-vendor AI in action.
              </p>
              <div className="flex gap-4">
                <Button variant="primary" onClick={scrollToChat}>
                  Try it yourself
                  <ArrowDown className="ml-2 h-4 w-4" />
                </Button>
                <Button variant="outline">
                  <Github className="mr-2 h-4 w-4" />
                  View Source
                </Button>
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
        <div className="max-w-6xl mx-auto px-6 py-6">
          <div className="grid grid-cols-2 md:grid-cols-5 gap-6">
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
              icon={<AlertTriangle className="h-5 w-5" />}
              value="506"
              label="Flagged"
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

      {/* Interactive Chat Section */}
      <section id="chat-section" className="py-12">
        <div className="max-w-[1600px] mx-auto px-6">
          <div className="mb-8">
            <h2 className="text-2xl font-bold mb-2">Interactive Investigation</h2>
            <p className="text-zinc-400">
              Ask Claude to investigate fraud patterns. Watch the agents coordinate via A2A and execute MCP tools in real-time.
            </p>
          </div>
          <Chat />
        </div>
      </section>

      {/* Protocol Explanation */}
      <section className="border-t border-zinc-800 py-12 bg-zinc-900/30">
        <div className="max-w-6xl mx-auto px-6">
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
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            <ToolCard
              name="find_anomalies"
              description="Detect statistical anomalies in billing patterns"
              agent="detection"
            />
            <ToolCard
              name="detect_fraud_rings"
              description="Find clusters of providers sharing beneficiaries"
              agent="detection"
            />
            <ToolCard
              name="check_deceased_claims"
              description="Find claims submitted after beneficiary death"
              agent="detection"
            />
            <ToolCard
              name="search_providers"
              description="Search for providers by name or specialty"
              agent="detection"
            />
            <ToolCard
              name="get_provider_details"
              description="Get detailed statistics for a specific provider"
              agent="detection"
            />
            <ToolCard
              name="delegate_investigation"
              description="Hand off deep analysis to Investigation Agent"
              agent="a2a"
            />
            <ToolCard
              name="investigate_provider"
              description="Run comprehensive fraud investigation"
              agent="investigation"
            />
            <ToolCard
              name="explain_risk_score"
              description="Explain why a provider has their risk level"
              agent="investigation"
            />
            <ToolCard
              name="search_similar_providers"
              description="Find providers with similar billing patterns"
              agent="investigation"
            />
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-zinc-800 py-8">
        <div className="max-w-6xl mx-auto px-6">
          <div className="flex flex-col md:flex-row justify-between items-center gap-4">
            <div className="text-zinc-500 text-sm">
              Built by{" "}
              <a
                href="https://solarys.dev"
                className="text-zinc-300 hover:text-white"
                target="_blank"
                rel="noopener noreferrer"
              >
                Solarys
              </a>
            </div>
            <div className="flex gap-6 text-sm">
              <a
                href="#"
                className="text-zinc-500 hover:text-zinc-300 flex items-center gap-1"
              >
                Architecture
                <ExternalLink className="h-3 w-3" />
              </a>
              <a
                href="#"
                className="text-zinc-500 hover:text-zinc-300 flex items-center gap-1"
              >
                GitHub
                <ExternalLink className="h-3 w-3" />
              </a>
              <a
                href="#"
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
}: {
  name: string;
  description: string;
  agent: "detection" | "investigation" | "a2a";
}) {
  const getBorderColor = () => {
    switch (agent) {
      case "detection":
        return "border-blue-900/30";
      case "investigation":
        return "border-green-900/30";
      case "a2a":
        return "border-emerald-900/30";
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
      <div className="flex items-center justify-between mb-2">
        <code className="text-sm text-zinc-300 font-mono">{name}</code>
        {getAgentBadge()}
      </div>
      <p className="text-xs text-zinc-500">{description}</p>
    </div>
  );
}
