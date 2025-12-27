import type { AgentCard } from '@a2a-js/sdk';
import { config } from '../shared/config.js';

export const fraudDetectionAgentCard: AgentCard = {
  name: 'Fraud Detection Agent',
  description: 'Analyzes healthcare claims for fraud patterns, anomalies, and suspicious provider behavior.',
  url: `http://localhost:${config.detectionAgentPort}/a2a/jsonrpc`,
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
  defaultInputModes: ['text'],
  defaultOutputModes: ['text', 'task-status'],
  skills: [
    {
      id: 'scan-anomalies',
      name: 'Anomaly Detection',
      description: 'Identify statistical outliers in claims data using configurable thresholds for billing amounts, procedure frequency, and temporal patterns.',
      tags: ['fraud', 'anomaly', 'claims', 'statistics'],
      examples: [
        'Find anomalies in recent claims',
        'Scan for unusual billing patterns',
        'Detect statistical outliers',
      ],
      inputModes: ['text'],
      outputModes: ['text', 'task-status'],
    },
    {
      id: 'detect-fraud-rings',
      name: 'Fraud Ring Detection',
      description: 'Identify coordinated fraud networks by analyzing shared beneficiaries across providers and detecting suspicious billing clusters.',
      tags: ['fraud', 'network', 'ring', 'providers'],
      examples: [
        'Detect fraud rings',
        'Find provider networks sharing beneficiaries',
        'Analyze coordinated billing patterns',
      ],
      inputModes: ['text'],
      outputModes: ['text', 'task-status'],
    },
    {
      id: 'check-deceased-claims',
      name: 'Deceased Beneficiary Verification',
      description: 'Flag claims submitted after beneficiary date of death - a key indicator of fraudulent billing.',
      tags: ['fraud', 'deceased', 'beneficiary', 'verification'],
      examples: [
        'Check for deceased claims',
        'Find claims after death',
        'Verify beneficiary status',
      ],
      inputModes: ['text'],
      outputModes: ['text', 'task-status'],
    },
  ],
  supportsAuthenticatedExtendedCard: false,
};
