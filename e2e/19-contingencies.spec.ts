import { test, expect } from '@playwright/test';
import { loginAsRole, authGet, authPost, authPatch } from './helpers/api-helpers';

const FAKE_ID = '00000000-0000-0000-0000-000000000000';

// ---------------------------------------------------------------------------
// Unauthenticated & validation tests — always runnable
// ---------------------------------------------------------------------------

test.describe('Contingency API — auth & validation @contingencies', () => {
  test('GET /api/contingencies/[id] returns 401 without auth', async ({ request }) => {
    const res = await request.get(`/api/contingencies/${FAKE_ID}`);
    expect(res.status()).toBe(401);
  });

  test('PATCH /api/contingencies/[id] returns 401 without auth', async ({ request }) => {
    const res = await request.patch(`/api/contingencies/${FAKE_ID}`, {
      data: { severity: 'critical' },
    });
    expect(res.status()).toBe(401);
  });

  test('PATCH /api/contingencies/[id] requires at least one field', async ({ request }) => {
    const token = await loginAsRole(request, 'pm');
    const res = await authPatch(request, `/api/contingencies/${FAKE_ID}`, token, {});
    expect(res.status()).toBe(400);
    const body = await res.json();
    expect(body.success).toBe(false);
    expect(body.error).toContain('No updatable fields');
  });

  test('PATCH /api/contingencies/[id] ignores unknown fields and returns 400', async ({ request }) => {
    const token = await loginAsRole(request, 'pm');
    const res = await authPatch(
      request,
      `/api/contingencies/${FAKE_ID}`,
      token,
      { unknown_field: 'value', another_bad: 123 },
    );
    // No valid updatable fields were provided, so we still expect 400
    expect(res.status()).toBe(400);
    const body = await res.json();
    expect(body.success).toBe(false);
  });

  test('PATCH /api/contingencies/[id] returns 404 for non-existent id', async ({ request }) => {
    const token = await loginAsRole(request, 'pm');
    // Send a valid field so it passes the "at least one field" check
    const res = await authPatch(
      request,
      `/api/contingencies/${FAKE_ID}`,
      token,
      { severity: 'high' },
    );
    expect(res.status()).toBe(404);
    const body = await res.json();
    expect(body.success).toBe(false);
    expect(body.error).toContain('not found');
  });

  test('GET /api/contingencies/[id] returns 404 for non-existent id', async ({ request }) => {
    const token = await loginAsRole(request, 'pm');
    const res = await authGet(request, `/api/contingencies/${FAKE_ID}`, token);
    expect(res.status()).toBe(404);
    const body = await res.json();
    expect(body.success).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// Full lifecycle — requires a real project and contingency in the DB
// ---------------------------------------------------------------------------

test.describe.serial('Contingency lifecycle @contingencies', () => {
  let token: string;
  let projectId: string | undefined;
  let contingencyId: string | undefined;

  test('login and discover project', async ({ request }) => {
    token = await loginAsRole(request, 'pm');
    const res = await authGet(request, '/api/projects', token);
    expect(res.ok()).toBeTruthy();
    const body = await res.json();
    projectId = body.data?.[0]?.id;
  });

  test('discover existing contingency from project', async ({ request }) => {
    test.skip(!projectId, 'No project available for testing');

    // Try to find contingencies via direct SQL query or project endpoint
    // Since there may not be a list endpoint, we look for the project's data
    const res = await authGet(
      request,
      `/api/projects/${projectId}`,
      token,
    );
    if (res.ok()) {
      const body = await res.json();
      // Some project responses embed contingencies
      const contingencies = body.contingencies ?? body.data?.contingencies;
      if (Array.isArray(contingencies) && contingencies.length > 0) {
        contingencyId = contingencies[0].id;
      }
    }
    // If no contingency found, subsequent tests will skip gracefully
  });

  test('GET single contingency returns full object', async ({ request }) => {
    test.skip(!contingencyId, 'No contingency available for testing');

    const res = await authGet(request, `/api/contingencies/${contingencyId}`, token);
    expect(res.ok()).toBeTruthy();
    const body = await res.json();
    expect(body.success).toBe(true);
    expect(body.contingency).toBeDefined();

    // Verify all expected fields from dd_contingencies table
    const c = body.contingency;
    expect(c).toHaveProperty('id');
    expect(c).toHaveProperty('project_id');
    expect(c).toHaveProperty('title');
    expect(c).toHaveProperty('severity');
    expect(c).toHaveProperty('probability');
    expect(c).toHaveProperty('status');
    expect(c).toHaveProperty('client_visible');
    expect(c).toHaveProperty('created_at');
  });

  test('PATCH severity change returns changed_fields', async ({ request }) => {
    test.skip(!contingencyId, 'No contingency available for testing');

    // First, read current severity to ensure we change it
    const getRes = await authGet(request, `/api/contingencies/${contingencyId}`, token);
    const getCurrent = await getRes.json();
    const currentSeverity = getCurrent.contingency?.severity;

    // Pick a different severity than the current one
    const newSeverity = currentSeverity === 'critical' ? 'high' : 'critical';

    const res = await authPatch(
      request,
      `/api/contingencies/${contingencyId}`,
      token,
      { severity: newSeverity },
    );
    expect(res.ok()).toBeTruthy();
    const body = await res.json();
    expect(body.success).toBe(true);
    expect(body.contingency).toBeDefined();
    expect(body.changed_fields).toBeDefined();
    expect(Array.isArray(body.changed_fields)).toBe(true);
    expect(body.changed_fields).toContain('severity');
    expect(body.contingency.severity).toBe(newSeverity);
  });

  test('PATCH with same value returns empty changed_fields', async ({ request }) => {
    test.skip(!contingencyId, 'No contingency available for testing');

    // Read the current state
    const getRes = await authGet(request, `/api/contingencies/${contingencyId}`, token);
    const getCurrent = await getRes.json();
    const currentSeverity = getCurrent.contingency?.severity;

    // Patch with the same severity — no actual change
    const res = await authPatch(
      request,
      `/api/contingencies/${contingencyId}`,
      token,
      { severity: currentSeverity },
    );
    expect(res.ok()).toBeTruthy();
    const body = await res.json();
    expect(body.success).toBe(true);
    expect(body.changed_fields).toBeDefined();
    expect(body.changed_fields).not.toContain('severity');
  });
});
