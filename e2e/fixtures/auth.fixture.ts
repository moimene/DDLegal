import { test as base, type Page } from '@playwright/test';
import {
    loginAs,
    TEST_USERS,
    TEST_PASSWORD,
    setupTestUsers,
} from '../helpers/api-helpers';

/**
 * Auth Fixture — Extended Playwright test with pre-authenticated contexts
 *
 * Usage in spec files:
 * ```ts
 * import { test, expect } from '../fixtures/auth.fixture';
 *
 * test('PM can access dashboard', async ({ pmToken, request }) => {
 *     const resp = await request.get('/api/auth/me', {
 *         headers: { Authorization: `Bearer ${pmToken}` },
 *     });
 *     expect(resp.ok()).toBeTruthy();
 * });
 *
 * test('page is pre-authenticated', async ({ authenticatedPage }) => {
 *     await authenticatedPage.goto('/');
 *     // Already logged in as PM
 * });
 * ```
 */

export const test = base.extend<{
    /** Access token for the PM (pm_transaccion) test user */
    pmToken: string;
    /** Access token for the CLO test user */
    cloToken: string;
    /** Access token for the cliente_externo test user */
    clienteToken: string;
    /** A Page with Supabase auth session injected for the PM user */
    authenticatedPage: Page;
}>({
    // -----------------------------------------------------------------------
    // pmToken — login as PM before each test, provide the token
    // -----------------------------------------------------------------------
    pmToken: async ({ request }, use) => {
        // Ensure test users exist (idempotent)
        await setupTestUsers(request).catch(() => {
            // Swallow errors — users may already exist or endpoint may
            // have been called by a global setup. Tests that truly need
            // users will fail with a clear message from loginAs().
        });

        const token = await loginAs(request, TEST_USERS.pm);
        await use(token);
    },

    // -----------------------------------------------------------------------
    // cloToken — login as CLO before each test
    // -----------------------------------------------------------------------
    cloToken: async ({ request }, use) => {
        const token = await loginAs(request, TEST_USERS.clo);
        await use(token);
    },

    // -----------------------------------------------------------------------
    // clienteToken — login as cliente_externo before each test
    // -----------------------------------------------------------------------
    clienteToken: async ({ request }, use) => {
        const token = await loginAs(request, TEST_USERS.cliente);
        await use(token);
    },

    // -----------------------------------------------------------------------
    // authenticatedPage — a browser Page with PM session injected
    //
    // Injects the Supabase auth session into localStorage so that the
    // Next.js app picks it up on page load, bypassing the login UI.
    // -----------------------------------------------------------------------
    authenticatedPage: async ({ browser, request }, use) => {
        // 1. Obtain a valid session via the login API
        const loginResp = await request.post('/api/auth/login', {
            data: { email: TEST_USERS.pm, password: TEST_PASSWORD },
        });

        if (!loginResp.ok()) {
            throw new Error(
                `authenticatedPage: login failed with status ${loginResp.status()}. ` +
                'Ensure test users have been seeded.',
            );
        }

        const loginBody = await loginResp.json();
        const session = loginBody.session;

        if (!session?.access_token) {
            throw new Error(
                'authenticatedPage: login response missing session.access_token',
            );
        }

        // 2. Create a new browser context with the auth token in storage.
        //    The app uses its own UserContext which stores the access token
        //    under the key 'dd_session_token' in localStorage (not Supabase's
        //    built-in session key).
        const context = await browser.newContext({
            storageState: {
                cookies: [],
                origins: [
                    {
                        origin: 'http://localhost:3000',
                        localStorage: [
                            {
                                name: 'dd_session_token',
                                value: session.access_token,
                            },
                        ],
                    },
                ],
            },
        });

        const page = await context.newPage();

        await use(page);

        // Teardown: close the context (and its pages)
        await context.close();
    },
});

export { expect } from '@playwright/test';
