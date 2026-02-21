import { type APIRequestContext, type APIResponse } from '@playwright/test';

/**
 * API Helpers — Wrappers for authenticated API calls in E2E tests
 *
 * All requests are sent to the baseURL configured in playwright.config.ts
 * (http://localhost:3000). Playwright's `request` fixture automatically
 * prepends the baseURL for relative paths.
 */

// ---------------------------------------------------------------------------
// Constants — mirror the values from /api/auth/setup-test-users
// ---------------------------------------------------------------------------

export const TEST_PASSWORD = 'test123456';

export const TEST_USERS = {
    clo: 'clo@test.ddlegal.com',
    pm: 'pm@test.ddlegal.com',
    abogado_merc: 'abogado.merc@test.ddlegal.com',
    sponsor: 'sponsor@test.ddlegal.com',
    target: 'target@test.ddlegal.com',
    stakeholder: 'stakeholder@test.ddlegal.com',
    cliente: 'cliente@test.ddlegal.com',
} as const;

export type TestUserKey = keyof typeof TEST_USERS;

// ---------------------------------------------------------------------------
// Authentication helpers
// ---------------------------------------------------------------------------

/**
 * Login as a test user and return the access token.
 *
 * Calls `POST /api/auth/login` with the given email and the shared test
 * password. Throws with a clear message if the login fails (e.g. if test
 * users have not been seeded yet).
 */
export async function loginAs(
    request: APIRequestContext,
    email: string,
): Promise<string> {
    const resp = await request.post('/api/auth/login', {
        data: { email, password: TEST_PASSWORD },
    });

    if (!resp.ok()) {
        const body = await resp.text().catch(() => '<no body>');
        throw new Error(
            `loginAs(${email}) failed with status ${resp.status()}: ${body}. ` +
            'Have you seeded test users with setupTestUsers()?',
        );
    }

    const body = await resp.json();

    if (!body.success || !body.session?.access_token) {
        throw new Error(
            `loginAs(${email}) returned unexpected body: ${JSON.stringify(body)}`,
        );
    }

    return body.session.access_token;
}

/**
 * Convenience: login as a named test user (e.g. 'pm', 'clo', 'cliente').
 */
export async function loginAsRole(
    request: APIRequestContext,
    role: TestUserKey,
): Promise<string> {
    return loginAs(request, TEST_USERS[role]);
}

// ---------------------------------------------------------------------------
// Authenticated request helpers
// ---------------------------------------------------------------------------

/**
 * Make an authenticated GET request.
 *
 * Attaches `Authorization: Bearer <token>` to the request headers.
 */
export async function authGet(
    request: APIRequestContext,
    url: string,
    token: string,
): Promise<APIResponse> {
    return request.get(url, {
        headers: { Authorization: `Bearer ${token}` },
    });
}

/**
 * Make an authenticated POST request.
 *
 * Attaches `Authorization: Bearer <token>` and sends `body` as JSON.
 */
export async function authPost(
    request: APIRequestContext,
    url: string,
    token: string,
    body: unknown,
): Promise<APIResponse> {
    return request.post(url, {
        headers: { Authorization: `Bearer ${token}` },
        data: body,
    });
}

/**
 * Make an authenticated PATCH request.
 *
 * Attaches `Authorization: Bearer <token>` and sends `body` as JSON.
 */
export async function authPatch(
    request: APIRequestContext,
    url: string,
    token: string,
    body: unknown,
): Promise<APIResponse> {
    return request.patch(url, {
        headers: { Authorization: `Bearer ${token}` },
        data: body,
    });
}

/**
 * Make an authenticated DELETE request.
 *
 * Attaches `Authorization: Bearer <token>`.
 */
export async function authDelete(
    request: APIRequestContext,
    url: string,
    token: string,
): Promise<APIResponse> {
    return request.delete(url, {
        headers: { Authorization: `Bearer ${token}` },
    });
}

// ---------------------------------------------------------------------------
// Setup helpers
// ---------------------------------------------------------------------------

/**
 * Seed test users via `POST /api/auth/setup-test-users`.
 *
 * This endpoint is idempotent: it creates users only if they do not already
 * exist. Optionally pass a `projectId` to also assign project roles.
 *
 * Throws if the endpoint returns an error (e.g. in production mode).
 */
export async function setupTestUsers(
    request: APIRequestContext,
    projectId?: string,
): Promise<void> {
    const resp = await request.post('/api/auth/setup-test-users', {
        data: projectId ? { project_id: projectId } : {},
    });

    if (!resp.ok()) {
        const body = await resp.text().catch(() => '<no body>');
        throw new Error(
            `setupTestUsers() failed with status ${resp.status()}: ${body}`,
        );
    }

    const body = await resp.json();

    if (!body.success) {
        throw new Error(
            `setupTestUsers() returned unsuccessful: ${JSON.stringify(body)}`,
        );
    }
}
