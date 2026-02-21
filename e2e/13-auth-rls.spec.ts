import { test, expect } from '@playwright/test';
import { loginAs, TEST_USERS, authGet } from './helpers/api-helpers';

test.describe('Auth + RLS enforcement @auth', () => {
  test('unauthenticated request returns 401', async ({ request }) => {
    const res = await request.get('/api/projects');
    expect(res.status()).toBe(401);
  });

  test('invalid token returns 401', async ({ request }) => {
    const res = await request.get('/api/projects', {
      headers: { 'Authorization': 'Bearer invalid-token-123' },
    });
    expect(res.status()).toBe(401);
  });

  test('public routes dont require auth', async ({ request }) => {
    const res = await request.post('/api/auth/login', {
      data: { email: TEST_USERS.pm.email, password: 'test123456' },
    });
    expect(res.status()).not.toBe(401);
  });

  test('authenticated request succeeds', async ({ request }) => {
    const token = await loginAs(request, TEST_USERS.pm.email);
    if (!token) {
      test.skip();
      return;
    }
    const res = await authGet(request, '/api/auth/me', token);
    expect(res.ok()).toBeTruthy();
    const body = await res.json();
    expect(body.success).toBe(true);
  });
});
