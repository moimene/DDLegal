import { test, expect } from '@playwright/test';
import { loginAs, TEST_USERS, authPost } from './helpers/api-helpers';

test.describe('Harvey Gateway API @gateway', () => {
  let token: string;

  test.beforeAll(async ({ request }) => {
    token = await loginAs(request, TEST_USERS.pm);
  });

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
    const res = await authPost(request, '/api/gateway/completion', token, {});
    expect(res.status()).toBe(400);
    const body = await res.json();
    expect(body.success).toBe(false);
  });
});
