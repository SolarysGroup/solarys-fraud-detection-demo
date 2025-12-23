import type { AgentCard } from '@a2a-js/sdk';
import { config } from '../shared/config.js';

export const investigationAgentCard: AgentCard = {
  name: 'Claims Investigation Agent',
  description: 'Conducts deep-dive investigations into flagged healthcare providers, explains risk assessments, and generates comprehensive investigation reports.',
  url: `http://localhost:${config.investigationAgentPort}/a2a/jsonrpc`,
  provider: {
    organization: 'Solarys',
    url: 'https://solarys.ai',
  },
  version: '1.0.0',
  protocolVersion: '0.3.0',
  capabilities: {
    streaming: true,
    pushNotifications: false,
    stateTransitionHistory: true,
  },
  additionalInterfaces: [
    { url: `http://localhost:${config.investigationAgentPort}/a2a/jsonrpc`, transport: 'JSONRPC' as const },
    { url: `http://localhost:${config.investigationAgentPort}/a2a/rest`, transport: 'HTTP+JSON' as const },
  ],
  defaultInputModes: ['text'],
  defaultOutputModes: ['text', 'task-status'],
  skills: [
    {
      id: 'deep-investigation',
      name: 'Provider Investigation',
      description: 'Conduct comprehensive investigation of a flagged provider, analyzing billing patterns, peer comparisons, and historical trends.',
      tags: ['investigation', 'provider', 'analysis', 'deep-dive'],
      examples: [
        'Investigate provider PRV-1001',
        'Deep dive analysis on flagged provider',
        'Run full investigation on this provider',
      ],
      inputModes: ['text'],
      outputModes: ['text', 'task-status'],
    },
    {
      id: 'risk-explanation',
      name: 'Risk Score Explanation',
      description: 'Provide plain-English explanation of why a provider received their risk score, including contributing factors and evidence.',
      tags: ['risk', 'explanation', 'score', 'factors'],
      examples: [
        'Explain risk score for PRV-1001',
        'Why is this provider high risk?',
        'Break down the risk factors',
      ],
      inputModes: ['text'],
      outputModes: ['text', 'task-status'],
    },
    {
      id: 'pattern-search',
      name: 'Fraud Pattern Search',
      description: 'Search for providers matching specific fraud patterns using semantic similarity and natural language queries.',
      tags: ['search', 'patterns', 'semantic', 'fraud'],
      examples: [
        'Find providers with upcoding patterns',
        'Search for unbundling fraud',
        'Look for ghost patient patterns',
      ],
      inputModes: ['text'],
      outputModes: ['text', 'task-status'],
    },
    {
      id: 'generate-report',
      name: 'Investigation Report',
      description: 'Generate a formal investigation summary report suitable for compliance review and regulatory submission.',
      tags: ['report', 'summary', 'compliance', 'documentation'],
      examples: [
        'Generate investigation report for PRV-1001',
        'Create compliance summary',
        'Produce formal investigation findings',
      ],
      inputModes: ['text'],
      outputModes: ['text', 'task-status'],
    },
  ],
  supportsAuthenticatedExtendedCard: false,
};
