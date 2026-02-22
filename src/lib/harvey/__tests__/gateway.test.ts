import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { HarveyGateway, HarveyGatewayError } from '../gateway';
import type { HarveyGatewayConfig, HarveyCompletionResponse } from '../types';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeConfig(overrides: Partial<HarveyGatewayConfig> = {}): HarveyGatewayConfig {
  return {
    endpoint: 'https://api.harvey.test/v1/completion',
    token: 'secret-token-abc123',
    maxRetries: 3,
    baseDelayMs: 10,          // fast delays for tests
    maxConcurrency: 4,
    timeoutMs: 5000,
    ...overrides,
  };
}

const MOCK_RESPONSE: HarveyCompletionResponse = {
  id: 'resp-001',
  text: 'Due diligence completed.',
  model: 'harvey-v4',
  usage: { prompt_tokens: 10, completion_tokens: 20, total_tokens: 30 },
};

/** Build a minimal mock Response object */
function jsonResponse(body: unknown, status = 200, statusText = 'OK'): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    statusText,
    json: () => Promise.resolve(body),
    headers: new Headers(),
    redirected: false,
    type: 'basic' as ResponseType,
    url: '',
    clone: () => jsonResponse(body, status, statusText),
    body: null,
    bodyUsed: false,
    arrayBuffer: () => Promise.resolve(new ArrayBuffer(0)),
    blob: () => Promise.resolve(new Blob()),
    formData: () => Promise.resolve(new FormData()),
    text: () => Promise.resolve(JSON.stringify(body)),
    bytes: () => Promise.resolve(new Uint8Array()),
  } as Response;
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('HarveyGateway', () => {
  let fetchSpy: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    fetchSpy = vi.fn();
    vi.stubGlobal('fetch', fetchSpy);
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  // -----------------------------------------------------------------------
  // 1. Constructor
  // -----------------------------------------------------------------------
  it('creates an instance with valid config', () => {
    const gw = new HarveyGateway(makeConfig());
    expect(gw).toBeInstanceOf(HarveyGateway);
    expect(gw.getTelemetry()).toEqual([]);
    expect(gw.getHealth().active_requests).toBe(0);
  });

  // -----------------------------------------------------------------------
  // 2. Completion success
  // -----------------------------------------------------------------------
  it('returns a completion response on success', async () => {
    fetchSpy.mockResolvedValueOnce(jsonResponse(MOCK_RESPONSE));

    const gw = new HarveyGateway(makeConfig());
    const result = await gw.completion({ prompt: 'Analyze contract risks' });

    expect(result).toEqual(MOCK_RESPONSE);
    expect(fetchSpy).toHaveBeenCalledTimes(1);

    // Verify fetch was called with correct endpoint and auth header
    const [url, opts] = fetchSpy.mock.calls[0];
    expect(url).toBe('https://api.harvey.test/v1/completion');
    expect(opts.method).toBe('POST');
    expect(opts.headers.Authorization).toBe('Bearer secret-token-abc123');
  });

  // -----------------------------------------------------------------------
  // 3. 429 retry with exponential backoff
  // -----------------------------------------------------------------------
  it('retries on 429 with exponential backoff and eventually succeeds', async () => {
    fetchSpy
      .mockResolvedValueOnce(jsonResponse({ error: 'rate limited' }, 429, 'Too Many Requests'))
      .mockResolvedValueOnce(jsonResponse({ error: 'rate limited' }, 429, 'Too Many Requests'))
      .mockResolvedValueOnce(jsonResponse(MOCK_RESPONSE));

    const gw = new HarveyGateway(makeConfig({ baseDelayMs: 10, maxRetries: 3 }));
    const result = await gw.completion({ prompt: 'Retry me' });

    expect(result).toEqual(MOCK_RESPONSE);
    // 2 retries + 1 success = 3 calls
    expect(fetchSpy).toHaveBeenCalledTimes(3);

    // Telemetry should reflect 2 retries
    const telemetry = gw.getTelemetry();
    expect(telemetry).toHaveLength(1);
    expect(telemetry[0].retries).toBe(2);
  });

  // -----------------------------------------------------------------------
  // 4. Token not in telemetry
  // -----------------------------------------------------------------------
  it('does not leak the token in telemetry', async () => {
    const config = makeConfig({ token: 'super-secret-harvey-key-xyz' });
    fetchSpy.mockResolvedValueOnce(jsonResponse(MOCK_RESPONSE));

    const gw = new HarveyGateway(config);
    await gw.completion({ prompt: 'Telemetry check' });

    const telemetryStr = JSON.stringify(gw.getTelemetry());
    expect(telemetryStr).not.toContain('super-secret-harvey-key-xyz');
  });

  // -----------------------------------------------------------------------
  // 5. Concurrency limit
  // -----------------------------------------------------------------------
  it('respects maxConcurrency — never exceeds the limit', async () => {
    let peakConcurrent = 0;
    let currentConcurrent = 0;

    fetchSpy.mockImplementation(() => {
      currentConcurrent++;
      if (currentConcurrent > peakConcurrent) peakConcurrent = currentConcurrent;

      return new Promise<Response>((resolve) => {
        setTimeout(() => {
          currentConcurrent--;
          resolve(jsonResponse(MOCK_RESPONSE));
        }, 30);
      });
    });

    const gw = new HarveyGateway(makeConfig({ maxConcurrency: 2 }));

    // Dispatch 4 requests concurrently
    const promises = Array.from({ length: 4 }, (_, i) =>
      gw.completion({ prompt: `Request ${i}` })
    );

    const results = await Promise.all(promises);

    expect(results).toHaveLength(4);
    results.forEach((r) => expect(r).toEqual(MOCK_RESPONSE));
    expect(peakConcurrent).toBeLessThanOrEqual(2);
  });

  // -----------------------------------------------------------------------
  // 6. Feature flag fallback
  // -----------------------------------------------------------------------
  it('shouldFallbackToN8n returns true for "n8n", false for "gateway"', () => {
    const gw = new HarveyGateway(makeConfig());

    expect(gw.shouldFallbackToN8n('n8n')).toBe(true);
    expect(gw.shouldFallbackToN8n('gateway')).toBe(false);
    expect(gw.shouldFallbackToN8n('shadow')).toBe(false);
  });

  // -----------------------------------------------------------------------
  // 7. Health stats
  // -----------------------------------------------------------------------
  it('returns valid health stats after calls', async () => {
    fetchSpy
      .mockResolvedValueOnce(jsonResponse(MOCK_RESPONSE))
      .mockResolvedValueOnce(jsonResponse(MOCK_RESPONSE))
      .mockResolvedValueOnce(jsonResponse(MOCK_RESPONSE));

    const gw = new HarveyGateway(makeConfig());

    await gw.completion({ prompt: 'call 1' });
    await gw.completion({ prompt: 'call 2' });
    await gw.completion({ prompt: 'call 3' });

    const health = gw.getHealth();

    expect(health.status).toBe('healthy');
    expect(health.requests_last_hour).toBe(3);
    expect(health.p95_latency_ms).toBeGreaterThanOrEqual(0);
    expect(typeof health.rate_limit_429_pct).toBe('number');
    expect(health.rate_limit_429_pct).toBe(0);
    expect(health.active_requests).toBe(0);
    expect(['gateway', 'n8n', 'shadow']).toContain(health.feature_flag);
  });

  // -----------------------------------------------------------------------
  // 8. Timeout handling
  // -----------------------------------------------------------------------
  it('throws HarveyGatewayError with 408 on timeout', async () => {
    // Mock a fetch that never resolves — it will be aborted by the AbortSignal
    fetchSpy.mockImplementation((_url: string, opts: RequestInit) => {
      return new Promise<Response>((_resolve, reject) => {
        const onAbort = () => {
          const err = new DOMException('The operation was aborted.', 'AbortError');
          reject(err);
        };
        if (opts.signal) {
          if (opts.signal.aborted) {
            onAbort();
            return;
          }
          opts.signal.addEventListener('abort', onAbort);
        }
      });
    });

    const gw = new HarveyGateway(makeConfig({ timeoutMs: 50, maxRetries: 0 }));

    await expect(gw.completion({ prompt: 'slow request' }))
      .rejects
      .toThrow(HarveyGatewayError);

    try {
      await gw.completion({ prompt: 'slow request 2' });
    } catch (err) {
      expect(err).toBeInstanceOf(HarveyGatewayError);
      expect((err as HarveyGatewayError).statusCode).toBe(408);
      expect((err as HarveyGatewayError).message).toContain('timeout');
    }
  });
});
