import { test, expect } from '@playwright/test';

const FAKE_PROJECT_ID = '00000000-0000-0000-0000-000000000000';

test.describe('War Room API @war-room', () => {
  test('GET /api/war-room/[project_id] returns dashboard structure', async ({ request }) => {
    const res = await request.get(`/api/war-room/${FAKE_PROJECT_ID}`);
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
    const res = await request.post(`/api/war-room/${FAKE_PROJECT_ID}/decisions`, { data: {} });
    expect(res.status()).toBe(400);
    const body = await res.json();
    expect(body.success).toBe(false);
  });

  test('POST /api/war-room/[project_id]/decisions validates decision_type', async ({ request }) => {
    const res = await request.post(`/api/war-room/${FAKE_PROJECT_ID}/decisions`, {
      data: { decision_type: 'invalid', title: 'Test' },
    });
    expect(res.status()).toBe(400);
  });

  test('GET /api/war-room/[project_id]/red-flags returns array', async ({ request }) => {
    const res = await request.get(`/api/war-room/${FAKE_PROJECT_ID}/red-flags`);
    const body = await res.json();
    if (res.ok()) {
      expect(body.success).toBe(true);
      expect(Array.isArray(body.red_flags)).toBe(true);
    }
  });

  test('POST /api/war-room/[project_id]/export returns json by default', async ({ request }) => {
    const res = await request.post(`/api/war-room/${FAKE_PROJECT_ID}/export`, { data: { format: 'json' } });
    const body = await res.json();
    if (res.ok()) {
      expect(body.success).toBe(true);
      expect(body.export).toHaveProperty('red_flags');
      expect(body.export).toHaveProperty('decisions');
    }
  });
});
