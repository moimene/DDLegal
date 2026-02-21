import { test, expect } from '@playwright/test';
import { loginAs, TEST_USERS, authGet } from './helpers/api-helpers';

test.describe('Observability API @observability', () => {
  let token: string;

  test.beforeAll(async ({ request }) => {
    token = await loginAs(request, TEST_USERS.pm.email);
  });

  test('GET /api/observability/slo returns metrics', async ({ request }) => {
    const res = await authGet(request, '/api/observability/slo?hours=24', token);
    expect(res.ok()).toBeTruthy();
    const body = await res.json();
    expect(body.slo).toHaveProperty('p95_ms');
    expect(body.slo).toHaveProperty('rate_429_pct');
    expect(body.slo).toHaveProperty('error_rate_pct');
  });

  test('GET /api/observability/telemetry returns entries', async ({ request }) => {
    const res = await authGet(request, '/api/observability/telemetry?limit=10', token);
    expect(res.ok()).toBeTruthy();
    const body = await res.json();
    expect(body.telemetry).toBeDefined();
    expect(Array.isArray(body.telemetry)).toBe(true);
  });
});
