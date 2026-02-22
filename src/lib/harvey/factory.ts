import { HarveyGateway } from './gateway';
import type { HarveyGatewayConfig, FamilyLimits } from './types';

let instance: HarveyGateway | null = null;

/**
 * Default per-family concurrency limits (Workstream I).
 * Total: 5 + 3 + 2 = 10 concurrent requests, well under Harvey's 20 rpm cap.
 */
const DEFAULT_FAMILY_LIMITS: FamilyLimits = {
  completion: { maxConcurrency: 5 },
  history:    { maxConcurrency: 3 },
  rag:        { maxConcurrency: 2 },
};

export function getHarveyGateway(): HarveyGateway {
  if (!instance) {
    const config: HarveyGatewayConfig = {
      endpoint: process.env.HARVEY_ENDPOINT_V1 || 'https://eu.api.harvey.ai/api/v1/completion',
      token: process.env.HARVEY_TOKEN || '',
      maxRetries: 3,
      baseDelayMs: 1000,
      maxConcurrency: 10, // global cap (sum of family limits)
      timeoutMs: 60000,
      familyLimits: DEFAULT_FAMILY_LIMITS,
    };
    if (!config.token) {
      throw new Error('HARVEY_TOKEN environment variable is required');
    }
    instance = new HarveyGateway(config);
  }
  return instance;
}

export function resetHarveyGateway(): void {
  instance = null;
}
