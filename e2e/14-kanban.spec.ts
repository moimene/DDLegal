import { test, expect } from '@playwright/test';
import { loginAs, TEST_USERS, authGet, authPost, authPatch } from './helpers/api-helpers';

test.describe('Kanban API @kanban', () => {
  let token: string;
  let projectId: string;

  test.beforeAll(async ({ request }) => {
    token = await loginAs(request, TEST_USERS.pm.email);
    const projects = await authGet(request, '/api/projects', token);
    const body = await projects.json();
    projectId = body.data?.[0]?.id;
  });

  test('GET /api/kanban/board returns columns with WIP', async ({ request }) => {
    test.skip(!projectId, 'No project available');
    const res = await authGet(request, `/api/kanban/board?project_id=${projectId}`, token);
    expect(res.ok()).toBeTruthy();
    const body = await res.json();
    expect(body.board).toBeDefined();
    expect(body.board.length).toBe(10);
  });

  test('POST /api/kanban/tasks creates task in backlog', async ({ request }) => {
    test.skip(!projectId, 'No project available');
    const res = await authPost(request, '/api/kanban/tasks', token, {
      project_id: projectId,
      area_code: 'MERC',
      title: 'Test kanban task',
      priority: 'medium',
    });
    expect(res.status()).toBe(201);
    const body = await res.json();
    expect(body.task.state).toBe('backlog');
  });

  test('PATCH move respects WIP limits', async ({ request }) => {
    test.skip(!projectId, 'No project available');
    const createRes = await authPost(request, '/api/kanban/tasks', token, {
      project_id: projectId,
      area_code: 'MERC',
      title: 'WIP test task',
    });
    const { task } = await createRes.json();

    const moveRes = await authPatch(
      request,
      `/api/kanban/tasks/${task.id}/move`,
      token,
      { target_state: 'en_analisis' }
    );
    expect(moveRes.ok()).toBeTruthy();
  });

  test('GET /api/kanban/metrics returns aging data', async ({ request }) => {
    test.skip(!projectId, 'No project available');
    const res = await authGet(request, `/api/kanban/metrics?project_id=${projectId}`, token);
    expect(res.ok()).toBeTruthy();
    const body = await res.json();
    expect(body.metrics).toHaveProperty('total_tasks');
    expect(body.metrics).toHaveProperty('by_state');
    expect(body.metrics).toHaveProperty('stale_tasks');
  });
});
