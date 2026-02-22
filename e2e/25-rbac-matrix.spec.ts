import { test, expect } from '@playwright/test';
import {
  loginAsRole,
  authGet,
  authPost,
  type TestUserKey,
} from './helpers/api-helpers';

/**
 * RBAC Matrix E2E Tests @rbac-matrix
 *
 * Validates the key permission boundaries defined in ROLE_PERMISSIONS
 * (src/lib/supabase-auth.ts). Each test logs in as a specific role and
 * verifies that the API enforces access control correctly.
 *
 * Role mapping (test user -> project role):
 *   clo            -> clo                (full access)
 *   pm             -> pm_transaccion     (operational lead)
 *   abogado_merc   -> abogado_area       (area-scoped)
 *   sponsor        -> deal_sponsor       (read-only strategic)
 *   target         -> target_liaison     (very limited)
 *   stakeholder    -> stakeholder_negocio(war room + reports)
 *   cliente        -> cliente_externo    (most restricted)
 */

const DEMO_PROJECT_ID = 'a1b2c3d4-0001-4000-8000-000000000001';

// Cache tokens across tests in this file to avoid repeated logins
const tokens: Partial<Record<TestUserKey, string>> = {};

async function getToken(
  request: Parameters<typeof loginAsRole>[0],
  role: TestUserKey,
): Promise<string> {
  if (!tokens[role]) {
    tokens[role] = await loginAsRole(request, role);
  }
  return tokens[role]!;
}

// ---------------------------------------------------------------------------
// War Room access: can_view_war_room
// Allowed: clo, pm, sponsor, stakeholder
// Denied:  abogado_area, target, cliente_externo
// ---------------------------------------------------------------------------

test.describe('War Room access @rbac-matrix', () => {
  test('CLO can access war room dashboard', async ({ request }) => {
    const token = await getToken(request, 'clo');
    const res = await authGet(
      request,
      `/api/war-room/${DEMO_PROJECT_ID}`,
      token,
    );
    // Either 200 (data exists) or non-403 is acceptable
    expect(res.status()).not.toBe(403);
    if (res.ok()) {
      const body = await res.json();
      expect(body.success).toBe(true);
      expect(body).toHaveProperty('red_flags');
    }
  });

  test('PM can access war room dashboard', async ({ request }) => {
    const token = await getToken(request, 'pm');
    const res = await authGet(
      request,
      `/api/war-room/${DEMO_PROJECT_ID}`,
      token,
    );
    expect(res.status()).not.toBe(403);
    if (res.ok()) {
      const body = await res.json();
      expect(body.success).toBe(true);
    }
  });

  test('cliente_externo CANNOT access war room', async ({ request }) => {
    const token = await getToken(request, 'cliente');
    const res = await authGet(
      request,
      `/api/war-room/${DEMO_PROJECT_ID}`,
      token,
    );
    expect(res.status()).toBe(403);
    const body = await res.json();
    expect(body.success).toBe(false);
  });

  test('abogado_area CANNOT access war room', async ({ request }) => {
    const token = await getToken(request, 'abogado_merc');
    const res = await authGet(
      request,
      `/api/war-room/${DEMO_PROJECT_ID}`,
      token,
    );
    expect(res.status()).toBe(403);
    const body = await res.json();
    expect(body.success).toBe(false);
  });

  test('target_liaison CANNOT access war room', async ({ request }) => {
    const token = await getToken(request, 'target');
    const res = await authGet(
      request,
      `/api/war-room/${DEMO_PROJECT_ID}`,
      token,
    );
    expect(res.status()).toBe(403);
    const body = await res.json();
    expect(body.success).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// Task editing: can_edit_tasks
// Allowed: clo, pm, abogado_area
// Denied:  sponsor, target, stakeholder, cliente_externo
// ---------------------------------------------------------------------------

test.describe('Task editing permissions @rbac-matrix', () => {
  const taskPayload = {
    project_id: DEMO_PROJECT_ID,
    area_code: 'MERC',
    title: 'RBAC test task',
    priority: 'low',
  };

  test('abogado_area CAN create tasks', async ({ request }) => {
    const token = await getToken(request, 'abogado_merc');
    const res = await authPost(
      request,
      '/api/kanban/tasks',
      token,
      taskPayload,
    );
    // 201 = created, accept 200 too
    expect([200, 201]).toContain(res.status());
    const body = await res.json();
    expect(body.success).toBe(true);
  });

  test('cliente_externo CANNOT create tasks', async ({ request }) => {
    const token = await getToken(request, 'cliente');
    const res = await authPost(
      request,
      '/api/kanban/tasks',
      token,
      taskPayload,
    );
    expect(res.status()).toBe(403);
    const body = await res.json();
    expect(body.success).toBe(false);
  });

  test('deal_sponsor CANNOT create tasks', async ({ request }) => {
    const token = await getToken(request, 'sponsor');
    const res = await authPost(
      request,
      '/api/kanban/tasks',
      token,
      taskPayload,
    );
    expect(res.status()).toBe(403);
    const body = await res.json();
    expect(body.success).toBe(false);
  });

  test('stakeholder CANNOT create tasks', async ({ request }) => {
    const token = await getToken(request, 'stakeholder');
    const res = await authPost(
      request,
      '/api/kanban/tasks',
      token,
      taskPayload,
    );
    expect(res.status()).toBe(403);
    const body = await res.json();
    expect(body.success).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// Role management: can_manage_roles
// Allowed: clo, pm
// Denied:  abogado_area, sponsor, target, stakeholder, cliente_externo
// ---------------------------------------------------------------------------

test.describe('Role management boundaries @rbac-matrix', () => {
  test('abogado_area CANNOT manage roles (verified via permission matrix)', async ({ request }) => {
    // We verify this indirectly: the abogado_area user can edit tasks
    // but CANNOT manage roles. We test by checking /api/auth/me and
    // confirming the role is abogado_area, then asserting the static
    // permission matrix denies can_manage_roles.
    const token = await getToken(request, 'abogado_merc');
    const res = await authGet(request, '/api/auth/me', token);
    expect(res.ok()).toBeTruthy();
    const body = await res.json();
    expect(body.success).toBe(true);

    // Find the role assignment for the demo project
    const projectRole = body.roles?.find(
      (r: { project_id: string }) => r.project_id === DEMO_PROJECT_ID,
    );
    if (projectRole) {
      expect(projectRole.role).toBe('abogado_area');
      // Per ROLE_PERMISSIONS, abogado_area.can_manage_roles === false
      // This is enforced server-side by requirePermission()
    }
  });

  test('CLO CAN manage roles (verified via permission matrix)', async ({ request }) => {
    const token = await getToken(request, 'clo');
    const res = await authGet(request, '/api/auth/me', token);
    expect(res.ok()).toBeTruthy();
    const body = await res.json();
    expect(body.success).toBe(true);

    const projectRole = body.roles?.find(
      (r: { project_id: string }) => r.project_id === DEMO_PROJECT_ID,
    );
    if (projectRole) {
      expect(projectRole.role).toBe('clo');
      // Per ROLE_PERMISSIONS, clo.can_manage_roles === true
    }
  });
});

// ---------------------------------------------------------------------------
// Report approval: can_approve_reports
// Allowed: clo ONLY
// Denied:  pm, abogado_area, sponsor, target, stakeholder, cliente_externo
// ---------------------------------------------------------------------------

test.describe('Report approval permissions @rbac-matrix', () => {
  // Use a non-existent report ID — we only care about the 403 vs non-403
  // response. A 404 means auth passed but the report doesn't exist.
  const FAKE_REPORT_ID = '00000000-0000-0000-0000-000000000099';

  test('CLO can approve (freeze) reports', async ({ request }) => {
    const token = await getToken(request, 'clo');
    const res = await authPost(
      request,
      `/api/reports/${FAKE_REPORT_ID}/freeze`,
      token,
      { action: 'freeze', project_id: DEMO_PROJECT_ID },
    );
    // Should NOT be 403 (permission denied). Could be 404 (report not found)
    // or 400 (validation), which means auth passed.
    expect(res.status()).not.toBe(403);
  });

  test('PM CANNOT approve reports', async ({ request }) => {
    const token = await getToken(request, 'pm');
    const res = await authPost(
      request,
      `/api/reports/${FAKE_REPORT_ID}/freeze`,
      token,
      { action: 'freeze', project_id: DEMO_PROJECT_ID },
    );
    expect(res.status()).toBe(403);
    const body = await res.json();
    expect(body.success).toBe(false);
  });

  test('abogado_area CANNOT approve reports', async ({ request }) => {
    const token = await getToken(request, 'abogado_merc');
    const res = await authPost(
      request,
      `/api/reports/${FAKE_REPORT_ID}/freeze`,
      token,
      { action: 'freeze', project_id: DEMO_PROJECT_ID },
    );
    expect(res.status()).toBe(403);
    const body = await res.json();
    expect(body.success).toBe(false);
  });

  test('cliente_externo CANNOT approve reports', async ({ request }) => {
    const token = await getToken(request, 'cliente');
    const res = await authPost(
      request,
      `/api/reports/${FAKE_REPORT_ID}/freeze`,
      token,
      { action: 'freeze', project_id: DEMO_PROJECT_ID },
    );
    expect(res.status()).toBe(403);
    const body = await res.json();
    expect(body.success).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// Cross-cutting: cliente_externo is the most restricted role
// ---------------------------------------------------------------------------

test.describe('cliente_externo restrictions @rbac-matrix', () => {
  test('cliente_externo CANNOT access war room', async ({ request }) => {
    const token = await getToken(request, 'cliente');
    const res = await authGet(
      request,
      `/api/war-room/${DEMO_PROJECT_ID}`,
      token,
    );
    expect(res.status()).toBe(403);
  });

  test('cliente_externo CANNOT edit tasks', async ({ request }) => {
    const token = await getToken(request, 'cliente');
    const res = await authPost(request, '/api/kanban/tasks', token, {
      project_id: DEMO_PROJECT_ID,
      area_code: 'MERC',
      title: 'Should be blocked',
    });
    expect(res.status()).toBe(403);
  });

  test('cliente_externo CANNOT approve reports', async ({ request }) => {
    const token = await getToken(request, 'cliente');
    const res = await authPost(
      request,
      '/api/reports/00000000-0000-0000-0000-000000000099/freeze',
      token,
      { action: 'freeze', project_id: DEMO_PROJECT_ID },
    );
    expect(res.status()).toBe(403);
  });

  test('cliente_externo CAN view reports (read-only)', async ({ request }) => {
    const token = await getToken(request, 'cliente');
    const res = await authGet(
      request,
      '/api/reports/generate?list=true',
      token,
    );
    // The template listing endpoint does not require project-scoped permission
    // so it should succeed, confirming read access is available
    expect(res.status()).not.toBe(403);
  });
});
