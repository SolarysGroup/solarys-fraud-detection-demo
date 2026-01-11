import { config as dotenvConfig } from 'dotenv';
import { dirname, resolve } from 'path';
import { fileURLToPath } from 'url';

// Load .env from monorepo root (agents/src/claims-investigation -> agents -> root)
const __dirname = dirname(fileURLToPath(import.meta.url));
const envPath = resolve(__dirname, '../../../.env');
console.log('[ClaimsInvestigationAgent] Loading .env from:', envPath);
const result = dotenvConfig({ path: envPath });
if (result.error) {
  console.error('[ClaimsInvestigationAgent] dotenv error:', result.error.message);
}
console.log('[ClaimsInvestigationAgent] GOOGLE_API_KEY loaded:', !!process.env.GOOGLE_API_KEY);

import express from 'express';
import { AGENT_CARD_PATH } from '@a2a-js/sdk';
import { InMemoryTaskStore, DefaultRequestHandler } from '@a2a-js/sdk/server';
import { agentCardHandler, jsonRpcHandler, restHandler, UserBuilder } from '@a2a-js/sdk/server/express';
import { config } from '../shared/config.js';
import { ClaimsInvestigationAgent } from './agent.js';
import { investigationAgentCard } from './skills.js';

async function main() {
  // 1. Create task store
  const taskStore = new InMemoryTaskStore();

  // 2. Create agent
  const agent = new ClaimsInvestigationAgent();

  // 3. Create request handler
  const requestHandler = new DefaultRequestHandler(
    investigationAgentCard,
    taskStore,
    agent
  );

  // 4. Setup Express with A2A routes
  const app = express();
  app.set("trust proxy", 1);

  // Health check endpoint for Railway
  app.get('/health', (_req, res) => {
    res.json({ status: 'ok', agent: 'claims-investigation' });
  });

  // Agent card discovery endpoint
  app.use(`/${AGENT_CARD_PATH}`, agentCardHandler({ agentCardProvider: requestHandler }));

  // JSON-RPC transport
  app.use('/a2a/jsonrpc', jsonRpcHandler({ requestHandler, userBuilder: UserBuilder.noAuthentication }));

  // REST transport - mount at multiple paths for SDK compatibility
  const restConfig = { requestHandler, userBuilder: UserBuilder.noAuthentication };
  app.use('/a2a/rest', restHandler(restConfig));
  app.use('/message', restHandler(restConfig));  // SDK calls /message/stream
  app.use('/task', restHandler(restConfig));     // SDK calls /task/:id

  // 5. Start server
  // Railway provides PORT env var - use it, otherwise fall back to config
  const port = process.env.PORT ? parseInt(process.env.PORT, 10) : config.investigationAgentPort;
  app.listen(port, '0.0.0.0', () => {
    console.log(`[ClaimsInvestigationAgent] Server started on http://0.0.0.0:${port}`);
    console.log(`[ClaimsInvestigationAgent] Agent Card: http://localhost:${port}/${AGENT_CARD_PATH}`);
    console.log(`[ClaimsInvestigationAgent] JSON-RPC: http://localhost:${port}/a2a/jsonrpc`);
    console.log(`[ClaimsInvestigationAgent] REST: http://localhost:${port}/a2a/rest`);
    console.log(`[ClaimsInvestigationAgent] Using Gemini AI for investigation`);
  });
}

main().catch(console.error);
