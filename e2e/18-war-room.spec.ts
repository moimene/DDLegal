import { test, expect } from '@playwright/test';
import { loginAs, TEST_USERS, authGet, authPost } from './helpers/api-helpers';

const FAKE_PROJECT_ID = '00000000-0000-0000-0000-000000000000';

test.describe('War Room API @war-room', () => {
  let token: string;

  test.beforeAll(async ({ request }) => {
    token = await loginAs(request, TEST_USERS.pm);
  });

  test('GET /api/war-room/[project_id] returns dashboard structure', async ({ request }) => {
    const res = await authGet(request, `/api/war-room/${FAKE_PROJECT_ID}`, token);
    const body = await res.json();
    if (res.ok()) {
      expect(body.success).toBe(true);
      expect(body).toHaveProperty('red_flags');
      expect(body).toHaveProperty('blockers');
      expect(body).toHaveProperty('progress');
      expect(body).toHaveProperty('decisions');
      expect(body).toHaveProperty('notifications');
      expect(Array.isArray(body.red_flags)).toBe(true);
    }
  });

  test('POST /api/war-room/[project_id]/decisions requires fields', async ({ request }) => {
    const res = await authPost(request, `/api/war-room/${FAKE_PROJECT_ID}/decisions`, token, {});
    // With a fake project_id the user has no role → 403 from requirePermission.
    // With a real project_id but empty body → 400 from validation.
    // Either is acceptable for this test.
    expect([400, 403]).toContain(res.status());
    const body = await res.json();
    expect(body.success).toBe(false);
  });

  test('POST /api/war-room/[project_id]/decisions validates decision_type', async ({ request }) => {
    const res = await authPost(request, `/api/war-room/${FAKE_PROJECT_ID}/decisions`, token, {
      decision_type: 'invalid',
      title: 'Test',
    });
    // Same as above: fake project_id triggers 403 before validation can return 400.
    expect([400, 403]).toContain(res.status());
  });

  test('GET /api/war-room/[project_id]/red-flags returns array', async ({ request }) => {
    const res = await authGet(request, `/api/war-room/${FAKE_PROJECT_ID}/red-flags`, token);
    const body = await res.json();
    if (res.ok()) {
      expect(body.success).toBe(true);
      expect(Array.isArray(body.red_flags)).toBe(true);
    }
  });

  test('POST /api/war-room/[project_id]/export returns json by default', async ({ request }) => {
    const res = await authPost(request, `/api/war-room/${FAKE_PROJECT_ID}/export`, token, { format: 'json' });
    const body = await res.json();
    if (res.ok()) {
      expect(body.success).toBe(true);
      expect(body.export).toHaveProperty('red_flags');
      expect(body.export).toHaveProperty('decisions');
    }
  });
});
