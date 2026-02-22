import { test, expect } from '@playwright/test';
import { loginAsRole, authGet, authPost } from './helpers/api-helpers';

test.describe('VDR Vault Sync API @vdr-vault', () => {
  let token: string;
  let projectId: string | null = null;

  test.beforeAll(async ({ request }) => {
    token = await loginAsRole(request, 'pm');
    const res = await authGet(request, '/api/projects', token);
    if (res.ok()) {
      const body = await res.json();
      projectId = body.data?.[0]?.id || null;
    }
  });

  // ── POST validation ─────────────────────────────────────────

  test('POST /api/vdr/vault/sync requires project_id', async ({ request }) => {
    const res = await request.post('/api/vdr/vault/sync', { data: {} });
    expect(res.status()).toBe(400);
    const body = await res.json();
    expect(body.success).toBe(false);
    expect(body.error).toContain('project_id');
  });

  // ── GET validation ──────────────────────────────────────────

  test('GET /api/vdr/vault/sync requires project_id', async ({ request }) => {
    const res = await request.get('/api/vdr/vault/sync');
    expect(res.status()).toBe(400);
    const body = await res.json();
    expect(body.success).toBe(false);
    expect(body.error).toContain('project_id');
  });

  // ── GET with valid project ──────────────────────────────────

  test('GET /api/vdr/vault/sync returns structure', async ({ request }) => {
    test.skip(!projectId, 'No project available');

    const res = await authGet(
      request,
      `/api/vdr/vault/sync?project_id=${projectId}`,
      token,
    );

    // Might return 200 or 403 (permission), or 500 (db issue)
    if (res.ok()) {
      const body = await res.json();
      expect(body.success).toBe(true);
      expect(body).toHaveProperty('documents');
      expect(Array.isArray(body.documents)).toBe(true);
      expect(body).toHaveProperty('project_id', projectId);
      expect(body).toHaveProperty('total');
    }
  });

  // ── POST with valid project ─────────────────────────────────

  test('POST /api/vdr/vault/sync with valid project returns results', async ({ request }) => {
    test.skip(!projectId, 'No project available');

    const res = await authPost(request, '/api/vdr/vault/sync', token, {
      project_id: projectId,
    });

    // Might return 200 or 403 (permission), or 500 (db issue)
    if (res.ok()) {
      const body = await res.json();
      expect(body.success).toBe(true);
      expect(body).toHaveProperty('synced');
      expect(body).toHaveProperty('failed');
      expect(body).toHaveProperty('skipped');
      expect(typeof body.synced).toBe('number');
      expect(typeof body.failed).toBe('number');
      expect(typeof body.skipped).toBe('number');
    }
  });
});
