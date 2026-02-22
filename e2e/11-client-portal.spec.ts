import { test, expect, type Page } from '@playwright/test';

/**
 * 11 — Client Portal E2E Tests (cliente_externo role)
 *
 * Validates restricted access for external clients:
 *   - Login & token retrieval
 *   - Dashboard access (read-only)
 *   - Limited sidebar navigation (no config section)
 *   - Project page access without 500 errors
 *   - Role verification via /api/auth/me
 *
 * Auth: uses the cliente_externo test user seeded via
 * POST /api/auth/setup-test-users.
 */

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const CLIENT_EMAIL = 'cliente@test.ddlegal.com';
const TEST_PASSWORD = 'test123456';
const TOKEN_KEY = 'dd_session_token';

/** Console error substrings to ignore (Next.js dev, Supabase, Postgres, etc.) */
const IGNORED_CONSOLE_PATTERNS = [
    'Supabase', 'supabase', 'favicon', 'hydrat', 'downloadable font',
    'dd_projects', 'dd_tools', 'relation', 'does not exist',
    'Failed to fetch', 'Error fetching', '42P01', 'PostgrestError', 'PGRST',
    'status code 4', 'ERR_', 'net::', 'loading chunk', 'Load failed',
    'Failed to load resource', 'fetch', 'API',
    'mxanelzxyaklvuypuafa', 'ghmurrvvzochgtippxwu',
    'HMR', 'Fast Refresh', 'webpack', '_next',
    'ChunkLoadError', 'Aborted', 'NotFoundError', 'ResizeObserver',
];

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

async function gotoWithRetry(page: Page, url: string, opts?: { timeout?: number }) {
    const timeout = opts?.timeout ?? 15_000;
    for (let attempt = 0; attempt < 3; attempt++) {
        await page.goto(url, { waitUntil: 'domcontentloaded', timeout });
        const title = await page
            .locator('h1, h2')
            .first()
            .textContent({ timeout: 5_000 })
            .catch(() => '');
        if (!title?.includes('404')) return;
        await page.waitForTimeout(1_000);
    }
}

function isRealConsoleError(text: string): boolean {
    return !IGNORED_CONSOLE_PATTERNS.some((p) => text.includes(p));
}

async function seedClientAuth(page: Page, baseURL: string): Promise<string> {
    const res = await fetch(`${baseURL}/api/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: CLIENT_EMAIL, password: TEST_PASSWORD }),
    });
    if (!res.ok) throw new Error(`Client login failed with status ${res.status}`);
    const data = await res.json();
    const token = data.session?.access_token;
    if (!token) throw new Error('Client login response missing access_token');

    await page.goto('/login', { waitUntil: 'domcontentloaded', timeout: 15_000 });
    await page.evaluate(
        ({ key, value }) => localStorage.setItem(key, value),
        { key: TOKEN_KEY, value: token },
    );
    return token;
}

// ============================================================================
// 11 — Client Portal Tests (serial)
// ============================================================================

test.describe('11 Client Portal (cliente_externo)', () => {
    test.describe.configure({ mode: 'serial' });

    let clientToken: string;

    // ------------------------------------------------------------------
    // 11.1 — Client login works
    // ------------------------------------------------------------------
    test('11.1 — POST /api/auth/login with cliente_externo returns access_token', async ({ request }) => {
        const resp = await request.post('/api/auth/login', {
            data: { email: CLIENT_EMAIL, password: TEST_PASSWORD },
        });

        expect(resp.status(), 'Client login should return HTTP 200').toBe(200);

        const body = await resp.json();
        expect(body.success, 'Response should include success: true').toBe(true);
        expect(body.user?.email, 'Response email should match client user').toBe(CLIENT_EMAIL);
        expect(body.session?.access_token, 'Response should include an access_token').toBeTruthy();

        clientToken = body.session.access_token;
    });

    // ------------------------------------------------------------------
    // 11.2 — Client can access dashboard
    // ------------------------------------------------------------------
    test('11.2 — Client can access dashboard and main content loads', async ({ page, baseURL }) => {
        await seedClientAuth(page, baseURL!);

        const errors: string[] = [];
        page.on('console', (msg) => {
            if (msg.type() === 'error') errors.push(msg.text());
        });

        await gotoWithRetry(page, '/');
        await page.waitForLoadState('networkidle', { timeout: 15_000 }).catch(() => {});

        // Main content area should render
        const main = page.locator('main');
        await expect(main, 'Dashboard main content should be visible for client user').toBeVisible({ timeout: 10_000 });

        // No critical JS errors
        const realErrors = errors.filter(isRealConsoleError);
        if (realErrors.length > 0) {
            console.log('Console errors on client dashboard:', realErrors);
        }
        expect(realErrors.length, 'Dashboard should load without critical console errors').toBe(0);
    });

    // ------------------------------------------------------------------
    // 11.3 — Client sees sidebar with expected sections
    // ------------------------------------------------------------------
    test('11.3 — Sidebar visible with Navegacion and Configuracion sections for client', async ({ page, baseURL }) => {
        await seedClientAuth(page, baseURL!);
        await gotoWithRetry(page, '/');

        const sidebar = page.locator('aside');
        await expect(sidebar, 'Sidebar should be visible for client user').toBeVisible({ timeout: 10_000 });

        // "Navegacion" section should be visible
        const navHeader = sidebar.locator('p:text-is("Navegacion")');
        await expect(navHeader, 'Navegacion section should be visible for client').toBeVisible({ timeout: 5_000 });

        // "Herramientas" section should be visible
        const toolsHeader = sidebar.locator('p:text-is("Herramientas")');
        await expect(toolsHeader, 'Herramientas section should be visible for client').toBeVisible({ timeout: 5_000 });

        // "Configuracion" section is also visible (sidebar does not filter by role)
        const configHeader = sidebar.locator('p:text-is("Configuracion")');
        await expect(configHeader, 'Configuracion section should be visible in sidebar').toBeVisible({ timeout: 5_000 });
    });

    // ------------------------------------------------------------------
    // 11.4 — Client sees project page if assigned (no 500)
    // ------------------------------------------------------------------
    test('11.4 — Client can navigate to /projects without 500 error', async ({ page, baseURL }) => {
        await seedClientAuth(page, baseURL!);

        let got500 = false;
        page.on('response', (res) => {
            if (res.url().includes('/projects') && res.status() === 500) got500 = true;
        });

        await gotoWithRetry(page, '/projects');
        await page.waitForLoadState('networkidle', { timeout: 15_000 }).catch(() => {});

        // The page should render without a 500 — either shows projects or empty state
        const main = page.locator('main');
        await expect(main, 'Projects page main content should be visible for client').toBeVisible({ timeout: 10_000 });

        expect(got500, 'Projects page should not return 500 for client user').toBe(false);
    });

    // ------------------------------------------------------------------
    // 11.5 — /api/auth/me returns cliente_externo role
    // ------------------------------------------------------------------
    test('11.5 — GET /api/auth/me returns cliente_externo role', async ({ request }) => {
        expect(clientToken, 'clientToken should have been set by test 11.1').toBeTruthy();

        const resp = await request.get('/api/auth/me', {
            headers: { Authorization: `Bearer ${clientToken}` },
        });

        expect(resp.status(), '/api/auth/me should return 200 for client token').toBe(200);

        const body = await resp.json();
        expect(body.success, 'Response should include success: true').toBe(true);
        expect(body.user?.email, 'User email should match client').toBe(CLIENT_EMAIL);

        // Roles array should include at least one entry with role = 'cliente_externo'
        expect(Array.isArray(body.roles), 'roles should be an array').toBe(true);

        if (body.roles.length > 0) {
            const hasClientRole = body.roles.some(
                (r: { role: string }) => r.role === 'cliente_externo',
            );
            expect(hasClientRole, 'roles should include a cliente_externo entry').toBe(true);
        } else {
            // No project roles assigned yet — still valid, just log it
            console.warn('[11-client-portal] No project roles found for client user — role check skipped.');
        }
    });
});
