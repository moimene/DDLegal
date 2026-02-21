import { test, expect, type APIRequestContext } from '@playwright/test';

/**
 * 00 — Global E2E Setup
 *
 * Bootstrap suite that runs before all other E2E tests.
 * Verifies system health, seeds test users, validates auth flows,
 * and prepares a demo project with role assignments.
 *
 * Must run serially — later tests depend on state created by earlier ones.
 */

test.describe.configure({ mode: 'serial' });

// ---------------------------------------------------------------------------
// Shared state across tests within this describe block
// ---------------------------------------------------------------------------

const TEST_PASSWORD = 'test123456';

let pmAccessToken: string;
let projectId: string | null = null;

// ---------------------------------------------------------------------------
// Helper: login and return access_token
// ---------------------------------------------------------------------------

async function loginAs(request: APIRequestContext, email: string): Promise<string> {
  const resp = await request.post('/api/auth/login', {
    data: { email, password: TEST_PASSWORD },
  });
  expect(resp.ok(), `Login failed for ${email} — HTTP ${resp.status()}`).toBeTruthy();
  const body = (await resp.json()) as {
    success: boolean;
    session: { access_token: string };
  };
  expect(body.success, `Login response for ${email} missing success=true`).toBe(true);
  expect(body.session?.access_token, `Login response for ${email} missing access_token`).toBeTruthy();
  return body.session.access_token;
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

test.describe('00 — Global E2E Setup', () => {

  // 1. Health -----------------------------------------------------------

  test('system health check @setup', async ({ request }) => {
    const resp = await request.get('/api/system/health');

    expect(resp.status(), 'Health endpoint should return 200').toBe(200);

    const body = (await resp.json()) as {
      success: boolean;
      supabase: { connected: boolean };
    };

    expect(body.success, 'Health check success flag should be true').toBe(true);
    expect(body.supabase?.connected, 'Supabase should be connected').toBe(true);
  });

  // 2. Seed test users --------------------------------------------------

  test('seed test users @setup', async ({ request }) => {
    const resp = await request.post('/api/auth/setup-test-users', {
      data: {},
    });

    expect(resp.ok(), `Seed users failed — HTTP ${resp.status()}`).toBeTruthy();

    const body = (await resp.json()) as {
      success: boolean;
      test_password: string;
      users: { email: string; role: string; status: string; user_id?: string }[];
    };

    expect(body.success, 'setup-test-users should return success=true').toBe(true);
    expect(body.test_password, 'Response should include the test password').toBe(TEST_PASSWORD);
    expect(body.users.length, 'Should return exactly 7 test users').toBe(7);

    // Every user must be either freshly created or already existing — never error
    for (const user of body.users) {
      expect(
        ['created', 'existing'].includes(user.status),
        `User ${user.email} has unexpected status "${user.status}"`,
      ).toBe(true);
    }
  });

  // 3. PM login ---------------------------------------------------------

  test('verify PM login works @setup', async ({ request }) => {
    const resp = await request.post('/api/auth/login', {
      data: { email: 'pm@test.ddlegal.com', password: TEST_PASSWORD },
    });

    expect(resp.ok(), `PM login failed — HTTP ${resp.status()}`).toBeTruthy();

    const body = (await resp.json()) as {
      success: boolean;
      user: { id: string; email: string };
      session: { access_token: string };
    };

    expect(body.success, 'PM login should return success=true').toBe(true);
    expect(body.session?.access_token, 'PM login should return an access_token').toBeTruthy();
    expect(body.user?.email, 'PM login should return user email').toBe('pm@test.ddlegal.com');

    // Store for downstream tests
    pmAccessToken = body.session.access_token;
  });

  // 4. CLO login --------------------------------------------------------

  test('verify CLO login works @setup', async ({ request }) => {
    const resp = await request.post('/api/auth/login', {
      data: { email: 'clo@test.ddlegal.com', password: TEST_PASSWORD },
    });

    expect(resp.ok(), `CLO login failed — HTTP ${resp.status()}`).toBeTruthy();

    const body = (await resp.json()) as {
      success: boolean;
      session: { access_token: string };
    };

    expect(body.success, 'CLO login should return success=true').toBe(true);
    expect(body.session?.access_token, 'CLO login should return an access_token').toBeTruthy();
  });

  // 5. Cliente login ----------------------------------------------------

  test('verify cliente login works @setup', async ({ request }) => {
    const resp = await request.post('/api/auth/login', {
      data: { email: 'cliente@test.ddlegal.com', password: TEST_PASSWORD },
    });

    expect(resp.ok(), `Cliente login failed — HTTP ${resp.status()}`).toBeTruthy();

    const body = (await resp.json()) as {
      success: boolean;
      session: { access_token: string };
    };

    expect(body.success, 'Cliente login should return success=true').toBe(true);
    expect(body.session?.access_token, 'Cliente login should return an access_token').toBeTruthy();
  });

  // 6. auth/me ----------------------------------------------------------

  test('verify auth/me returns user data @setup', async ({ request }) => {
    // Login as PM first (in case the earlier test's token was not stored)
    const token = pmAccessToken ?? await loginAs(request, 'pm@test.ddlegal.com');

    const resp = await request.get('/api/auth/me', {
      headers: { Authorization: `Bearer ${token}` },
    });

    expect(resp.ok(), `auth/me failed — HTTP ${resp.status()}`).toBeTruthy();

    const body = (await resp.json()) as {
      success: boolean;
      user: { id: string; email: string; created_at: string };
      roles: unknown[];
    };

    expect(body.success, 'auth/me should return success=true').toBe(true);
    expect(body.user?.email, 'auth/me should return the PM email').toBe('pm@test.ddlegal.com');
    expect(body.user?.id, 'auth/me should return a user id').toBeTruthy();
  });

  // 7. Demo project discovery -------------------------------------------

  test('get or verify demo project exists @setup', async ({ request }) => {
    const token = pmAccessToken ?? await loginAs(request, 'pm@test.ddlegal.com');

    // Query dd_projects via the health endpoint (which returns table counts)
    // to see if any projects exist. Then fetch from Supabase REST via
    // the project's own API. We use the health endpoint's supabase.url as a
    // signal, but the simplest approach is to look for a project via the
    // roles endpoint with a known project. Instead, we query the system
    // health to get the project count, then list via Supabase PostgREST.
    const healthResp = await request.get('/api/system/health');
    const healthBody = (await healthResp.json()) as {
      supabase: { url: string };
      database: { tables: { table: string; count: number }[] };
    };

    const projectsTable = healthBody.database?.tables?.find(
      (t) => t.table === 'dd_projects',
    );

    if (!projectsTable || projectsTable.count === 0) {
      console.warn(
        '[00-setup] No projects found in dd_projects — downstream project-specific tests will be skipped.',
      );
      projectId = null;
      return;
    }

    // Fetch the first project via Supabase PostgREST
    const supabaseUrl = healthBody.supabase?.url;
    expect(supabaseUrl, 'Supabase URL should be available from health endpoint').toBeTruthy();

    const projectsResp = await request.get(
      `${supabaseUrl}/rest/v1/dd_projects?select=id,name&limit=1&order=created_at.asc`,
      {
        headers: {
          Authorization: `Bearer ${token}`,
          apikey: token,
        },
      },
    );

    if (!projectsResp.ok()) {
      console.warn(
        `[00-setup] Could not list projects via PostgREST — HTTP ${projectsResp.status()}. Skipping project-dependent tests.`,
      );
      projectId = null;
      return;
    }

    const projects = (await projectsResp.json()) as { id: string; name: string }[];

    if (projects.length === 0) {
      console.warn('[00-setup] dd_projects table has rows but PostgREST returned none (RLS?). Skipping.');
      projectId = null;
      return;
    }

    projectId = projects[0].id;
    console.log(`[00-setup] Using demo project: ${projects[0].name} (${projectId})`);

    // Quick sanity check — the roles endpoint should respond for this project
    const rolesResp = await request.get(`/api/projects/${projectId}/roles`);
    expect(rolesResp.ok(), `Roles endpoint for project ${projectId} should return 200`).toBeTruthy();
  });

  // 8. Assign roles to project -----------------------------------------

  test('assign test user roles to project (if project exists) @setup', async ({ request }) => {
    test.skip(!projectId, 'No demo project found — skipping role assignment');

    const resp = await request.post('/api/auth/setup-test-users', {
      data: { project_id: projectId },
    });

    expect(resp.ok(), `Role assignment failed — HTTP ${resp.status()}`).toBeTruthy();

    const body = (await resp.json()) as {
      success: boolean;
      project_id: string;
      users: { email: string; role: string; status: string }[];
    };

    expect(body.success, 'setup-test-users with project_id should succeed').toBe(true);
    expect(body.project_id, 'Response should echo back the project_id').toBe(projectId);

    // Verify roles actually got assigned via the roles endpoint
    const rolesResp = await request.get(`/api/projects/${projectId}/roles`);
    expect(rolesResp.ok(), 'Roles list should succeed after assignment').toBeTruthy();

    const rolesBody = (await rolesResp.json()) as {
      success: boolean;
      roles: { user_id: string; role: string }[];
      count: number;
    };

    expect(rolesBody.success, 'Roles list should return success=true').toBe(true);
    expect(
      rolesBody.count,
      `Project should have at least 7 role assignments, got ${rolesBody.count}`,
    ).toBeGreaterThanOrEqual(7);

    console.log(`[00-setup] ${rolesBody.count} role(s) assigned to project ${projectId}`);
  });
});
