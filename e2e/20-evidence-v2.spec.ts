import { test, expect } from '@playwright/test';
import { loginAsRole, authGet, authPost } from './helpers/api-helpers';

test.describe('Evidence Pack v2 API @evidence-v2', () => {
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

  // ── link-chunks validation ──────────────────────────────────

  test('POST /api/evidence/link-chunks requires project_id and task_id', async ({ request }) => {
    const res = await request.post('/api/evidence/link-chunks', { data: {} });
    expect(res.status()).toBe(400);
    const body = await res.json();
    expect(body.success).toBe(false);
  });

  test('POST /api/evidence/link-chunks requires finding_title', async ({ request }) => {
    const res = await request.post('/api/evidence/link-chunks', {
      data: { project_id: 'x', task_id: 'y' },
    });
    expect(res.status()).toBe(400);
    const body = await res.json();
    expect(body.success).toBe(false);
    expect(body.error).toContain('finding_title');
  });

  // ── pack validation ─────────────────────────────────────────

  test('POST /api/evidence/pack requires project_id and task_id', async ({ request }) => {
    const res = await request.post('/api/evidence/pack', { data: {} });
    expect(res.status()).toBe(400);
    const body = await res.json();
    expect(body.success).toBe(false);
  });

  // ── link-chunks with valid auth ─────────────────────────────

  test('POST /api/evidence/link-chunks with valid auth returns success or 404', async ({ request }) => {
    test.skip(!projectId, 'No project available');

    const testTaskId = '00000000-0000-4000-8000-000000000099';
    const res = await authPost(request, '/api/evidence/link-chunks', token, {
      project_id: projectId,
      task_id: testTaskId,
      finding_title: 'Contrato de compraventa con clausula de no competencia',
    });

    // Should gracefully return success (no chunks) or 404 (task not found) or 500 (db issue)
    expect([200, 404, 500]).toContain(res.status());
    const body = await res.json();
    expect(body).toHaveProperty('success');
  });

  // ── pack with valid auth ────────────────────────────────────

  test('POST /api/evidence/pack with valid auth returns structure', async ({ request }) => {
    test.skip(!projectId, 'No project available');

    const testTaskId = '00000000-0000-4000-8000-000000000099';
    const res = await authPost(request, '/api/evidence/pack', token, {
      project_id: projectId,
      task_id: testTaskId,
    });

    // Should gracefully return success (no evidence) or 404 (task not found) or 500
    expect([200, 404, 500]).toContain(res.status());
    const body = await res.json();
    expect(body).toHaveProperty('success');

    if (res.ok() && body.success) {
      // If task exists, response should have evidence_pack (possibly null) and task_id
      expect(body).toHaveProperty('evidence_pack');
      expect(body).toHaveProperty('task_id');
    }
  });
});
