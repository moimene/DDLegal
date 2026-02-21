import { test, expect } from '@playwright/test';

test.describe('Harvey Gateway API @gateway', () => {
  test('GET /api/gateway/whoami returns config', async ({ request }) => {
    const res = await request.get('/api/gateway/whoami');
    expect(res.ok()).toBeTruthy();
    const body = await res.json();
    expect(body.service).toBe('dd-legal-harvey-gateway');
    expect(body.feature_flag).toBeDefined();
  });

  test('GET /api/gateway/health returns metrics', async ({ request }) => {
    const res = await request.get('/api/gateway/health');
    const body = await res.json();
    expect(body.status).toBeDefined();
    expect(body).toHaveProperty('p95_latency_ms');
    expect(body).toHaveProperty('rate_limit_429_pct');
    expect(body).toHaveProperty('feature_flag');
  });

  test('POST /api/gateway/completion requires prompt', async ({ request }) => {
    const res = await request.post('/api/gateway/completion', {
      data: {},
    });
    expect(res.status()).toBe(400);
    const body = await res.json();
    expect(body.success).toBe(false);
  });
});
