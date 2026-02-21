import { type APIRequestContext } from '@playwright/test';
import { authGet, authPost } from '../helpers/api-helpers';

/**
 * Project Fixture — Helpers for getting/creating test projects in E2E tests
 *
 * Projects are stored in the `dd_projects` table. These helpers use the
 * app's API routes so that all business logic (defaults, RLS, events) is
 * exercised the same way a real user would trigger it.
 */

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const TEST_PROJECT_NAME = 'E2E Test Project';
const TEST_TARGET_COMPANY = 'E2E Target Corp SL';

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Get or create a test project and return its ID.
 *
 * 1. Tries to find an existing project whose name starts with the test
 *    project prefix.
 * 2. If none exists, creates a new one via the projects API.
 * 3. Returns the project UUID.
 *
 * This is idempotent: calling it multiple times in the same test run will
 * return the same project.
 *
 * @param request - Playwright APIRequestContext (uses baseURL from config)
 * @param token   - A valid access token (typically from loginAs('pm'))
 */
export async function getOrCreateTestProject(
    request: APIRequestContext,
    token: string,
): Promise<string> {
    // Try to find an existing test project first
    const existingId = await getDemoProjectId(request, token);
    if (existingId) return existingId;

    // No project found — create one via API
    const createResp = await authPost(request, '/api/projects', token, {
        name: `${TEST_PROJECT_NAME} ${Date.now()}`,
        target_company: TEST_TARGET_COMPANY,
        deal_type: 'acquisition',
        review_depth: 'standard',
        status: 'active',
    });

    if (!createResp.ok()) {
        // Fallback: try creating directly via Supabase REST if the /api/projects
        // endpoint does not exist yet (early dev). Throw with details.
        const body = await createResp.text().catch(() => '<no body>');
        throw new Error(
            `getOrCreateTestProject: POST /api/projects failed (${createResp.status()}): ${body}. ` +
            'If the projects API is not yet implemented, use getDemoProjectId() ' +
            'with a manually seeded project instead.',
        );
    }

    const body = await createResp.json();

    // The API may return the project under different keys
    const projectId = body.project?.id || body.id || body.project_id;

    if (!projectId) {
        throw new Error(
            `getOrCreateTestProject: API returned OK but no project ID found in: ${JSON.stringify(body)}`,
        );
    }

    return projectId;
}

/**
 * Get the demo project ID (first active project visible to the authenticated
 * user).
 *
 * Returns `null` if no projects are found. This is useful for tests that
 * require an existing project but should not create one.
 *
 * The function tries multiple strategies:
 * 1. `GET /api/projects` (if a listing endpoint exists)
 * 2. Scrape from the dashboard page response (fallback)
 *
 * @param request - Playwright APIRequestContext
 * @param token   - A valid access token
 */
export async function getDemoProjectId(
    request: APIRequestContext,
    token: string,
): Promise<string | null> {
    // Strategy 1: Try the projects listing API
    try {
        const listResp = await authGet(request, '/api/projects', token);

        if (listResp.ok()) {
            const body = await listResp.json();
            const projects = body.projects || body.data || (Array.isArray(body) ? body : []);

            if (projects.length > 0) {
                // Prefer an active project; fall back to the first one
                const active = projects.find(
                    (p: { status?: string }) => p.status === 'active',
                );
                return (active?.id || projects[0].id) as string;
            }
        }
    } catch {
        // Endpoint may not exist — continue to fallback
    }

    // Strategy 2: Try the system health endpoint which may include project info
    try {
        const healthResp = await authGet(request, '/api/system/health', token);

        if (healthResp.ok()) {
            const body = await healthResp.json();
            if (body.demo_project_id) {
                return body.demo_project_id as string;
            }
        }
    } catch {
        // Continue — no project found
    }

    return null;
}
