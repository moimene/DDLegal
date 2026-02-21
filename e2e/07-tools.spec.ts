import { test, expect, type Page } from '@playwright/test';

/**
 * 07 — Herramientas (Tools) E2E Tests
 *
 * Covers:
 *   - Hub Herramientas page (/tools) — tool cards grid
 *   - Societario page (/tools/societario) — basic form load
 *   - IP Radar page (/tools/ip-radar) — form visible
 *   - Radar Marcas page (/tools/marcas) — form visible
 *   - Skills catalog page (/skills) — grid/table visible
 *   - Key elements on each tool page (form fields, submit, results area)
 *
 * Note: Detailed Societario API/UI tests exist in societario-api.spec.ts
 * and societario-page.spec.ts. This suite only verifies basic page loads.
 *
 * Auth: logs in via API to obtain a token, then seeds localStorage
 * before each test to skip the login UI flow.
 */

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const TEST_EMAIL = 'pm@test.ddlegal.com';
const TEST_PASSWORD = 'test123456';
const TOKEN_KEY = 'dd_session_token';

/** Console error substrings to ignore (Next.js dev, Supabase, Postgres, etc.) */
const IGNORED_CONSOLE_PATTERNS = [
    'Supabase',
    'supabase',
    'favicon',
    'hydrat',
    'downloadable font',
    'dd_projects',
    'dd_tools',
    'relation',
    'does not exist',
    'Failed to fetch',
    'Error fetching',
    '42P01',
    'PostgrestError',
    'PGRST',
    'status code 4',
    'ERR_',
    'net::',
    'loading chunk',
    'Load failed',
    'Failed to load resource',
    'fetch',
    'API',
    'mxanelzxyaklvuypuafa',
    'ghmurrvvzochgtippxwu',
    'HMR',
    'Fast Refresh',
    'webpack',
    '_next',
    'ChunkLoadError',
    'Aborted',
    'NotFoundError',
    'ResizeObserver',
];

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Navigate with retry — handles Next.js dev-server cold-start 404 race. */
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

/** Returns true if the console message should be treated as a real error. */
function isRealConsoleError(text: string): boolean {
    return !IGNORED_CONSOLE_PATTERNS.some((p) => text.includes(p));
}

/** Log in via the API and return the access token. */
async function getAuthToken(baseURL: string): Promise<string> {
    const res = await fetch(`${baseURL}/api/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: TEST_EMAIL, password: TEST_PASSWORD }),
    });
    if (!res.ok) {
        throw new Error(`Auth login failed with status ${res.status}`);
    }
    const data = await res.json();
    if (!data.session?.access_token) {
        throw new Error('Auth login response missing access_token');
    }
    return data.session.access_token as string;
}

/** Seed the browser's localStorage with the auth token. */
async function seedAuth(page: Page, baseURL: string) {
    const token = await getAuthToken(baseURL);
    await page.goto('/login', { waitUntil: 'domcontentloaded', timeout: 15_000 });
    await page.evaluate(
        ({ key, value }) => localStorage.setItem(key, value),
        { key: TOKEN_KEY, value: token },
    );
}

// ============================================================================
// 7.1 — Hub Herramientas loads
// ============================================================================

test.describe('7.1 Hub Herramientas loads', () => {
    test('/tools renders heading and tool cards grid', async ({ page, baseURL }) => {
        await seedAuth(page, baseURL!);

        const errors: string[] = [];
        page.on('console', (msg) => {
            if (msg.type() === 'error') errors.push(msg.text());
        });

        await gotoWithRetry(page, '/tools');
        await page.waitForLoadState('networkidle', { timeout: 15_000 }).catch(() => {});

        // Heading: "Herramientas Legal"
        const heading = page.locator('h1');
        await expect(heading, 'Hub page should have a heading').toBeVisible({ timeout: 10_000 });
        const headingText = await heading.textContent();
        expect(headingText, 'Heading should mention "Herramientas"').toContain('Herramientas');

        // Tool cards grid (grid-cols-1 md:grid-cols-2)
        const grid = page.locator('.grid.grid-cols-1');
        await expect(grid.first(), 'Tool cards grid should be visible').toBeVisible({ timeout: 10_000 });

        // At least one tool card with an h3 name
        const toolNames = grid.first().locator('h3');
        const cardCount = await toolNames.count();
        expect(cardCount, 'Grid should have at least 1 tool card').toBeGreaterThanOrEqual(1);

        // No real console errors
        const realErrors = errors.filter(isRealConsoleError);
        if (realErrors.length > 0) {
            console.log('Unfiltered console errors on /tools:', realErrors);
        }
        expect(realErrors.length, 'Hub page should load without critical console errors').toBe(0);
    });
});

// ============================================================================
// 7.2 — Societario page loads
// ============================================================================

test.describe('7.2 Societario page loads', () => {
    test('/tools/societario renders form with target input', async ({ page, baseURL }) => {
        await seedAuth(page, baseURL!);
        await gotoWithRetry(page, '/tools/societario');

        // Heading should mention "Societari"
        const heading = page.locator('h1, h2').first();
        await expect(heading, 'Societario page should have a heading').toBeVisible({ timeout: 10_000 });
        const text = await heading.textContent();
        expect(text?.toLowerCase(), 'Heading should mention societari').toContain('societari');

        // The sociedad target input must be present
        const targetInput = page.locator('#soc-target');
        await expect(targetInput, 'Sociedad target input should be visible').toBeVisible({ timeout: 10_000 });

        // Submit button should be present
        const submitBtn = page.locator('button:has-text("Ejecutar")').first();
        await expect(submitBtn, 'Ejecutar button should be visible').toBeVisible({ timeout: 10_000 });
    });
});

// ============================================================================
// 7.3 — IP Radar page loads
// ============================================================================

test.describe('7.3 IP Radar page loads', () => {
    test('/tools/ip-radar renders form with titular input', async ({ page, baseURL }) => {
        await seedAuth(page, baseURL!);
        await gotoWithRetry(page, '/tools/ip-radar');

        // Heading: "Radar de Propiedad Industrial"
        const heading = page.locator('h1');
        await expect(heading, 'IP Radar page should have a heading').toBeVisible({ timeout: 10_000 });
        const headingText = await heading.textContent();
        expect(
            headingText?.toLowerCase(),
            'Heading should mention "radar" or "propiedad"',
        ).toMatch(/radar|propiedad/);

        // Titular input
        const titularInput = page.locator('#ip-titular');
        await expect(titularInput, 'Titular input should be visible').toBeVisible({ timeout: 10_000 });

        // Form heading "Nueva Investigacion IP"
        const formHeading = page.locator('h2:has-text("Nueva Investigacion")');
        await expect(formHeading, 'Form heading should be visible').toBeVisible({ timeout: 10_000 });
    });
});

// ============================================================================
// 7.4 — Marcas page loads
// ============================================================================

test.describe('7.4 Marcas page loads', () => {
    test('/tools/marcas renders form with target input and execute button', async ({ page, baseURL }) => {
        await seedAuth(page, baseURL!);
        await gotoWithRetry(page, '/tools/marcas');

        // Heading: "Radar de Marcas"
        const heading = page.locator('h1');
        await expect(heading, 'Marcas page should have a heading').toBeVisible({ timeout: 10_000 });
        const headingText = await heading.textContent();
        expect(headingText, 'Heading should mention "Marcas"').toContain('Marcas');

        // Sociedad / Titular input
        const targetInput = page.locator('#marcas-target');
        await expect(targetInput, 'Sociedad/Titular input should be visible').toBeVisible({ timeout: 10_000 });

        // Execute button
        const submitBtn = page.locator('button:has-text("Ejecutar")').first();
        await expect(submitBtn, 'Ejecutar button should be visible').toBeVisible({ timeout: 10_000 });
    });
});

// ============================================================================
// 7.5 — Skills catalog page loads
// ============================================================================

test.describe('7.5 Skills catalog page loads', () => {
    test('/skills renders heading, search input, and skill cards or empty state', async ({ page, baseURL }) => {
        await seedAuth(page, baseURL!);
        await gotoWithRetry(page, '/skills');
        await page.waitForLoadState('networkidle', { timeout: 15_000 }).catch(() => {});

        // Heading: "Catalogo de Skills"
        const heading = page.locator('h1');
        await expect(heading, 'Skills page should have a heading').toBeVisible({ timeout: 10_000 });
        const headingText = await heading.textContent();
        expect(headingText, 'Heading should mention "Skills"').toContain('Skills');

        // Search input
        const searchInput = page.locator('input[placeholder*="Buscar"]');
        await expect(searchInput, 'Search input should be visible').toBeVisible({ timeout: 10_000 });

        // Either skill cards in a grid or the empty state message
        const skillGrid = page.locator('.grid.grid-cols-1').first();
        const emptyState = page.locator('text=No se encontraron skills');
        const hasGrid = await skillGrid.isVisible().catch(() => false);
        const hasEmpty = await emptyState.isVisible().catch(() => false);

        expect(
            hasGrid || hasEmpty,
            'Skills page should show skill cards grid or empty state',
        ).toBe(true);
    });
});

// ============================================================================
// 7.6 — Each tool page has key elements
// ============================================================================

test.describe('7.6 Each tool page has key elements', () => {
    test.describe.configure({ mode: 'parallel' });

    test('Societario: form fields, disabled submit when empty, results area', async ({ page, baseURL }) => {
        await seedAuth(page, baseURL!);
        await gotoWithRetry(page, '/tools/societario');

        // Target input
        const targetInput = page.locator('#soc-target');
        await expect(targetInput, 'soc-target input should be visible').toBeVisible({ timeout: 10_000 });

        // NIF input
        const nifInput = page.locator('#soc-nif');
        await expect(nifInput, 'soc-nif input should be visible').toBeVisible({ timeout: 10_000 });

        // Submit button should be disabled when form is empty
        const submitBtn = page.locator('button:has-text("Ejecutar")').first();
        await expect(submitBtn, 'Ejecutar button should be visible').toBeVisible({ timeout: 10_000 });
        await expect(submitBtn, 'Ejecutar button should be disabled when form is empty').toBeDisabled();

        // Back link to /tools
        const backLink = page.locator('a[href="/tools"]').first();
        await expect(backLink, 'Back link to /tools should be visible').toBeVisible({ timeout: 5_000 });
    });

    test('IP Radar: form fields, submit button, jurisdiction checkboxes', async ({ page, baseURL }) => {
        await seedAuth(page, baseURL!);
        await gotoWithRetry(page, '/tools/ip-radar');

        // Titular input
        const titularInput = page.locator('#ip-titular');
        await expect(titularInput, 'ip-titular input should be visible').toBeVisible({ timeout: 10_000 });

        // NIF input
        const nifInput = page.locator('#ip-nif');
        await expect(nifInput, 'ip-nif input should be visible').toBeVisible({ timeout: 10_000 });

        // Jurisdiction checkboxes (OEPM + EUIPO)
        const oepmCheckbox = page.locator('input[type="checkbox"]').first();
        await expect(oepmCheckbox, 'At least one jurisdiction checkbox should be visible').toBeVisible({ timeout: 10_000 });

        // Submit button: "Ejecutar"
        const submitBtn = page.locator('button:has-text("Ejecutar")');
        await expect(submitBtn, 'Ejecutar button should be visible').toBeVisible({ timeout: 10_000 });

        // Back link to /tools
        const backLink = page.locator('a[href="/tools"]');
        await expect(backLink.first(), 'Back link to /tools should be visible').toBeVisible({ timeout: 5_000 });
    });

    test('Marcas: form fields, empty-state results area, submit disabled when empty', async ({ page, baseURL }) => {
        await seedAuth(page, baseURL!);
        await gotoWithRetry(page, '/tools/marcas');

        // Sociedad / Titular input
        const targetInput = page.locator('#marcas-target');
        await expect(targetInput, 'marcas-target input should be visible').toBeVisible({ timeout: 10_000 });

        // Denominaciones textarea
        const denomTextarea = page.locator('#marcas-denominaciones');
        await expect(denomTextarea, 'Denominaciones textarea should be visible').toBeVisible({ timeout: 10_000 });

        // Clases de Niza input
        const clasesInput = page.locator('#marcas-clases');
        await expect(clasesInput, 'Clases de Niza input should be visible').toBeVisible({ timeout: 10_000 });

        // Submit button disabled when empty
        const submitBtn = page.locator('button:has-text("Ejecutar")').first();
        await expect(submitBtn, 'Ejecutar button should be visible').toBeVisible({ timeout: 10_000 });
        await expect(submitBtn, 'Ejecutar button should be disabled when form is empty').toBeDisabled();

        // Empty state results area
        const emptyState = page.locator('text=Configura los parámetros');
        await expect(emptyState, 'Empty state message should be visible before execution').toBeVisible({ timeout: 10_000 });

        // Back link to /tools
        const backLink = page.locator('a[href="/tools"]').first();
        await expect(backLink, 'Back link to /tools should be visible').toBeVisible({ timeout: 5_000 });
    });

    test('Skills catalog: filter buttons and stats bar are visible', async ({ page, baseURL }) => {
        await seedAuth(page, baseURL!);
        await gotoWithRetry(page, '/skills');
        await page.waitForLoadState('networkidle', { timeout: 15_000 }).catch(() => {});

        // "Todas" category filter button
        const todasBtn = page.locator('button:has-text("Todas")');
        await expect(todasBtn, '"Todas" filter button should be visible').toBeVisible({ timeout: 10_000 });

        // Priority filter buttons (P0, P1, P2)
        for (const p of ['P0', 'P1', 'P2']) {
            const btn = page.locator(`button:has-text("${p}")`);
            await expect(btn, `Priority filter "${p}" should be visible`).toBeVisible({ timeout: 5_000 });
        }

        // Stats bar showing skill count
        const statsBar = page.locator('text=/\\d+ skills?/');
        await expect(statsBar, 'Stats bar with skill count should be visible').toBeVisible({ timeout: 10_000 });
    });
});
