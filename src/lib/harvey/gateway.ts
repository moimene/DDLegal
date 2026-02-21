import type {
  HarveyCompletionRequest,
  HarveyCompletionResponse,
  HarveyGatewayConfig,
  GatewayTelemetry,
  GatewayHealth,
} from './types';

export class HarveyGateway {
  private config: HarveyGatewayConfig;
  private telemetryLog: GatewayTelemetry[] = [];
  private activeRequests = 0;
  private queue: Array<() => void> = [];
  private stats = { total: 0, errors_429: 0, errors_other: 0, latencies: [] as number[] };

  constructor(config: HarveyGatewayConfig) {
    this.config = config;
  }

  async completion(req: HarveyCompletionRequest): Promise<HarveyCompletionResponse> {
    await this.acquireConcurrencySlot();
    const requestId = crypto.randomUUID();
    const startTime = Date.now();
    let lastStatusCode = 0;
    let retries = 0;

    try {
      for (let attempt = 0; attempt <= this.config.maxRetries; attempt++) {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), this.config.timeoutMs);

        try {
          const formData = new FormData();
          formData.append('prompt', req.prompt);
          if (req.system_prompt) formData.append('system_prompt', req.system_prompt);
          if (req.client_matter_id) formData.append('client_matter_id', req.client_matter_id);
          if (req.knowledge_sources) {
            formData.append('knowledge_sources', JSON.stringify(req.knowledge_sources));
          }

          const response = await fetch(this.config.endpoint, {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${this.config.token}` },
            body: formData,
            signal: controller.signal,
          });

          lastStatusCode = response.status;

          if (response.status === 429) {
            this.stats.errors_429++;
            if (attempt < this.config.maxRetries) {
              const delay = this.config.baseDelayMs * Math.pow(2, attempt) + Math.random() * 500;
              await new Promise(r => setTimeout(r, delay));
              retries++;
              continue;
            }
            throw new HarveyGatewayError('Rate limited after max retries', 429, requestId);
          }

          if (!response.ok) {
            this.stats.errors_other++;
            throw new HarveyGatewayError(
              `Harvey API error: ${response.status} ${response.statusText}`,
              response.status,
              requestId
            );
          }

          const data = await response.json() as HarveyCompletionResponse;
          return data;
        } catch (err) {
          if (err instanceof HarveyGatewayError) throw err;
          if ((err as Error).name === 'AbortError') {
            throw new HarveyGatewayError('Request timeout', 408, requestId);
          }
          throw err;
        } finally {
          clearTimeout(timeout);
        }
      }
      throw new HarveyGatewayError('Max retries exceeded', lastStatusCode, requestId);
    } finally {
      const duration = Date.now() - startTime;
      this.stats.total++;
      this.stats.latencies.push(duration);
      this.logTelemetry({
        request_id: requestId,
        endpoint: this.config.endpoint,
        duration_ms: duration,
        status_code: lastStatusCode,
        retries,
        client_matter_id: req.client_matter_id,
        timestamp: new Date().toISOString(),
      });
      this.releaseConcurrencySlot();
    }
  }

  shouldFallbackToN8n(flag: string): boolean {
    return flag === 'n8n';
  }

  getHealth(): GatewayHealth {
    const latencies = this.stats.latencies.slice(-100).sort((a, b) => a - b);
    const p95 = latencies.length > 0 ? latencies[Math.floor(latencies.length * 0.95)] : 0;
    const rate429 = this.stats.total > 0 ? (this.stats.errors_429 / this.stats.total) * 100 : 0;

    return {
      status: rate429 > 50 ? 'down' : rate429 > 20 ? 'degraded' : 'healthy',
      p95_latency_ms: p95,
      rate_limit_429_pct: Math.round(rate429 * 100) / 100,
      requests_last_hour: this.stats.total,
      active_requests: this.activeRequests,
      feature_flag: (process.env.HARVEY_FEATURE_FLAG as GatewayHealth['feature_flag']) || 'gateway',
    };
  }

  getTelemetry(): GatewayTelemetry[] {
    return [...this.telemetryLog];
  }

  private logTelemetry(entry: GatewayTelemetry): void {
    this.telemetryLog.push(entry);
    if (this.telemetryLog.length > 1000) {
      this.telemetryLog = this.telemetryLog.slice(-500);
    }
  }

  private async acquireConcurrencySlot(): Promise<void> {
    if (this.activeRequests < this.config.maxConcurrency) {
      this.activeRequests++;
      return;
    }
    return new Promise<void>(resolve => {
      this.queue.push(() => {
        this.activeRequests++;
        resolve();
      });
    });
  }

  private releaseConcurrencySlot(): void {
    this.activeRequests--;
    const next = this.queue.shift();
    if (next) next();
  }
}

export class HarveyGatewayError extends Error {
  constructor(
    message: string,
    public readonly statusCode: number,
    public readonly requestId: string,
  ) {
    super(message);
    this.name = 'HarveyGatewayError';
  }
}
