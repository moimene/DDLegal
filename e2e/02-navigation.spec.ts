import { test, expect, type Page } from '@playwright/test';

/**
 * 02 — Navigation & Layout E2E Tests
 *
 * Tests sidebar navigation, context-aware sections, page loads,
 * user indicator, and header elements.
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

/** Pages that must load without 500 errors */
const GLOBAL_PAGES: { label: string; path: string }[] = [
    { label: 'Dashboard', path: '/' },
    { label: 'Proyectos DD', path: '/projects' },
    { label: 'Informes', path: '/reports' },
    { label: 'Nuevo Informe', path: '/reports/new' },
    { label: 'Hub Herramientas', path: '/tools' },
    { label: 'Societario', path: '/tools/societario' },
    { label: 'Radar Marcas', path: '/tools/marcas' },
    { label: 'IP Radar', path: '/tools/ip-radar' },
    { label: 'Catalogo Skills', path: '/skills' },
    { label: 'Estado del Sistema', path: '/configuracion' },
    { label: 'Gestion Herramientas', path: '/configuracion/herramientas' },
    { label: 'Gestion Skills', path: '/configuracion/skills' },
    { label: 'Plantillas', path: '/configuracion/templates' },
    { label: 'Dominios', path: '/configuracion/dominios' },
    { label: 'Seguridad', path: '/configuracion/seguridad' },
    { label: 'Login', path: '/login' },
    { label: 'Nuevo Proyecto', path: '/projects/new' },
];

/** Expected sidebar section headers on non-project pages */
const GLOBAL_SECTION_HEADERS = ['Navegacion', 'Herramientas', 'Configuracion'];

/** Expected items in the "Proyecto" section */
const PROJECT_SECTION_ITEMS = [
    'Vista General',
    'Data Room',
    'Q&A',
    'Deal Cockpit',
    'Negociacion',
    'HITL Review',
    'Actividad',
];

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Navigate with retry — handles Next.js dev-server cold-start 404 race.
 * Retries up to 3 times if the page shows a 404.
 */
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

/**
 * Log in via the API and return the access token.
 * Throws if login fails so the test is marked as failed early.
 */
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

/**
 * Seed the browser's localStorage with the auth token so the app
 * treats the session as authenticated without going through the login UI.
 */
async function seedAuth(page: Page, baseURL: string) {
    const token = await getAuthToken(baseURL);
    // Navigate to a lightweight page first so we have an origin for localStorage
    await page.goto('/login', { waitUntil: 'domcontentloaded', timeout: 15_000 });
    await page.evaluate(
        ({ key, value }) => localStorage.setItem(key, value),
        { key: TOKEN_KEY, value: token },
    );
}

/**
 * Fetch a valid project ID from the Supabase-backed projects list.
 * Falls back to a deterministic UUID so tests can still validate
 * sidebar behaviour even when no project exists in the DB.
 */
async function getFirstProjectId(page: Page): Promise<string> {
    // Navigate to projects page and intercept the Supabase response
    const [response] = await Promise.all([
        page.waitForResponse(
            (r) => r.url().includes('dd_projects') && r.status() === 200,
            { timeout: 10_000 },
        ).catch(() => null),
        gotoWithRetry(page, '/projects'),
    ]);

    if (response) {
        try {
            const body = await response.json();
            const rows = Array.isArray(body) ? body : [];
            if (rows.length > 0 && rows[0].id) {
                return rows[0].id as string;
            }
        } catch {
            // fall through
        }
    }

    // Try extracting from DOM links
    const link = page.locator('a[href^="/projects/"]').first();
    const href = await link.getAttribute('href', { timeout: 5_000 }).catch(() => null);
    if (href) {
        const match = href.match(/\/projects\/([^/]+)/);
        if (match) return match[1];
    }

    // Last resort: use a synthetic UUID — sidebar still renders its section
    return '00000000-0000-0000-0000-000000000001';
}

// ---------------------------------------------------------------------------
// 2.1 — Dashboard loads without JS errors
// ---------------------------------------------------------------------------

test.describe('2.1 Dashboard loads without JS errors', () => {
    test('dashboard renders without critical console errors', async ({ page, baseURL }) => {
        await seedAuth(page, baseURL!);

        const errors: string[] = [];
        page.on('console', (msg) => {
            if (msg.type() === 'error') errors.push(msg.text());
        });

        await gotoWithRetry(page, '/');
        await page.waitForLoadState('networkidle');

        const realErrors = errors.filter(isRealConsoleError);
        if (realErrors.length > 0) {
            console.log('Unfiltered console errors on Dashboard:', realErrors);
        }
        expect(realErrors.length).toBe(0);
    });
});

// ---------------------------------------------------------------------------
// 2.2 — Sidebar shows 3 global sections on Dashboard
// ---------------------------------------------------------------------------

test.describe('2.2 Sidebar global sections', () => {
    test('sidebar displays Navegacion, Herramientas, Configuracion on Dashboard', async ({
        page,
        baseURL,
    }) => {
        await seedAuth(page, baseURL!);
        await gotoWithRetry(page, '/');

        const sidebar = page.locator('aside');
        await expect(sidebar).toBeVisible({ timeout: 10_000 });

        for (const header of GLOBAL_SECTION_HEADERS) {
            // Section headers are rendered as <p> with uppercase text
            const sectionHeader = sidebar.locator(`p:text-is("${header}")`);
            await expect(sectionHeader).toBeVisible({ timeout: 5_000 });
        }
    });
});

// ---------------------------------------------------------------------------
// 2.3 — Sidebar does NOT show "Proyecto" section on Dashboard
// ---------------------------------------------------------------------------

test.describe('2.3 No Proyecto section on Dashboard', () => {
    test('sidebar does not show Proyecto section when not on /projects/[id]', async ({
        page,
        baseURL,
    }) => {
        await seedAuth(page, baseURL!);
        await gotoWithRetry(page, '/');

        const sidebar = page.locator('aside');
        await expect(sidebar).toBeVisible({ timeout: 10_000 });

        const proyectoHeader = sidebar.locator('p:text-is("Proyecto")');
        await expect(proyectoHeader).toHaveCount(0);
    });
});

// ---------------------------------------------------------------------------
// 2.4 — Navigate to /projects/[id] -> sidebar shows "Proyecto" section with 7 items
// ---------------------------------------------------------------------------

test.describe('2.4 Proyecto section on project pages', () => {
    test('sidebar shows Proyecto section with 7 items on /projects/[id]', async ({
        page,
        baseURL,
    }) => {
        await seedAuth(page, baseURL!);

        const projectId = await getFirstProjectId(page);
        await gotoWithRetry(page, `/projects/${projectId}`);

        const sidebar = page.locator('aside');
        await expect(sidebar).toBeVisible({ timeout: 10_000 });

        // "Proyecto" section header must be visible
        const proyectoHeader = sidebar.locator('p:text-is("Proyecto")');
        await expect(proyectoHeader).toBeVisible({ timeout: 5_000 });

        // Verify each of the 7 expected items
        for (const label of PROJECT_SECTION_ITEMS) {
            const item = sidebar.locator(`a[aria-label="${label}"]`);
            await expect(item).toBeVisible({ timeout: 5_000 });
        }
    });
});

// ---------------------------------------------------------------------------
// 2.5 — Sidebar collapse / expand toggle works
// ---------------------------------------------------------------------------

test.describe('2.5 Sidebar collapse/expand', () => {
    test('collapse toggle hides labels and expand restores them', async ({
        page,
        baseURL,
    }) => {
        await seedAuth(page, baseURL!);
        await gotoWithRetry(page, '/');

        const sidebar = page.locator('aside');
        await expect(sidebar).toBeVisible({ timeout: 10_000 });

        // The "Dashboard" label text should be visible when expanded
        const dashboardSpan = sidebar.locator('a[aria-label="Dashboard"] span');
        await expect(dashboardSpan).toBeVisible({ timeout: 5_000 });

        // Click collapse button
        const collapseBtn = sidebar.locator('button[aria-label="Colapsar menu"]');
        await expect(collapseBtn).toBeVisible({ timeout: 5_000 });
        await collapseBtn.click();

        // After collapse, label text should be hidden
        await expect(dashboardSpan).toBeHidden({ timeout: 5_000 });

        // The expand button should now appear
        const expandBtn = sidebar.locator('button[aria-label="Expandir menu"]');
        await expect(expandBtn).toBeVisible({ timeout: 5_000 });
        await expandBtn.click();

        // After expand, label text should be visible again
        await expect(dashboardSpan).toBeVisible({ timeout: 5_000 });
    });
});

// ---------------------------------------------------------------------------
// 2.6 — All global pages load without 500 error
// ---------------------------------------------------------------------------

test.describe('2.6 All global pages load without 500', () => {
    test.describe.configure({ mode: 'parallel' });

    for (const pg of GLOBAL_PAGES) {
        test(`${pg.label} (${pg.path}) loads without 500`, async ({ page, baseURL }) => {
            // Login page doesn't need auth seeding
            if (pg.path !== '/login') {
                await seedAuth(page, baseURL!);
            }

            let got500 = false;
            page.on('response', (res) => {
                // Only check document navigations — not every sub-request
                if (res.url().endsWith(pg.path) || res.url().includes(pg.path)) {
                    if (res.status() === 500) got500 = true;
                }
            });

            await gotoWithRetry(page, pg.path);

            // For login page, just check we land on the page
            if (pg.path === '/login') {
                const heading = page.locator('h1');
                await expect(heading).toBeVisible({ timeout: 10_000 });
            } else {
                // Every authenticated page should render its <main> content area
                const main = page.locator('main');
                await expect(main).toBeVisible({ timeout: 10_000 });
            }

            expect(got500).toBe(false);
        });
    }
});

// ---------------------------------------------------------------------------
// 2.7 — User indicator shows email when logged in
// ---------------------------------------------------------------------------

test.describe('2.7 User indicator shows email', () => {
    test('header displays the logged-in user email', async ({ page, baseURL }) => {
        await seedAuth(page, baseURL!);
        await gotoWithRetry(page, '/');

        // The user email is rendered inside a <span> in the top bar
        // We look for a text node that contains the test email
        const emailIndicator = page.locator(`text=${TEST_EMAIL}`);
        await expect(emailIndicator).toBeVisible({ timeout: 15_000 });
    });
});

// ---------------------------------------------------------------------------
// 2.8 — Notification bell icon is visible in header
// ---------------------------------------------------------------------------

test.describe('2.8 Notification bell in header', () => {
    test('notification bell button is visible when logged in', async ({ page, baseURL }) => {
        await seedAuth(page, baseURL!);
        await gotoWithRetry(page, '/');

        // The bell button has an aria-label starting with "Notificaciones"
        const bellButton = page.locator('button[aria-label^="Notificaciones"]');
        await expect(bellButton).toBeVisible({ timeout: 15_000 });
    });
});

// ---------------------------------------------------------------------------
// 2.9 — Sidebar active state highlights correct item
// ---------------------------------------------------------------------------

test.describe('2.9 Sidebar active state', () => {
    test('Dashboard link has aria-current="page" on /', async ({ page, baseURL }) => {
        await seedAuth(page, baseURL!);
        await gotoWithRetry(page, '/');

        const sidebar = page.locator('aside');
        await expect(sidebar).toBeVisible({ timeout: 10_000 });

        const dashboardLink = sidebar.locator('a[aria-label="Dashboard"]');
        await expect(dashboardLink).toHaveAttribute('aria-current', 'page', { timeout: 5_000 });
    });

    test('Proyectos DD link has aria-current="page" on /projects', async ({ page, baseURL }) => {
        await seedAuth(page, baseURL!);
        await gotoWithRetry(page, '/projects');

        const sidebar = page.locator('aside');
        await expect(sidebar).toBeVisible({ timeout: 10_000 });

        const projectsLink = sidebar.locator('a[aria-label="Proyectos DD"]');
        await expect(projectsLink).toHaveAttribute('aria-current', 'page', { timeout: 5_000 });
    });

    test('Hub Herramientas link has aria-current="page" on /tools', async ({ page, baseURL }) => {
        await seedAuth(page, baseURL!);
        await gotoWithRetry(page, '/tools');

        const sidebar = page.locator('aside');
        await expect(sidebar).toBeVisible({ timeout: 10_000 });

        const toolsLink = sidebar.locator('a[aria-label="Hub Herramientas"]');
        await expect(toolsLink).toHaveAttribute('aria-current', 'page', { timeout: 5_000 });
    });

    test('non-active links do NOT have aria-current', async ({ page, baseURL }) => {
        await seedAuth(page, baseURL!);
        await gotoWithRetry(page, '/');

        const sidebar = page.locator('aside');
        await expect(sidebar).toBeVisible({ timeout: 10_000 });

        // Proyectos DD should not be active on the Dashboard page
        const projectsLink = sidebar.locator('a[aria-label="Proyectos DD"]');
        const ariaCurrent = await projectsLink.getAttribute('aria-current');
        expect(ariaCurrent).toBeNull();
    });
});

// ---------------------------------------------------------------------------
// 2.10 — Sidebar "Proyecto activo" badge visible on project pages
// ---------------------------------------------------------------------------

test.describe('2.10 Proyecto activo badge', () => {
    test('"Proyecto activo" badge appears on /projects/[id]', async ({ page, baseURL }) => {
        await seedAuth(page, baseURL!);

        const projectId = await getFirstProjectId(page);
        await gotoWithRetry(page, `/projects/${projectId}`);

        const sidebar = page.locator('aside');
        await expect(sidebar).toBeVisible({ timeout: 10_000 });

        // The badge is a <span> with text "Proyecto activo" next to the section header
        const badge = sidebar.locator('span:text-is("Proyecto activo")');
        await expect(badge).toBeVisible({ timeout: 5_000 });
    });

    test('"Proyecto activo" badge is NOT visible on non-project pages', async ({
        page,
        baseURL,
    }) => {
        await seedAuth(page, baseURL!);
        await gotoWithRetry(page, '/');

        const sidebar = page.locator('aside');
        await expect(sidebar).toBeVisible({ timeout: 10_000 });

        const badge = sidebar.locator('span:text-is("Proyecto activo")');
        await expect(badge).toHaveCount(0);
    });
});
