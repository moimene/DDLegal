import { test, expect } from '@playwright/test';
import { loginAs, TEST_USERS, authGet, authPost } from './helpers/api-helpers';

test.describe('Workflows MVP API @workflows', () => {
  let token: string;

  test.beforeAll(async ({ request }) => {
    token = await loginAs(request, TEST_USERS.pm);
  });

  test('GET /api/workflows/list returns 6 workflows', async ({ request }) => {
    const res = await authGet(request, '/api/workflows/list', token);
    expect(res.ok()).toBeTruthy();
    const body = await res.json();
    expect(body.workflows.length).toBe(6);
    const keys = body.workflows.map((w: { key: string }) => w.key);
    expect(keys).toContain('arranque_dd');
    expect(keys).toContain('contratos_materiales');
    expect(keys).toContain('laboral_fiscal');
  });

  test('POST /api/workflows/execute requires workflow_key', async ({ request }) => {
    const res = await authPost(request, '/api/workflows/execute', token, { project_id: 'test' });
    expect(res.status()).toBe(400);
  });

  test('contratos_materiales workflow marks hitl_required', async ({ request }) => {
    const res = await authGet(request, '/api/workflows/list', token);
    const body = await res.json();
    const contratos = body.workflows.find((w: { key: string }) => w.key === 'contratos_materiales');
    expect(contratos.hitl_required).toBe(true);
  });

  test('laboral_fiscal workflow marks hitl_required', async ({ request }) => {
    const res = await authGet(request, '/api/workflows/list', token);
    const body = await res.json();
    const labFisc = body.workflows.find((w: { key: string }) => w.key === 'laboral_fiscal');
    expect(labFisc.hitl_required).toBe(true);
  });
});
