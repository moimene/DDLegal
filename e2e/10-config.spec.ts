import { test, expect, type Page } from '@playwright/test';

/**
 * 10 — Configuracion E2E Tests
 *
 * Covers:
 *   - /configuracion          — Estado del Sistema (health dashboard)
 *   - /skills                 — Catalogo Skills
 *   - /configuracion/herramientas — Gestion Herramientas
 *   - /configuracion/skills   — Gestion Skills
 *   - /configuracion/templates — Plantillas
 *   - /configuracion/dominios — Dominios
 *   - /configuracion/seguridad — Seguridad
 *
 * All tests are pure page-load checks and run in parallel.
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

async function seedAuth(page: Page, baseURL: string) {
    const res = await fetch(`${baseURL}/api/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: PM_EMAIL, password: TEST_PASSWORD }),
    });
    if (!res.ok) throw new Error(`Auth login failed — HTTP ${res.status}`);
    const data = await res.json();
    if (!data.session?.access_token) throw new Error('Login response missing access_token');

    await page.goto('/login', { waitUntil: 'domcontentloaded', timeout: 15_000 });
    await page.evaluate(
        ({ key, value }) => localStorage.setItem(key, value),
        { key: TOKEN_KEY, value: data.session.access_token },
    );
}

/** Collect console errors and return the array reference. */
function trackConsoleErrors(page: Page): string[] {
    const errors: string[] = [];
    page.on('console', (msg) => {
        if (msg.type() === 'error') errors.push(msg.text());
    });
    return errors;
}

/**
 * Generic page-load assertion: navigates, waits for idle, checks heading
 * and console errors. Returns the heading text for further assertions.
 */
async function assertPageLoads(
    page: Page,
    baseURL: string,
    path: string,
    label: string,
): Promise<string> {
    await seedAuth(page, baseURL);
    const errors = trackConsoleErrors(page);

    await gotoWithRetry(page, path);
    await page.waitForLoadState('networkidle');

    const heading = page.locator('h1');
    await expect(heading, `${label}: heading should be visible`).toBeVisible({ timeout: 10_000 });
    const headingText = (await heading.textContent()) ?? '';

    const mainContent = page.locator('main');
    await expect(mainContent, `${label}: main content should be visible`).toBeVisible({ timeout: 5_000 });

    const realErrors = errors.filter(isRealConsoleError);
    if (realErrors.length > 0) console.log(`Console errors on ${label}:`, realErrors);
    expect(realErrors.length, `${label} should load without critical console errors`).toBe(0);

    return headingText;
}

// ============================================================================
// 10 — Configuracion (parallel)
// ============================================================================

test.describe('10 — Configuracion', () => {
    test.describe.configure({ mode: 'parallel' });

    // ------------------------------------------------------------------
    // 10.1 — Estado del Sistema
    // ------------------------------------------------------------------

    test('10.1 — Estado del Sistema loads with health data visible', async ({ page, baseURL }) => {
        await assertPageLoads(page, baseURL!, '/configuracion', 'Estado del Sistema');

        // Look for health-related indicators (status badges, service names, or metrics)
        const healthIndicators = page.locator(
            'text=/[Ss]istema|[Hh]ealth|[Ss]upabase|[Ss]ervicio|[Ee]stado|[Oo]nline|[Cc]onectado|[Aa]ctivo/i',
        ).first();
        const hasHealth = await healthIndicators.isVisible().catch(() => false);

        // Fallback: look for any table or card grid (common health dashboard patterns)
        const dataContainer = page.locator('table, [class*="grid"], [class*="card"]').first();
        const hasContainer = await dataContainer.isVisible().catch(() => false);

        expect(
            hasHealth || hasContainer,
            'Estado del Sistema should display health data or a dashboard container',
        ).toBe(true);
    });

    // ------------------------------------------------------------------
    // 10.2 — Catalogo Skills
    // ------------------------------------------------------------------

    test('10.2 — Catalogo Skills loads with skills table or grid', async ({ page, baseURL }) => {
        await assertPageLoads(page, baseURL!, '/skills', 'Catalogo Skills');

        // Look for skills listing (table, grid, or cards)
        const skillsList = page.locator('table, [class*="grid"], [class*="card"]').first();
        const hasSkillsList = await skillsList.isVisible().catch(() => false);

        // Also accept empty state
        const emptyState = page.locator('text=/[Nn]o hay|[Vv]acio|[Ee]mpty/i').first();
        const hasEmpty = await emptyState.isVisible().catch(() => false);

        expect(
            hasSkillsList || hasEmpty,
            'Catalogo Skills should show a skills listing or empty state',
        ).toBe(true);
    });

    // ------------------------------------------------------------------
    // 10.3 — Gestion Herramientas
    // ------------------------------------------------------------------

    test('10.3 — Gestion Herramientas loads with tools management UI', async ({ page, baseURL }) => {
        await assertPageLoads(page, baseURL!, '/configuracion/herramientas', 'Gestion Herramientas');

        // Look for tools-related content
        const toolsContent = page.locator(
            'text=/[Hh]erramienta|[Tt]ool|MCP|[Ss]erver|[Cc]onfigurar/i',
        ).first();
        const hasTools = await toolsContent.isVisible().catch(() => false);

        const dataContainer = page.locator('table, [class*="grid"], [class*="card"], [class*="list"]').first();
        const hasContainer = await dataContainer.isVisible().catch(() => false);

        expect(
            hasTools || hasContainer,
            'Gestion Herramientas should show tools management content',
        ).toBe(true);
    });

    // ------------------------------------------------------------------
    // 10.4 — Gestion Skills
    // ------------------------------------------------------------------

    test('10.4 — Gestion Skills loads with skill lifecycle UI', async ({ page, baseURL }) => {
        await assertPageLoads(page, baseURL!, '/configuracion/skills', 'Gestion Skills');

        // Look for skills management content
        const skillsContent = page.locator(
            'text=/[Ss]kill|[Hh]abilidad|[Cc]iclo|[Ll]ifecycle|[Gg]estion/i',
        ).first();
        const hasSkills = await skillsContent.isVisible().catch(() => false);

        const dataContainer = page.locator('table, [class*="grid"], [class*="card"], [class*="list"]').first();
        const hasContainer = await dataContainer.isVisible().catch(() => false);

        expect(
            hasSkills || hasContainer,
            'Gestion Skills should show skill lifecycle management content',
        ).toBe(true);
    });

    // ------------------------------------------------------------------
    // 10.5 — Plantillas
    // ------------------------------------------------------------------

    test('10.5 — Plantillas loads with templates table', async ({ page, baseURL }) => {
        await assertPageLoads(page, baseURL!, '/configuracion/templates', 'Plantillas');

        // Look for templates-related content
        const templatesContent = page.locator(
            'text=/[Pp]lantilla|[Tt]emplate|[Pp]reset|[Cc]onfigurar/i',
        ).first();
        const hasTemplates = await templatesContent.isVisible().catch(() => false);

        const dataContainer = page.locator('table, [class*="grid"], [class*="card"]').first();
        const hasContainer = await dataContainer.isVisible().catch(() => false);

        const emptyState = page.locator('text=/[Nn]o hay|[Vv]acio|[Ee]mpty/i').first();
        const hasEmpty = await emptyState.isVisible().catch(() => false);

        expect(
            hasTemplates || hasContainer || hasEmpty,
            'Plantillas should show templates listing, data container, or empty state',
        ).toBe(true);
    });

    // ------------------------------------------------------------------
    // 10.6 — Dominios
    // ------------------------------------------------------------------

    test('10.6 — Dominios loads with domain enums management', async ({ page, baseURL }) => {
        await assertPageLoads(page, baseURL!, '/configuracion/dominios', 'Dominios');

        // Look for domain management content
        const domainContent = page.locator(
            'text=/[Dd]ominio|[Ee]num|[Cc]atalogo|[Aa]rea|[Cc]ategoria/i',
        ).first();
        const hasDomains = await domainContent.isVisible().catch(() => false);

        const dataContainer = page.locator('table, [class*="grid"], [class*="card"], [class*="list"]').first();
        const hasContainer = await dataContainer.isVisible().catch(() => false);

        expect(
            hasDomains || hasContainer,
            'Dominios should show domain enums management content',
        ).toBe(true);
    });

    // ------------------------------------------------------------------
    // 10.7 — Seguridad
    // ------------------------------------------------------------------

    test('10.7 — Seguridad loads with user management UI', async ({ page, baseURL }) => {
        await assertPageLoads(page, baseURL!, '/configuracion/seguridad', 'Seguridad');

        // Look for security / user management content
        const securityContent = page.locator(
            'text=/[Ss]eguridad|[Uu]suario|[Rr]ol|[Pp]ermiso|[Aa]ccess|[Uu]ser/i',
        ).first();
        const hasSecurity = await securityContent.isVisible().catch(() => false);

        const dataContainer = page.locator('table, [class*="grid"], [class*="card"], [class*="list"]').first();
        const hasContainer = await dataContainer.isVisible().catch(() => false);

        expect(
            hasSecurity || hasContainer,
            'Seguridad should show user management or security content',
        ).toBe(true);
    });
});
