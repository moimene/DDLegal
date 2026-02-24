import type {
  HarveyCompletionRequest,
  HarveyCompletionResponse,
  HarveyGatewayConfig,
  GatewayTelemetry,
  GatewayHealth,
  HarveyHistoryRequest,
  HarveyHistoryResponse,
  RequestFamily,
} from './types';

// ────────────────────────────────────────────────────────────
// Per-family concurrency pool (Workstream I)
// ────────────────────────────────────────────────────────────
interface FamilyPool {
  activeRequests: number;
  maxConcurrency: number;
  queue: Array<() => void>;
}

export class HarveyGateway {
  private config: HarveyGatewayConfig;
  private telemetryLog: GatewayTelemetry[] = [];
  private activeRequests = 0;
  private queue: Array<() => void> = [];
  private stats = { total: 0, errors_429: 0, errors_other: 0, latencies: [] as number[] };

  // Per-family concurrency pools (Workstream I)
  private familyPools: Map<RequestFamily, FamilyPool> = new Map();

  // Circuit breaker state
  private circuitState: 'closed' | 'open' | 'half_open' = 'closed';
  private circuitOpenedAt = 0;
  private windowRequests: { timestamp: number; is429: boolean }[] = [];
  private readonly CIRCUIT_WINDOW_MS = 5 * 60 * 1000; // 5 min
  private readonly CIRCUIT_THRESHOLD_PCT = 30;
  private readonly CIRCUIT_MIN_REQUESTS = 10;
  private readonly CIRCUIT_OPEN_DURATION_MS = 60 * 1000; // 60s

  constructor(config: HarveyGatewayConfig) {
    this.config = config;

    // Initialize per-family pools when familyLimits is configured
    if (config.familyLimits) {
      for (const [family, limits] of Object.entries(config.familyLimits)) {
        if (limits) {
          this.familyPools.set(family as RequestFamily, {
            activeRequests: 0,
            maxConcurrency: limits.maxConcurrency,
            queue: [],
          });
        }
      }
    }
  }

  async completion(req: HarveyCompletionRequest, opts?: { family?: RequestFamily }): Promise<HarveyCompletionResponse> {
    const family: RequestFamily = opts?.family ?? 'completion';

    // Circuit breaker check — fail fast if open
    this.checkCircuitBreaker(crypto.randomUUID());

    await this.acquireConcurrencySlot(family);
    const requestId = crypto.randomUUID();
    const startTime = Date.now();
    let lastStatusCode = 0;
    let retries = 0;

    try {
      for (let attempt = 0; attempt <= this.config.maxRetries; attempt++) {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), this.config.timeoutMs);

        try {
          const requestBody: Record<string, unknown> = {
            prompt: req.prompt,
          };
          if (req.system_prompt) requestBody.system_prompt = req.system_prompt;
          if (req.client_matter_id) requestBody.client_matter_id = req.client_matter_id;
          if (req.knowledge_sources) requestBody.knowledge_sources = req.knowledge_sources;

          const response = await fetch(this.config.endpoint, {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${this.config.token}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify(requestBody),
            signal: controller.signal,
          });

          lastStatusCode = response.status;

          if (response.status === 429) {
            this.stats.errors_429++;
            this.recordRequest(true);

            // Half-open probe failed — re-open circuit
            if (this.circuitState === 'half_open') {
              this.circuitState = 'open';
              this.circuitOpenedAt = Date.now();
            }

            if (attempt < this.config.maxRetries) {
              // D.1: Parse Retry-After header, fall back to exponential backoff
              const delay = this.parseRetryAfter(response) ??
                (this.config.baseDelayMs * Math.pow(2, attempt) + Math.random() * 500);
              await new Promise(r => setTimeout(r, delay));
              retries++;
              continue;
            }
            throw new HarveyGatewayError('Rate limited after max retries', 429, requestId);
          }

          // Successful request
          this.recordRequest(false);

          // Half-open probe succeeded — close circuit
          if (this.circuitState === 'half_open') {
            this.circuitState = 'closed';
          }

          if (!response.ok) {
            this.stats.errors_other++;
            throw new HarveyGatewayError(
              `Harvey API error: ${response.status} ${response.statusText}`,
              response.status,
              requestId
            );
          }

          const rawData = await response.json();
          // Harvey API returns {response: "..."} but our interface expects {text: "..."}
          const data: HarveyCompletionResponse = {
            id: rawData.id || requestId,
            text: rawData.response || rawData.text || '',
            model: rawData.model || 'harvey-legal-v1',
            usage: rawData.usage,
          };
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
        family,
      });
      this.releaseConcurrencySlot(family);
    }
  }

  shouldFallbackToN8n(flag: string): boolean {
    return flag === 'n8n';
  }

  getHealth(): GatewayHealth {
    const latencies = this.stats.latencies.slice(-100).sort((a, b) => a - b);
    const p95 = latencies.length > 0 ? latencies[Math.floor(latencies.length * 0.95)] : 0;
    const rate429 = this.stats.total > 0 ? (this.stats.errors_429 / this.stats.total) * 100 : 0;

    // Compute window-level 429 rate for circuit breaker reporting
    const now = Date.now();
    const windowReqs = this.windowRequests.filter(r => now - r.timestamp < this.CIRCUIT_WINDOW_MS);
    const window429 = windowReqs.filter(r => r.is429).length;
    const window429Pct = windowReqs.length > 0 ? (window429 / windowReqs.length) * 100 : 0;

    // Override status to 'down' when circuit is open
    const baseStatus = rate429 > 50 ? 'down' : rate429 > 20 ? 'degraded' : 'healthy';
    const status = this.circuitState === 'open' ? 'down' : baseStatus;

    const health: GatewayHealth = {
      status,
      p95_latency_ms: p95,
      rate_limit_429_pct: Math.round(rate429 * 100) / 100,
      requests_last_hour: this.stats.total,
      active_requests: this.activeRequests,
      feature_flag: (process.env.HARVEY_FEATURE_FLAG as GatewayHealth['feature_flag']) || 'gateway',
      circuit_breaker: {
        state: this.circuitState,
        window_requests: windowReqs.length,
        window_429_pct: Math.round(window429Pct * 100) / 100,
        opened_at: this.circuitOpenedAt > 0 ? new Date(this.circuitOpenedAt).toISOString() : null,
      },
    };

    // Include per-family active request counts when family pools are configured
    if (this.familyPools.size > 0) {
      const familyCounts = {} as Record<RequestFamily, number>;
      this.familyPools.forEach((pool, family) => {
        familyCounts[family] = pool.activeRequests;
      });
      health.family_active_requests = familyCounts;
    }

    return health;
  }

  getTelemetry(): GatewayTelemetry[] {
    return [...this.telemetryLog];
  }

  async queryHistory(req: HarveyHistoryRequest): Promise<HarveyHistoryResponse> {
    const family: RequestFamily = 'history';
    const historyEndpoint = process.env.HARVEY_ENDPOINT_HISTORY;
    if (!historyEndpoint) {
      throw new HarveyGatewayError('HARVEY_ENDPOINT_HISTORY not configured', 503, 'no-history-endpoint');
    }

    await this.acquireConcurrencySlot(family);
    const requestId = crypto.randomUUID();
    const startTime = Date.now();
    let lastStatusCode = 0;

    try {
      const params = new URLSearchParams();
      if (req.start_date) params.append('start_date', req.start_date);
      if (req.end_date) params.append('end_date', req.end_date);
      if (req.limit) params.append('limit', String(req.limit));
      if (req.offset) params.append('offset', String(req.offset));

      const response = await fetch(`${historyEndpoint}?${params.toString()}`, {
        method: 'GET',
        headers: { 'Authorization': `Bearer ${this.config.token}` },
      });

      lastStatusCode = response.status;

      if (!response.ok) {
        throw new HarveyGatewayError(
          `History API error: ${response.status}`,
          response.status,
          requestId
        );
      }

      return await response.json() as HarveyHistoryResponse;
    } finally {
      const duration = Date.now() - startTime;
      this.stats.total++;
      this.stats.latencies.push(duration);
      this.logTelemetry({
        request_id: requestId,
        endpoint: historyEndpoint,
        duration_ms: duration,
        status_code: lastStatusCode,
        retries: 0,
        timestamp: new Date().toISOString(),
        family,
      });
      this.releaseConcurrencySlot(family);
    }
  }

  /**
   * D.1: Parse the Retry-After response header.
   * Returns delay in milliseconds, or null if header is missing/unparseable.
   */
  private parseRetryAfter(response: Response): number | null {
    const header = response.headers.get('Retry-After');
    if (!header) return null;

    // Try integer seconds first (e.g. "30")
    const seconds = Number(header);
    if (Number.isFinite(seconds) && seconds >= 0) {
      return seconds * 1000;
    }

    // Try HTTP-date (e.g. "Wed, 22 Feb 2026 07:28:00 GMT")
    const date = new Date(header);
    if (!isNaN(date.getTime())) {
      const delta = date.getTime() - Date.now();
      return delta > 0 ? delta : 0;
    }

    return null; // Unparseable — caller falls back to exponential backoff
  }

  /**
   * D.2: Check circuit breaker state before allowing a request through.
   * Throws immediately if the circuit is open and cooldown has not elapsed.
   * Transitions open → half_open after CIRCUIT_OPEN_DURATION_MS.
   */
  private checkCircuitBreaker(requestId: string): void {
    if (this.circuitState === 'closed') return;

    if (this.circuitState === 'open') {
      const elapsed = Date.now() - this.circuitOpenedAt;
      if (elapsed >= this.CIRCUIT_OPEN_DURATION_MS) {
        // Cooldown expired — allow one probe request
        this.circuitState = 'half_open';
        return;
      }
      throw new HarveyGatewayError('Circuit breaker open', 503, requestId);
    }

    // half_open — allow the probe request through (already set)
  }

  /**
   * D.2: Record a request outcome in the sliding window and evaluate trip condition.
   */
  private recordRequest(is429: boolean): void {
    const now = Date.now();
    this.windowRequests.push({ timestamp: now, is429 });

    // Prune entries outside the sliding window
    this.windowRequests = this.windowRequests.filter(
      r => now - r.timestamp < this.CIRCUIT_WINDOW_MS
    );

    // Evaluate trip condition only when circuit is closed
    if (this.circuitState === 'closed') {
      if (this.windowRequests.length >= this.CIRCUIT_MIN_REQUESTS) {
        const count429 = this.windowRequests.filter(r => r.is429).length;
        const pct = (count429 / this.windowRequests.length) * 100;
        if (pct > this.CIRCUIT_THRESHOLD_PCT) {
          this.circuitState = 'open';
          this.circuitOpenedAt = Date.now();
        }
      }
    }
  }

  private logTelemetry(entry: GatewayTelemetry): void {
    this.telemetryLog.push(entry);
    if (this.telemetryLog.length > 1000) {
      this.telemetryLog = this.telemetryLog.slice(-500);
    }
  }

  /**
   * Acquire a concurrency slot. When familyLimits is configured and the
   * requested family has a pool, the request is gated by the family-specific
   * limit. Otherwise, it falls back to the global maxConcurrency pool.
   */
  private async acquireConcurrencySlot(family?: RequestFamily): Promise<void> {
    const pool = family ? this.familyPools.get(family) : undefined;

    if (pool) {
      // Family-specific concurrency gate
      if (pool.activeRequests < pool.maxConcurrency) {
        pool.activeRequests++;
        this.activeRequests++; // keep global counter accurate for health reporting
        return;
      }
      return new Promise<void>(resolve => {
        pool.queue.push(() => {
          pool.activeRequests++;
          this.activeRequests++;
          resolve();
        });
      });
    }

    // Global fallback (no family pools configured, or unknown family)
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

  /**
   * Release a concurrency slot back to the appropriate pool.
   */
  private releaseConcurrencySlot(family?: RequestFamily): void {
    const pool = family ? this.familyPools.get(family) : undefined;

    if (pool) {
      pool.activeRequests--;
      this.activeRequests--;
      const next = pool.queue.shift();
      if (next) next();
      return;
    }

    // Global fallback
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
