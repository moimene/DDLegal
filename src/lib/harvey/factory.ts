import { HarveyGateway } from './gateway';
import type { HarveyGatewayConfig } from './types';

let instance: HarveyGateway | null = null;

export function getHarveyGateway(): HarveyGateway {
  if (!instance) {
    const config: HarveyGatewayConfig = {
      endpoint: process.env.HARVEY_ENDPOINT_V1 || 'https://eu.api.harvey.ai/api/v1/completion',
      token: process.env.HARVEY_TOKEN || '',
      maxRetries: 3,
      baseDelayMs: 1000,
      maxConcurrency: 5,
      timeoutMs: 60000,
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
