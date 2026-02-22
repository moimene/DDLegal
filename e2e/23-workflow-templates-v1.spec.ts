import { test, expect } from '@playwright/test';
import { loginAsRole, authGet } from './helpers/api-helpers';

// =============================================================================
// Workflow Spec v1 — Template System E2E Tests
//
// F.1: Template CRUD (listing)
// F.2: Template detail (HITL policy, skills, category)
// F.3: Unauthenticated access denied
// F.4: Legacy workflow list still works
// F.5: Gateway health includes circuit breaker
// =============================================================================

// ---------------------------------------------------------------------------
// F.1: Template CRUD — listing published templates
// ---------------------------------------------------------------------------

test.describe('F.1 Template Catalog @workflows-v1', () => {
  let token: string;

  test.beforeAll(async ({ request }) => {
    token = await loginAsRole(request, 'pm');
  });

  test('GET /api/workflows/templates returns published templates', async ({ request }) => {
    const res = await authGet(request, '/api/workflows/templates', token);
    expect(res.ok()).toBeTruthy();
    const body = await res.json();
    expect(body.success).toBe(true);
    expect(body.templates.length).toBeGreaterThanOrEqual(10); // 10 published (6 MVP v2 + 4 synthesis)
    // Each template has expected fields
    const first = body.templates[0];
    expect(first).toHaveProperty('template_key');
    expect(first).toHaveProperty('latest_version');
    expect(first.latest_version).toHaveProperty('phases');
  });

  test('templates include expanded 6-phase workflows', async ({ request }) => {
    const res = await authGet(request, '/api/workflows/templates', token);
    const body = await res.json();
    const merc = body.templates.find(
      (t: { template_key: string }) => t.template_key === 'wf_03_merc_societario',
    );
    expect(merc).toBeDefined();
    expect(merc.category).toBe('area');
    expect(merc.area_codes).toContain('MERC');
    // v2 has 6 phases
    const phaseNames = merc.latest_version.phases.map(
      (p: { phase: string }) => p.phase,
    );
    expect(phaseNames).toContain('informe');
    expect(phaseNames).toContain('propuesta_transaccional');
  });

  test('synthesis workflows exist (WF-13, WF-14)', async ({ request }) => {
    const res = await authGet(request, '/api/workflows/templates', token);
    const body = await res.json();
    const keys = body.templates.map(
      (t: { template_key: string }) => t.template_key,
    );
    expect(keys).toContain('wf_13_cross_contingencies_register');
    expect(keys).toContain('wf_14_red_flag_report');
  });

  test('planned workflows are NOT in published templates', async ({ request }) => {
    // Planned workflows (WF-07 through WF-12) have is_published=false
    const res = await authGet(request, '/api/workflows/templates', token);
    const body = await res.json();
    const keys = body.templates.map(
      (t: { template_key: string }) => t.template_key,
    );
    expect(keys).not.toContain('wf_07_inm_real_estate');
    expect(keys).not.toContain('wf_10_environmental');
  });
});

// ---------------------------------------------------------------------------
// F.2: Template detail — HITL policy, skills, category
// ---------------------------------------------------------------------------

test.describe('F.2 Template Detail @workflows-v1', () => {
  let token: string;

  test.beforeAll(async ({ request }) => {
    token = await loginAsRole(request, 'pm');
  });

  test('CONT workflow has HITL required', async ({ request }) => {
    const res = await authGet(request, '/api/workflows/templates', token);
    const body = await res.json();
    const cont = body.templates.find(
      (t: { template_key: string }) => t.template_key === 'wf_04_cont_material_contracts',
    );
    expect(cont).toBeDefined();
    expect(cont.latest_version.hitl_policy.required_areas).toContain('CONT');
  });

  test('LAB/FISC workflow is area_multi category', async ({ request }) => {
    const res = await authGet(request, '/api/workflows/templates', token);
    const body = await res.json();
    const labFisc = body.templates.find(
      (t: { template_key: string }) => t.template_key === 'wf_06_lab_fisc_risk_register',
    );
    expect(labFisc).toBeDefined();
    expect(labFisc.category).toBe('area_multi');
    expect(labFisc.area_codes).toEqual(expect.arrayContaining(['LAB', 'FISC']));
  });
});

// ---------------------------------------------------------------------------
// F.3: Unauthenticated access denied
// ---------------------------------------------------------------------------

test.describe('F.3 Auth Guard @workflows-v1', () => {
  test('templates endpoint requires authentication', async ({ request }) => {
    // No token — middleware should reject with 401
    const res = await request.get('/api/workflows/templates');
    expect(res.status()).toBe(401);
  });
});

// ---------------------------------------------------------------------------
// F.4: Legacy workflow list still works
// ---------------------------------------------------------------------------

test.describe('F.4 Legacy Workflow List @workflows-v1', () => {
  let token: string;

  test.beforeAll(async ({ request }) => {
    token = await loginAsRole(request, 'pm');
  });

  test('legacy GET /api/workflows/list still returns 6 workflows', async ({ request }) => {
    const res = await authGet(request, '/api/workflows/list', token);
    expect(res.ok()).toBeTruthy();
    const body = await res.json();
    expect(body.workflows.length).toBe(6);
  });
});

// ---------------------------------------------------------------------------
// F.5: Gateway health includes circuit breaker
// ---------------------------------------------------------------------------

test.describe('F.5 Gateway Circuit Breaker @workflows-v1', () => {
  test('GET /api/gateway/health includes circuit_breaker state', async ({ request }) => {
    // Gateway health is a public route — no auth required
    const res = await request.get('/api/gateway/health');
    expect(res.ok()).toBeTruthy();
    const body = await res.json();
    expect(body).toHaveProperty('circuit_breaker');
    expect(body.circuit_breaker.state).toBe('closed');
  });
});
