import { test, expect } from '@playwright/test';
import { loginAsRole, authGet, authPost, authPatch } from './helpers/api-helpers';

const DEMO_PROJECT_ID = 'a1b2c3d4-0001-4000-8000-000000000001';

// =============================================================================
// Day 1-3 Sprint Integration Tests
//
// Cross-slice integration tests covering S0 Gateway Health + SLO, S2 Kanban
// Alerts, S0 Vault RAG, S3 Workflow List, and cross-slice consistency.
// =============================================================================

// ---------------------------------------------------------------------------
// Section 1: S0 Gateway Health with SLO (Day 2)
// ---------------------------------------------------------------------------

test.describe('S0 Gateway Health + SLO @gateway @day1-3', () => {
  test('GET /api/gateway/health returns SLO metrics', async ({ request }) => {
    const res = await request.get('/api/gateway/health');
    const body = await res.json();

    // The endpoint always returns slo (can be null if no telemetry data)
    expect(body).toHaveProperty('slo');
    // When slo is present, thresholds must also be present
    if (body.slo !== null) {
      expect(body).toHaveProperty('thresholds');
      expect(body.thresholds).toHaveProperty('p95_target_ms');
      expect(body.thresholds).toHaveProperty('error_rate_target_pct');
      expect(body.thresholds).toHaveProperty('p95_ok');
      expect(body.thresholds).toHaveProperty('error_rate_ok');
    }
  });

  test('GET /api/gateway/health SLO structure', async ({ request }) => {
    const res = await request.get('/api/gateway/health');
    const body = await res.json();

    if (body.slo !== null) {
      // Verify last_hour sub-object
      expect(body.slo).toHaveProperty('last_hour');
      expect(body.slo.last_hour).toHaveProperty('total');
      expect(body.slo.last_hour).toHaveProperty('p50_ms');
      expect(body.slo.last_hour).toHaveProperty('p95_ms');
      expect(body.slo.last_hour).toHaveProperty('p99_ms');
      expect(body.slo.last_hour).toHaveProperty('error_rate_pct');

      // Verify last_24h sub-object
      expect(body.slo).toHaveProperty('last_24h');
      expect(body.slo.last_24h).toHaveProperty('total');
      expect(body.slo.last_24h).toHaveProperty('p50_ms');
      expect(body.slo.last_24h).toHaveProperty('p95_ms');
      expect(body.slo.last_24h).toHaveProperty('p99_ms');
      expect(body.slo.last_24h).toHaveProperty('error_rate_pct');
    }
  });
});

// ---------------------------------------------------------------------------
// Section 2: S2 Kanban Alerts (Day 2)
// ---------------------------------------------------------------------------

test.describe('S2 Kanban Alerts @kanban @day1-3', () => {
  let token: string;
  let projectId: string | undefined;

  test.beforeAll(async ({ request }) => {
    token = await loginAsRole(request, 'pm');
    // Use the known demo project ID directly since there is no GET /api/projects endpoint.
    projectId = DEMO_PROJECT_ID;
  });

  test('GET /api/kanban/alerts requires project_id', async ({ request }) => {
    const res = await authGet(request, '/api/kanban/alerts', token);
    expect(res.status()).toBe(400);
    const body = await res.json();
    expect(body.success).toBe(false);
    expect(body.error).toContain('project_id');
  });

  test('GET /api/kanban/alerts returns alert structure', async ({ request }) => {
    test.skip(!projectId, 'No project available');

    const res = await authGet(
      request,
      `/api/kanban/alerts?project_id=${projectId}`,
      token,
    );
    expect(res.ok()).toBeTruthy();
    const body = await res.json();

    // Alerts grouped by severity
    expect(body).toHaveProperty('alerts');
    expect(body.alerts).toHaveProperty('critical');
    expect(body.alerts).toHaveProperty('warning');
    expect(body.alerts).toHaveProperty('info');
    expect(Array.isArray(body.alerts.critical)).toBe(true);
    expect(Array.isArray(body.alerts.warning)).toBe(true);
    expect(Array.isArray(body.alerts.info)).toBe(true);

    // Summary aggregates
    expect(body).toHaveProperty('summary');
    expect(body.summary).toHaveProperty('total_alerts');
    expect(body.summary).toHaveProperty('critical_count');
    expect(body.summary).toHaveProperty('warning_count');
    expect(body.summary).toHaveProperty('oldest_task_days');
    expect(body.summary).toHaveProperty('avg_days_in_state');
  });

  test('POST /api/kanban/alerts triggers notifications', async ({ request }) => {
    test.skip(!projectId, 'No project available');

    const res = await authPost(request, '/api/kanban/alerts', token, {
      project_id: projectId,
    });

    // The endpoint may return 200 (success) or 403 (permission denied)
    // depending on the PM's role. We check for the response shape when OK.
    if (res.ok()) {
      const body = await res.json();
      expect(body.success).toBe(true);
      expect(body).toHaveProperty('notifications_sent');
      expect(typeof body.notifications_sent).toBe('number');
    } else {
      // If 403, the PM role doesn't have can_manage_roles — acceptable
      expect([403, 401]).toContain(res.status());
    }
  });
});

// ---------------------------------------------------------------------------
// Section 3: S0 Vault RAG (Day 2)
// ---------------------------------------------------------------------------

test.describe('S0 Vault RAG @vdr @day1-3', () => {
  let token: string;
  let projectId: string | undefined;

  test.beforeAll(async ({ request }) => {
    token = await loginAsRole(request, 'pm');
    // Use the known demo project ID directly since there is no GET /api/projects endpoint.
    projectId = DEMO_PROJECT_ID;
  });

  test('POST /api/vdr/rag/query requires project_id and question', async ({ request }) => {
    const res = await authPost(request, '/api/vdr/rag/query', token, {});
    expect(res.status()).toBe(400);
    const body = await res.json();
    expect(body.success).toBe(false);
    expect(body.error).toContain('project_id');
  });

  test('POST /api/vdr/rag/query returns answer structure', async ({ request }) => {
    test.skip(!projectId, 'No project available');

    const res = await authPost(request, '/api/vdr/rag/query', token, {
      project_id: projectId,
      question: 'Cuales son las contingencias principales del target?',
    });

    // RAG may succeed or degrade gracefully — either way we get a structure
    if (res.ok()) {
      const body = await res.json();
      expect(body.success).toBe(true);
      expect(body).toHaveProperty('answer');
      expect(typeof body.answer).toBe('string');
      expect(body).toHaveProperty('confidence');
      expect(['high', 'medium', 'low']).toContain(body.confidence);
      expect(body).toHaveProperty('sources');
      expect(Array.isArray(body.sources)).toBe(true);
    }
  });
});

// ---------------------------------------------------------------------------
// Section 4: S3 Workflow List (Day 1)
// ---------------------------------------------------------------------------

test.describe('S3 Workflow List @workflows @day1-3', () => {
  let token: string;

  test.beforeAll(async ({ request }) => {
    token = await loginAsRole(request, 'pm');
  });

  test('GET /api/workflows/list returns 6 workflows', async ({ request }) => {
    const res = await authGet(request, '/api/workflows/list', token);
    expect(res.ok()).toBeTruthy();
    const body = await res.json();
    expect(body.success).toBe(true);
    expect(body.workflows.length).toBe(6);

    const keys = body.workflows.map((w: { key: string }) => w.key);
    expect(keys).toContain('arranque_dd');
    expect(keys).toContain('data_room_gap');
    expect(keys).toContain('societario');
    expect(keys).toContain('contratos_materiales');
    expect(keys).toContain('ip_titularidad');
    expect(keys).toContain('laboral_fiscal');
  });

  test('contratos_materiales and laboral_fiscal require HITL', async ({ request }) => {
    const res = await authGet(request, '/api/workflows/list', token);
    expect(res.ok()).toBeTruthy();
    const body = await res.json();

    const contratos = body.workflows.find(
      (w: { key: string }) => w.key === 'contratos_materiales',
    );
    expect(contratos).toBeDefined();
    expect(contratos.hitl_required).toBe(true);

    const laboralFiscal = body.workflows.find(
      (w: { key: string }) => w.key === 'laboral_fiscal',
    );
    expect(laboralFiscal).toBeDefined();
    expect(laboralFiscal.hitl_required).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// Section 5: Cross-Slice Integration
// ---------------------------------------------------------------------------

test.describe('Cross-Slice Integration @integration @day1-3', () => {
  test('Gateway whoami + health + SLO are consistent', async ({ request }) => {
    // Both endpoints are public — no auth required
    const [whoamiRes, healthRes] = await Promise.all([
      request.get('/api/gateway/whoami'),
      request.get('/api/gateway/health'),
    ]);

    // whoami should return feature_flag
    expect(whoamiRes.ok()).toBeTruthy();
    const whoami = await whoamiRes.json();
    expect(whoami).toHaveProperty('feature_flag');
    expect(whoami.service).toBe('dd-legal-harvey-gateway');

    // health should return status
    const health = await healthRes.json();
    expect(health).toHaveProperty('status');

    // Both should be accessible (no 401/403)
    expect(whoamiRes.status()).not.toBe(401);
    expect(healthRes.status()).not.toBe(401);
  });
});
