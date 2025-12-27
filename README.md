# Solarys Fraud Detection Demo

A demonstration of AI-powered healthcare fraud detection using multi-vendor AI agents that communicate via open protocols. This project showcases how **Claude (Anthropic)** and **Gemini (Google)** work together through the **A2A (Agent-to-Agent)** protocol, while accessing fraud detection tools through **MCP (Model Context Protocol)**.

Engineered by [the Solarys Group](https://solarys.ai) as a proof-of-concept for government healthcare fraud investigation systems.

---

## Table of Contents

- [Overview](#overview)
- [Architecture](#architecture)
- [Protocol Deep Dive](#protocol-deep-dive)
  - [MCP (Model Context Protocol)](#mcp-model-context-protocol)
  - [A2A (Agent-to-Agent Protocol)](#a2a-agent-to-agent-protocol)
- [Key Components](#key-components)
- [Fraud Detection Tools](#fraud-detection-tools)
- [Data](#data)
- [Getting Started](#getting-started)
- [Project Structure](#project-structure)

---

## Overview

Healthcare fraud costs the U.S. government tens of billions of dollars annually. Traditional rule-based detection systems miss sophisticated fraud patterns. This demo shows how multiple AI agents can collaborate to investigate fraud more effectively:

1. **Detection Agent (Claude)** - Orchestrates the investigation, runs initial analysis, and coordinates with other agents
2. **Investigation Agent (Gemini)** - Performs deep-dive investigations when complex analysis is needed

The agents communicate using **open, vendor-neutral protocols**:
- **MCP** for tool access (database queries, anomaly detection, pattern matching)
- **A2A** for agent-to-agent delegation and collaboration

This architecture avoids vendor lock-in and enables best-of-breed AI selection per task.

---

## Architecture

```
┌─────────────────────────────────────────────────────────────────────────┐
│                              Frontend                                    │
│                         (Next.js React App)                             │
│                                                                         │
│   ┌─────────────┐  ┌─────────────┐  ┌──────────────────────────────┐   │
│   │ Provider    │  │ Live        │  │ Investigation Report         │   │
│   │ Table       │  │ Investigation│ │ (Risk Score, Findings)       │   │
│   └─────────────┘  └─────────────┘  └──────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────────────┘
                                    │
                                    │ HTTP (Server-Sent Events)
                                    ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                            API Server                                    │
│                          (Express.js)                                    │
│                                                                         │
│   • Routes chat messages to Detection Agent                             │
│   • Streams real-time events back to frontend                           │
│   • Exposes MCP tools directly for testing                              │
└─────────────────────────────────────────────────────────────────────────┘
                                    │
                                    │ A2A Protocol (JSON-RPC)
                                    ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                     Detection Agent (Claude)                             │
│                        Port 3002                                         │
│                                                                         │
│   • Primary orchestration agent                                          │
│   • Runs up to 10 tool iterations per request                           │
│   • Can delegate to Investigation Agent via A2A                         │
│   • Publishes structured events (tool calls, thinking, delegations)     │
└─────────────────────────────────────────────────────────────────────────┘
           │                                           │
           │ A2A Protocol                              │ MCP Protocol
           ▼                                           ▼
┌─────────────────────────┐              ┌────────────────────────────────┐
│ Investigation Agent     │              │        MCP Server              │
│ (Gemini)                │              │        Port 3004               │
│ Port 3003               │              │                                │
│                         │──MCP──────▶  │  9 Fraud Detection Tools:      │
│ • Deep-dive analysis    │              │  • find_anomalies              │
│ • Risk score explain    │              │  • detect_fraud_rings          │
│ • Pattern investigation │              │  • check_deceased_claims       │
└─────────────────────────┘              │  • investigate_provider        │
                                         │  • get_provider_stats          │
                                         │  • explain_risk_score          │
                                         │  • search_similar_providers    │
                                         │  • search_fraud_patterns       │
                                         │  • get_audit_log               │
                                         └────────────────────────────────┘
                                                        │
                                                        │ Prisma ORM
                                                        ▼
                                         ┌────────────────────────────────┐
                                         │      PostgreSQL Database       │
                                         │                                │
                                         │  • 558,000 healthcare claims   │
                                         │  • 5,410 providers             │
                                         │  • 138,000 beneficiaries       │
                                         │  • Fraud labels and anomalies  │
                                         └────────────────────────────────┘
```

---

## Protocol Deep Dive

### MCP (Model Context Protocol)

**What is MCP?**

MCP is an open protocol developed by Anthropic that standardizes how AI models interact with external tools and data sources. Think of it as a universal adapter that lets any AI model use any tool, regardless of vendor.

**Why MCP matters for government systems:**

1. **Vendor Neutrality** - Tools built with MCP work with any LLM (Claude, GPT, Gemini, Llama, etc.)
2. **Security Boundary** - Clear separation between AI reasoning and tool execution
3. **Auditability** - Every tool call is logged with inputs, outputs, and timing
4. **Standardization** - Common interface reduces integration complexity

**How MCP works in this demo:**

```
AI Agent                    MCP Server                    Database
   │                            │                            │
   │ ──── ListTools ─────────▶  │                            │
   │ ◀─── [9 available tools] ─ │                            │
   │                            │                            │
   │ ──── CallTool ───────────▶ │                            │
   │      "find_anomalies"      │ ──── SQL Query ─────────▶  │
   │      {providerId: "PRV1"}  │ ◀─── Results ───────────── │
   │ ◀─── Tool Result ───────── │                            │
   │      {anomalies: [...]}    │                            │
```

**MCP Implementation (`packages/mcp-server/`):**

- Implements the `@modelcontextprotocol/sdk` server specification
- Supports both stdio (CLI) and HTTP streaming transports
- Routes tool calls to handler functions in `packages/tools/`
- Returns structured JSON responses

### A2A (Agent-to-Agent Protocol)

**What is A2A?**

A2A is an open protocol developed by Google that enables AI agents from different vendors to communicate and delegate tasks to each other. It's like HTTP for AI agents - a standard way for agents to discover, message, and collaborate with each other.

**Why A2A matters for government systems:**

1. **Multi-Vendor Orchestration** - Use the best AI for each task without lock-in
2. **Specialization** - Different agents can have different capabilities and clearances
3. **Scalability** - Add new specialized agents without rewriting existing systems
4. **Interoperability** - Agents from different contractors can work together

**How A2A works in this demo:**

```
API Server                  Detection Agent              Investigation Agent
    │                          (Claude)                       (Gemini)
    │                             │                              │
    │ ── A2A Message ───────────▶ │                              │
    │    "Investigate PRV51234"   │                              │
    │                             │                              │
    │                             │ (runs initial analysis)      │
    │                             │                              │
    │ ◀── Status: "working" ───── │                              │
    │ ◀── Event: tool_call ────── │                              │
    │                             │                              │
    │                             │ ── A2A Delegation ─────────▶ │
    │                             │    "Deep investigation       │
    │                             │     needed for PRV51234"     │
    │                             │                              │
    │ ◀── Event: delegation ───── │                              │
    │                             │ ◀── Investigation Result ─── │
    │                             │                              │
    │ ◀── Final Report ────────── │                              │
```

**A2A Implementation (`agents/src/`):**

Each agent exposes A2A-compliant endpoints:
- `/.well-known/agent.json` - Agent card (capabilities, skills, authentication)
- `/a2a/jsonrpc` - JSON-RPC message transport
- `/a2a/rest` - REST streaming transport for real-time updates

**Agent Cards:**

Both agents publish "agent cards" describing their capabilities:

```json
{
  "name": "Fraud Detection Agent",
  "description": "Orchestrates healthcare fraud investigations",
  "skills": [
    {
      "name": "investigate",
      "description": "Run fraud investigation on a provider"
    }
  ],
  "supportedProtocols": ["a2a/1.0"]
}
```

---

## Key Components

| Component | Location | Purpose |
|-----------|----------|---------|
| **Frontend** | `apps/web/` | Next.js React app with real-time investigation UI |
| **API Server** | `apps/api/` | Express.js server, routes to agents, streams events |
| **Detection Agent** | `agents/src/fraud-detection/` | Claude-powered primary investigation agent |
| **Investigation Agent** | `agents/src/claims-investigation/` | Gemini-powered deep analysis agent |
| **MCP Server** | `packages/mcp-server/` | Protocol-compliant tool server |
| **Tools** | `packages/tools/` | Fraud detection tool implementations |
| **Database** | `packages/db/` | Prisma schema and client |

---

## Fraud Detection Tools

All tools are accessible via MCP and can be called by any agent:

| Tool | Description | Use Case |
|------|-------------|----------|
| `find_anomalies` | Statistical outlier detection | Identify providers with unusual billing patterns |
| `detect_fraud_rings` | Network analysis | Find clusters of providers sharing beneficiaries suspiciously |
| `check_deceased_claims` | Temporal validation | Detect claims submitted after beneficiary death |
| `investigate_provider` | Comprehensive analysis | Full investigation combining multiple checks |
| `get_provider_stats` | Basic metrics | Provider claim counts, amounts, and patterns |
| `explain_risk_score` | Explainability | Break down why a provider has their risk level |
| `search_similar_providers` | Embedding search | Find providers with similar billing patterns |
| `search_fraud_patterns` | Natural language search | Query fraud patterns in plain English |
| `get_audit_log` | Compliance | Retrieve investigation history for audit |

---

## Data

This demo uses the [Healthcare Provider Fraud Detection Dataset](https://www.kaggle.com/datasets/rohitrox/healthcare-provider-fraud-detection-analysis) from Kaggle, containing:

- **558,000+ healthcare claims** with diagnosis codes, procedure codes, and reimbursement amounts
- **5,410 healthcare providers** with fraud labels
- **138,000+ Medicare beneficiaries** with demographics and chronic condition flags

The data is loaded into PostgreSQL and includes computed fields for risk scoring and anomaly detection.

---

## Getting Started

### Prerequisites

- Node.js 20+
- PostgreSQL 15+
- API keys: `ANTHROPIC_API_KEY`, `GOOGLE_API_KEY`, `OPENAI_API_KEY` (for embeddings)

### Installation

```bash
# Clone the repository
git clone https://github.com/BizBeams/solarys-fraud-detection-demo.git
cd solarys-fraud-detection-demo

# Install dependencies
npm install

# Set up environment variables
cp .env.example .env
# Edit .env with your API keys and database URL

# Set up the database
npm run db:push
npm run db:seed

# Start all services
npm run dev
```

### Services

| Service | Port | URL |
|---------|------|-----|
| Frontend | 3000 | http://localhost:3000/trs-demo |
| API Server | 3001 | http://localhost:3001 |
| Detection Agent | 3002 | http://localhost:3002 |
| Investigation Agent | 3003 | http://localhost:3003 |
| MCP Server | 3004 | http://localhost:3004 |

---

## Project Structure

```
solarys-fraud-detection-demo/
├── agents/                         # AI Agent implementations
│   └── src/
│       ├── fraud-detection/        # Claude agent (primary)
│       │   ├── server.ts           # A2A server setup
│       │   ├── claude.ts           # Anthropic SDK integration
│       │   └── skills.ts           # Agent skill definitions
│       └── claims-investigation/   # Gemini agent (specialist)
│           ├── server.ts           # A2A server setup
│           └── gemini.ts           # Google AI SDK integration
│
├── apps/
│   ├── api/                        # Express.js API server
│   │   └── src/
│   │       ├── routes/chat.ts      # Main chat endpoint (SSE)
│   │       └── lib/a2a-client.ts   # A2A SDK client wrapper
│   └── web/                        # Next.js frontend
│       └── src/
│           ├── app/trs-demo/       # Demo page
│           └── components/
│               └── investigation/  # Investigation UI components
│
├── packages/
│   ├── db/                         # Database layer
│   │   └── prisma/
│   │       ├── schema.prisma       # Data model
│   │       └── seed.ts             # Data loading
│   ├── mcp-server/                 # MCP protocol server
│   │   └── src/
│   │       ├── http.ts             # HTTP transport
│   │       └── stdio.ts            # CLI transport
│   ├── tools/                      # Tool implementations
│   │   └── src/handlers/           # Individual tool handlers
│   └── types/                      # Shared TypeScript types
│
└── data/                           # Healthcare claims CSV files
```

---

## License

MIT

---

## Contact

Engineered by [the Solarys Group](https://solarys.ai) - AI automation for healthcare and government.
