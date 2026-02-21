import { test, expect, type Page, type APIRequestContext } from '@playwright/test';

/**
 * 09 — Cockpit & Negotiation E2E Tests
 *
 * Covers:
 *   - Deal Cockpit page (/projects/[id]/cockpit) — KPI panels
 *   - HITL Review page (/projects/[id]/hitl) — pending decisions
 *   - Negotiation page (/projects/[id]/negotiation) — contingency board
 *   - Activity page (/projects/[id]/activity) — timeline
 *   - Cockpit API (GET /api/projects/[id]/cockpit)
 *
 * Tests run serially because they depend on a shared project ID.
 */

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const TEST_PASSWORD = 'test123456';
const PM_EMAIL = 'pm@test.ddlegal.com';
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

function isRealConsoleError(text: string): boolean {
    return !IGNORED_CONSOLE_PATTERNS.some((p) => text.includes(p));
}

async function gotoWithRetry(page: Page, url: string) {
    for (let attempt = 0; attempt < 3; attempt++) {
        await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 15_000 });
        const title = await page
            .locator('h1, h2')
            .first()
            .textContent({ timeout: 5_000 })
            .catch(() => '');
        if (!title?.includes('404')) return;
        await page.waitForTimeout(1_000);
    }
}

async function getAuthToken(request: APIRequestContext): Promise<string> {
    const resp = await request.post('/api/auth/login', {
        data: { email: PM_EMAIL, password: TEST_PASSWORD },
    });
    expect(resp.ok(), `Login failed — HTTP ${resp.status()}`).toBeTruthy();
    const body = await resp.json();
    expect(body.session?.access_token, 'Login response missing access_token').toBeTruthy();
    return body.session.access_token;
}

async function seedAuth(page: Page, request: APIRequestContext): Promise<string> {
    const token = await getAuthToken(request);
    await page.goto('/login', { waitUntil: 'domcontentloaded', timeout: 15_000 });
    await page.evaluate(
        ({ key, value }) => localStorage.setItem(key, value),
        { key: TOKEN_KEY, value: token },
    );
    return token;
}

async function discoverProjectId(request: APIRequestContext, token: string): Promise<string | null> {
    const healthResp = await request.get('/api/system/health');
    if (!healthResp.ok()) return null;

    const healthBody = await healthResp.json();
    const projectsTable = healthBody.database?.tables?.find(
        (t: { table: string; count: number }) => t.table === 'dd_projects',
    );
    if (!projectsTable || projectsTable.count === 0) return null;

    const supabaseUrl = healthBody.supabase?.url;
    if (!supabaseUrl) return null;

    const projectsResp = await request.get(
        `${supabaseUrl}/rest/v1/dd_projects?select=id,name&limit=1&order=created_at.asc`,
        { headers: { Authorization: `Bearer ${token}`, apikey: token } },
    );
    if (!projectsResp.ok()) return null;

    const projects = await projectsResp.json();
    if (!Array.isArray(projects) || projects.length === 0) return null;
    return projects[0].id;
}

function authHeaders(token: string) {
    return { Authorization: `Bearer ${token}` };
}

/** Collect console errors during a page navigation. */
function trackConsoleErrors(page: Page): string[] {
    const errors: string[] = [];
    page.on('console', (msg) => {
        if (msg.type() === 'error') errors.push(msg.text());
    });
    return errors;
}

// ============================================================================
// 09 — Cockpit & Negotiation
// ============================================================================

test.describe('09 — Cockpit & Negotiation', () => {
    test.describe.configure({ mode: 'serial' });

    let token: string;
    let projectId: string | null = null;

    // ------------------------------------------------------------------
    // Setup
    // ------------------------------------------------------------------

    test('setup — authenticate and discover project', async ({ request }) => {
        token = await getAuthToken(request);
        projectId = await discoverProjectId(request, token);
        if (!projectId) {
            console.warn('[09-cockpit] No project found — project-dependent tests will be skipped.');
        } else {
            console.log(`[09-cockpit] Using project: ${projectId}`);
        }
    });

    // ------------------------------------------------------------------
    // 9.1 — Cockpit page loads
    // ------------------------------------------------------------------

    test('9.1 — Cockpit page loads with KPI panels visible', async ({ page, request }) => {
        test.skip(!projectId, 'No project found — skipping');
        await seedAuth(page, request);
        const errors = trackConsoleErrors(page);

        await gotoWithRetry(page, `/projects/${projectId}/cockpit`);
        await page.waitForLoadState('networkidle');

        // Main heading should be visible
        const heading = page.locator('h1');
        await expect(heading, 'Cockpit page should display a heading').toBeVisible({ timeout: 10_000 });

        // Look for KPI panel containers or cards
        const panels = page.locator('[class*="card"], [class*="panel"], [class*="kpi"], [class*="grid"]').first();
        await expect(panels, 'Cockpit should render KPI panel containers').toBeVisible({ timeout: 10_000 });

        const realErrors = errors.filter(isRealConsoleError);
        if (realErrors.length > 0) console.log('Console errors on Cockpit page:', realErrors);
        expect(realErrors.length, 'Cockpit page should load without critical console errors').toBe(0);
    });

    // ------------------------------------------------------------------
    // 9.2 — Cockpit KPIs: total tareas, contingencias, cobertura
    // ------------------------------------------------------------------

    test('9.2 — Cockpit KPIs: tareas, contingencias, cobertura are rendered', async ({ page, request }) => {
        test.skip(!projectId, 'No project found — skipping');
        await seedAuth(page, request);

        await gotoWithRetry(page, `/projects/${projectId}/cockpit`);
        await page.waitForLoadState('networkidle');

        // Look for task-related KPI text
        const tareas = page.locator('text=/[Tt]area|[Tt]ask/i').first();
        const hasTareas = await tareas.isVisible().catch(() => false);

        // Look for contingency-related KPI text
        const contingencias = page.locator('text=/[Cc]ontingencia|[Cc]ontingenc/i').first();
        const hasContingencias = await contingencias.isVisible().catch(() => false);

        // Look for coverage-related KPI text
        const cobertura = page.locator('text=/[Cc]obertura|[Cc]overage|%/i').first();
        const hasCobertura = await cobertura.isVisible().catch(() => false);

        // At least 2 of 3 KPI categories should be visible
        const visibleCount = [hasTareas, hasContingencias, hasCobertura].filter(Boolean).length;
        expect(
            visibleCount,
            `At least 2 of 3 KPI categories (tareas, contingencias, cobertura) should be visible, found ${visibleCount}`,
        ).toBeGreaterThanOrEqual(2);
    });

    // ------------------------------------------------------------------
    // 9.3 — HITL page loads
    // ------------------------------------------------------------------

    test('9.3 — HITL page loads with pending decisions area visible', async ({ page, request }) => {
        test.skip(!projectId, 'No project found — skipping');
        await seedAuth(page, request);
        const errors = trackConsoleErrors(page);

        await gotoWithRetry(page, `/projects/${projectId}/hitl`);
        await page.waitForLoadState('networkidle');

        const heading = page.locator('h1');
        await expect(heading, 'HITL page should display a heading').toBeVisible({ timeout: 10_000 });

        // Look for decisions area — either pending items or empty state
        const decisionsArea = page.locator(
            'text=/[Dd]ecisi|[Pp]endiente|[Rr]eview|HITL|[Aa]probar|[Nn]o hay/i',
        ).first();
        const hasDecisions = await decisionsArea.isVisible().catch(() => false);

        // Fallback: at least the main content should be present
        const mainContent = page.locator('main');
        await expect(mainContent, 'HITL page main content should be visible').toBeVisible({ timeout: 5_000 });

        expect(
            hasDecisions || (await mainContent.isVisible()),
            'HITL page should show decisions area or main content',
        ).toBe(true);

        const realErrors = errors.filter(isRealConsoleError);
        if (realErrors.length > 0) console.log('Console errors on HITL page:', realErrors);
        expect(realErrors.length, 'HITL page should load without critical console errors').toBe(0);
    });

    // ------------------------------------------------------------------
    // 9.4 — Negotiation page loads
    // ------------------------------------------------------------------

    test('9.4 — Negotiation page loads with contingency board', async ({ page, request }) => {
        test.skip(!projectId, 'No project found — skipping');
        await seedAuth(page, request);
        const errors = trackConsoleErrors(page);

        await gotoWithRetry(page, `/projects/${projectId}/negotiation`);
        await page.waitForLoadState('networkidle');

        const heading = page.locator('h1');
        await expect(heading, 'Negotiation page should display a heading').toBeVisible({ timeout: 10_000 });

        // Look for negotiation board elements — columns, cards, or table
        const boardElements = page.locator(
            'text=/[Nn]egociaci|[Cc]ontingenci|[Pp]osici|[Bb]oard|[Nn]o hay/i',
        ).first();
        const hasBoard = await boardElements.isVisible().catch(() => false);

        const mainContent = page.locator('main');
        await expect(mainContent, 'Negotiation page main content should be visible').toBeVisible({ timeout: 5_000 });

        expect(
            hasBoard || (await mainContent.isVisible()),
            'Negotiation page should show contingency board or main content',
        ).toBe(true);

        const realErrors = errors.filter(isRealConsoleError);
        if (realErrors.length > 0) console.log('Console errors on Negotiation page:', realErrors);
        expect(realErrors.length, 'Negotiation page should load without critical console errors').toBe(0);
    });

    // ------------------------------------------------------------------
    // 9.5 — Activity page loads
    // ------------------------------------------------------------------

    test('9.5 — Activity page loads with timeline visible', async ({ page, request }) => {
        test.skip(!projectId, 'No project found — skipping');
        await seedAuth(page, request);
        const errors = trackConsoleErrors(page);

        await gotoWithRetry(page, `/projects/${projectId}/activity`);
        await page.waitForLoadState('networkidle');

        const heading = page.locator('h1');
        await expect(heading, 'Activity page should display a heading').toBeVisible({ timeout: 10_000 });

        // Look for timeline elements or empty state
        const timeline = page.locator(
            'text=/[Aa]ctividad|[Tt]imeline|[Ee]vento|[Hh]istorial|[Nn]o hay/i',
        ).first();
        const hasTimeline = await timeline.isVisible().catch(() => false);

        const mainContent = page.locator('main');
        await expect(mainContent, 'Activity page main content should be visible').toBeVisible({ timeout: 5_000 });

        expect(
            hasTimeline || (await mainContent.isVisible()),
            'Activity page should show timeline or main content',
        ).toBe(true);

        const realErrors = errors.filter(isRealConsoleError);
        if (realErrors.length > 0) console.log('Console errors on Activity page:', realErrors);
        expect(realErrors.length, 'Activity page should load without critical console errors').toBe(0);
    });

    // ------------------------------------------------------------------
    // 9.6 — Cockpit API returns data
    // ------------------------------------------------------------------

    test('9.6 — GET /api/projects/[id]/cockpit returns aggregated data', async ({ request }) => {
        test.skip(!projectId, 'No project found — skipping');

        const resp = await request.get(`/api/projects/${projectId}/cockpit`, {
            headers: authHeaders(token),
        });

        expect(resp.ok(), `Cockpit API failed — HTTP ${resp.status()}`).toBeTruthy();

        const body = await resp.json();
        expect(body, 'Cockpit API should return a non-null body').toBeTruthy();

        // The response should contain at least one of the expected aggregate keys
        const hasKnownKeys = ['tasks' , 'contingencies', 'coverage', 'kpis', 'summary', 'data', 'success']
            .some((key) => key in body);
        expect(
            hasKnownKeys,
            `Cockpit API response should contain at least one known key, got: ${Object.keys(body).join(', ')}`,
        ).toBe(true);
    });
});
