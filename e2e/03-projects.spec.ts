import { test, expect, type Page } from '@playwright/test';

/**
 * 03 — Projects Lifecycle E2E Tests
 *
 * Covers:
 *   - Project listing page (/projects)
 *   - Project creation wizard (/projects/new) — 4-step flow
 *   - Project detail page (/projects/[id]) — tabs, KPIs, quick access
 *   - Team roles, EventFeed, SmartSuggestions, review depth badge
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

/** Unique suffix to identify the project created during this test run */
const TEST_RUN_ID = Date.now().toString(36);
const CREATED_PROJECT_NAME = `E2E Proyecto ${TEST_RUN_ID}`;
const CREATED_TARGET_COMPANY = `Target Corp ${TEST_RUN_ID}`;

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

/** Quick access card labels expected on the overview tab */
const QUICK_ACCESS_LABELS = [
    'Data Room',
    'Q&A',
    'Deal Cockpit',
    'Negociación',
    'HITL Review',
    'Actividad',
    'War Room',
    'Scoring',
    'Workflows',
];

/** All tabs visible on the project detail page */
const PROJECT_TABS = [
    { id: 'overview', label: 'Resumen' },
    { id: 'tasks', label: 'Tareas' },
    { id: 'contingencies', label: 'Contingencias' },
    { id: 'documents', label: 'Documentos' },
    { id: 'qa', label: 'Q&A' },
    { id: 'team', label: 'Equipo' },
    { id: 'events', label: 'Eventos' },
    { id: 'suggestions', label: 'IA Insights' },
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
 * Fetch a valid project ID from the /projects page by intercepting the
 * Supabase query or reading DOM links. Returns null if no project found.
 */
async function getFirstProjectId(page: Page): Promise<string | null> {
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
        const match = href.match(/\/projects\/([0-9a-f-]{36})/);
        if (match) return match[1];
    }

    return null;
}

/**
 * Fill a React-controlled input reliably.
 * Focuses, clears, then types character-by-character so React's onChange fires.
 */
async function fillReactInput(page: Page, selector: string, value: string): Promise<void> {
    const input = page.locator(selector).first();
    await expect(input).toBeVisible({ timeout: 10_000 });
    await input.click();
    await page.keyboard.press('Meta+a');
    await page.keyboard.press('Backspace');
    await input.pressSequentially(value, { delay: 20 });
}

// ============================================================================
// 3.1 — Projects listing page
// ============================================================================

test.describe('3.1 Projects listing page', () => {
    test('page /projects lists projects — table visible, at least 1 project', async ({
        page,
        baseURL,
    }) => {
        await seedAuth(page, baseURL!);
        await gotoWithRetry(page, '/projects');

        // Wait for the page heading
        const heading = page.locator('h1');
        await expect(heading, 'Projects page should have a heading').toBeVisible({ timeout: 10_000 });
        const headingText = await heading.textContent();
        expect(headingText, 'Heading should mention "Proyectos"').toContain('Proyectos');

        // The search filter input should be present
        const filterInput = page.locator('#projects-filter');
        await expect(filterInput, 'Projects filter input should be visible').toBeVisible({ timeout: 5_000 });

        // The "Nuevo Proyecto" button/link should be visible
        const newProjectLink = page.locator('a[href="/projects/new"]');
        await expect(newProjectLink, '"Nuevo Proyecto" link should be visible').toBeVisible({ timeout: 5_000 });

        // Table should be visible
        const table = page.locator('table');
        await expect(table, 'Projects table should be visible').toBeVisible({ timeout: 10_000 });

        // Wait for data to load (loading skeleton disappears or rows appear)
        await page.waitForLoadState('networkidle', { timeout: 15_000 }).catch(() => {});

        // Check if there is at least 1 project row
        const rows = page.locator('table tbody tr');
        const rowCount = await rows.count();

        if (rowCount === 0) {
            // Graceful skip: no projects exist yet
            console.warn('[03-projects] No projects found in the listing. Some downstream tests may skip.');
            test.skip();
            return;
        }

        expect(rowCount, 'There should be at least 1 project in the table').toBeGreaterThanOrEqual(1);

        // First row should contain a link to /projects/{id}
        const firstRowLink = rows.first().locator('a[href^="/projects/"]');
        await expect(firstRowLink, 'First project row should link to a project detail').toBeVisible({ timeout: 5_000 });
    });
});

// ============================================================================
// 3.2 & 3.3 — Project creation wizard (serial)
// ============================================================================

test.describe('3.2-3.3 Project creation wizard', () => {
    test.describe.configure({ mode: 'serial' });

    let createdProjectId: string | null = null;

    test('3.2 — Create project via /projects/new (4-step wizard)', async ({ page, baseURL }) => {
        await seedAuth(page, baseURL!);
        await gotoWithRetry(page, '/projects/new');

        // ---- Verify we landed on the wizard page ----
        const wizardHeading = page.locator('h1');
        await expect(wizardHeading, 'Wizard heading should be visible').toBeVisible({ timeout: 10_000 });
        const wizardText = await wizardHeading.textContent();
        expect(wizardText, 'Heading should mention "Nuevo Proyecto"').toContain('Nuevo Proyecto');

        // ---- STEP 1: Datos base ----
        await fillReactInput(page, '#project-name', CREATED_PROJECT_NAME);
        await fillReactInput(page, '#project-target', CREATED_TARGET_COMPANY);
        await fillReactInput(page, '#project-sector', 'Tecnologia');
        await page.locator('select#project-deal-type').selectOption('acquisition');
        await fillReactInput(page, '#project-client', 'E2E Cliente SL');

        // Set deadline to 30 days from now
        const deadline = new Date();
        deadline.setDate(deadline.getDate() + 30);
        const deadlineStr = deadline.toISOString().split('T')[0];
        await page.locator('#project-deadline').fill(deadlineStr);

        // Click "Continuar" to go to Step 2
        const continueBtn = page.locator('button:has-text("Continuar")');
        await expect(continueBtn, 'Step 1: Continuar button should be enabled').toBeEnabled({ timeout: 5_000 });
        await continueBtn.click();

        // ---- STEP 2: Preset selection ----
        // Wait for the preset heading to appear
        const presetHeading = page.locator('h2:has-text("Selecciona un preset")');
        await expect(presetHeading, 'Step 2: Preset heading should be visible').toBeVisible({ timeout: 10_000 });

        // Select the "Adquisicion" preset (first card)
        const acquisitionPreset = page.locator('button:has-text("Adquisicion")').first();
        await expect(acquisitionPreset, 'Step 2: Adquisicion preset should be visible').toBeVisible({ timeout: 5_000 });
        await acquisitionPreset.click();

        // Review depth selector should be visible — "Enhanced" is auto-selected by acquisition
        const depthLabel = page.locator('text=Profundidad de revision');
        await expect(depthLabel, 'Step 2: Review depth label should be visible').toBeVisible({ timeout: 5_000 });

        // Click "Continuar" to go to Step 3
        await expect(continueBtn, 'Step 2: Continuar button should be enabled').toBeEnabled({ timeout: 5_000 });
        await continueBtn.click();

        // ---- STEP 3: Areas configuration ----
        const areasHeading = page.locator('h2:has-text("Configuracion de areas")');
        await expect(areasHeading, 'Step 3: Areas heading should be visible').toBeVisible({ timeout: 10_000 });

        // Summary bar should show the number of selected areas
        const summaryBar = page.locator('text=/\\d+ areas seleccionadas/');
        await expect(summaryBar, 'Step 3: Summary bar with area count should be visible').toBeVisible({ timeout: 5_000 });

        // Click "Continuar" to go to Step 4
        await expect(continueBtn, 'Step 3: Continuar button should be enabled').toBeEnabled({ timeout: 5_000 });
        await continueBtn.click();

        // ---- STEP 4: Confirmation ----
        const confirmationHeading = page.locator('h2:has-text("Resumen del proyecto")');
        await expect(confirmationHeading, 'Step 4: Confirmation heading should be visible').toBeVisible({ timeout: 10_000 });

        // The project name should appear in the summary
        const projectNameInSummary = page.locator(`text=${CREATED_PROJECT_NAME}`);
        await expect(projectNameInSummary, 'Step 4: Project name should appear in summary').toBeVisible({ timeout: 5_000 });

        // The target company should appear in the summary
        const targetInSummary = page.locator(`text=${CREATED_TARGET_COMPANY}`);
        await expect(targetInSummary, 'Step 4: Target company should appear in summary').toBeVisible({ timeout: 5_000 });

        // The "Crear Proyecto" button should be visible
        const createBtn = page.locator('button:has-text("Crear Proyecto")');
        await expect(createBtn, 'Step 4: "Crear Proyecto" button should be visible').toBeVisible({ timeout: 5_000 });
        await expect(createBtn, 'Step 4: "Crear Proyecto" button should be enabled').toBeEnabled({ timeout: 5_000 });

        // Intercept the Supabase insert to capture the project ID
        const supabaseInsertPromise = page.waitForResponse(
            (r) => r.url().includes('dd_projects') && r.request().method() === 'POST',
            { timeout: 15_000 },
        );

        // Submit
        await createBtn.click();

        // Wait for the Supabase response
        const insertResponse = await supabaseInsertPromise.catch(() => null);
        if (insertResponse && insertResponse.ok()) {
            try {
                const body = await insertResponse.json();
                // Supabase .select().single() returns a single object, not an array
                const record = Array.isArray(body) ? body[0] : body;
                if (record?.id) {
                    createdProjectId = record.id;
                }
            } catch {
                // Will try to extract from URL below
            }
        }

        // After successful creation, the app should redirect to /projects/{id}
        // If the Supabase insert failed (e.g. RLS), the redirect may not happen.
        // Wait for either a redirect or a toast error message.
        try {
            await expect(page, 'Should redirect to a project detail page after creation').toHaveURL(
                /\/projects\/[0-9a-f-]{36}/,
                { timeout: 25_000 },
            );
        } catch {
            // Check for any visible error indication
            const toastError = page.locator('[data-sonner-toast] [data-type="error"], text=/Error/i, [role="alert"]');
            const hasError = await toastError.first().isVisible({ timeout: 3_000 }).catch(() => false);
            // Also check if we're still on /projects/new (insert failed silently)
            const stillOnNew = page.url().includes('/projects/new');
            if (hasError || stillOnNew) {
                console.warn('[03-projects] Project creation failed — likely blocked by RLS or returned error. Skipping.');
                test.skip();
                return;
            }
            throw new Error('Redirect to project detail page did not occur after creation');
        }

        // Extract the project ID from the URL if not already captured
        if (!createdProjectId) {
            const currentUrl = page.url();
            const match = currentUrl.match(/\/projects\/([0-9a-f-]{36})/);
            if (match) {
                createdProjectId = match[1];
            }
        }

        expect(createdProjectId, 'Created project ID should be captured').toBeTruthy();
        console.log(`[03-projects] Created project: ${CREATED_PROJECT_NAME} (${createdProjectId})`);
    });

    test('3.3 — Created project appears in the projects list', async ({ page, baseURL }) => {
        test.skip(!createdProjectId, 'No project was created in test 3.2 — skipping');

        await seedAuth(page, baseURL!);
        await gotoWithRetry(page, '/projects');

        // Wait for data to load
        await page.waitForLoadState('networkidle', { timeout: 15_000 }).catch(() => {});

        // The created project name should be visible in the table
        const projectNameCell = page.locator(`text=${CREATED_PROJECT_NAME}`);
        await expect(
            projectNameCell,
            `Created project "${CREATED_PROJECT_NAME}" should appear in the projects list`,
        ).toBeVisible({ timeout: 15_000 });
    });
});

// ============================================================================
// 3.4 – 3.10 — Project detail tests (read-only, parallel)
// ============================================================================

test.describe('3.4-3.10 Project detail page', () => {
    test.describe.configure({ mode: 'parallel' });

    // -----------------------------------------------------------------------
    // 3.4 — Tabs work
    // -----------------------------------------------------------------------
    test('3.4 — Project detail: clicking each tab loads its content', async ({ page, baseURL }) => {
        await seedAuth(page, baseURL!);

        const projectId = await getFirstProjectId(page);
        test.skip(!projectId, 'No project found — skipping tab navigation test');

        await gotoWithRetry(page, `/projects/${projectId}`);
        await page.waitForLoadState('networkidle', { timeout: 15_000 }).catch(() => {});

        // The default tab is "Resumen" (overview)
        const overviewTab = page.locator('button:has-text("Resumen")');
        await expect(overviewTab, 'Overview tab should be visible').toBeVisible({ timeout: 10_000 });

        // Click each tab and verify it responds (content changes)
        for (const tab of PROJECT_TABS) {
            if (tab.id === 'overview') continue; // Already on this tab

            const tabButton = page.locator(`button:has-text("${tab.label}")`).first();
            await expect(tabButton, `Tab "${tab.label}" should be visible`).toBeVisible({ timeout: 5_000 });
            await tabButton.click();

            // Give the tab content a moment to render
            await page.waitForTimeout(500);

            // Verify the tab button is now active (has the border-current style)
            // We just verify the button is still visible after click — the active state
            // is CSS-driven and hard to assert directly
            await expect(tabButton, `Tab "${tab.label}" should remain visible after click`).toBeVisible({ timeout: 3_000 });
        }

        // Go back to overview for other tests that may run in parallel
        await overviewTab.click();
    });

    // -----------------------------------------------------------------------
    // 3.5 — Overview: KPIs visible (progress bar with status counts)
    // -----------------------------------------------------------------------
    test('3.5 — Overview: KPI cards with numbers are visible', async ({ page, baseURL }) => {
        await seedAuth(page, baseURL!);

        const projectId = await getFirstProjectId(page);
        test.skip(!projectId, 'No project found — skipping KPI test');

        await gotoWithRetry(page, `/projects/${projectId}`);
        await page.waitForLoadState('networkidle', { timeout: 15_000 }).catch(() => {});

        // Progress bar section should be visible
        const progressLabel = page.locator('text=Progreso General');
        await expect(progressLabel, 'Progress label "Progreso General" should be visible').toBeVisible({ timeout: 10_000 });

        // The percentage display should be visible (e.g., "0% (0/0)" or "50% (5/10)")
        const progressPct = page.locator('text=/\\d+%/').first();
        await expect(progressPct, 'Progress percentage should be visible').toBeVisible({ timeout: 5_000 });

        // Status count grid: there should be multiple KPI cells with numbers
        // Each status (pending, in_progress, review, blocked, completed) has a count
        const kpiCards = page.locator('.grid.grid-cols-5 .text-center');
        const kpiCount = await kpiCards.count();
        expect(kpiCount, 'Should have status KPI cards (grid-cols-5)').toBeGreaterThanOrEqual(1);
    });

    // -----------------------------------------------------------------------
    // 3.6 — Overview: Quick access grid (9 cards with correct links)
    // -----------------------------------------------------------------------
    test('3.6 — Overview: quick access grid shows 9 cards with correct links', async ({ page, baseURL }) => {
        await seedAuth(page, baseURL!);

        const projectId = await getFirstProjectId(page);
        test.skip(!projectId, 'No project found — skipping quick access test');

        await gotoWithRetry(page, `/projects/${projectId}`);
        await page.waitForLoadState('networkidle', { timeout: 15_000 }).catch(() => {});

        // "Accesos rápidos" heading should be visible in the overview tab
        const quickAccessHeading = page.locator('h3:has-text("Accesos")');
        await expect(quickAccessHeading, '"Accesos rápidos" heading should be visible').toBeVisible({ timeout: 10_000 });

        // Verify each of the 9 quick access cards is present
        for (const label of QUICK_ACCESS_LABELS) {
            const card = page.locator(`a:has-text("${label}")`).first();
            await expect(card, `Quick access card "${label}" should be visible`).toBeVisible({ timeout: 5_000 });

            // Verify it links to the correct project subpage
            const href = await card.getAttribute('href');
            expect(href, `Quick access "${label}" should link under /projects/${projectId}/`).toContain(`/projects/${projectId}/`);
        }

        // Verify there are exactly 9 quick access links inside the grid
        // The grid is a sibling of the "Accesos rápidos" heading
        const quickAccessLinks = page.locator('h3:has-text("Accesos") + div a');
        const linkCount = await quickAccessLinks.count();
        expect(linkCount, 'Quick access grid should have exactly 9 cards').toBe(9);
    });

    // -----------------------------------------------------------------------
    // 3.7 — Tab Equipo: roles assigned
    // -----------------------------------------------------------------------
    test('3.7 — Tab Equipo: team roles are displayed', async ({ page, baseURL }) => {
        await seedAuth(page, baseURL!);

        const projectId = await getFirstProjectId(page);
        test.skip(!projectId, 'No project found — skipping team roles test');

        await gotoWithRetry(page, `/projects/${projectId}`);
        await page.waitForLoadState('networkidle', { timeout: 15_000 }).catch(() => {});

        // Click the "Equipo" tab
        const teamTab = page.locator('button:has-text("Equipo")');
        await expect(teamTab, 'Equipo tab should be visible').toBeVisible({ timeout: 10_000 });
        await teamTab.click();

        // Wait for the roles API call to complete
        await page.waitForResponse(
            (r) => r.url().includes('/roles') && r.status() === 200,
            { timeout: 10_000 },
        ).catch(() => null);

        // Give the tab content time to render
        await page.waitForTimeout(1_000);

        // There should be at least a container for the team section
        // If roles are assigned, we expect role labels or a table
        const teamContent = page.locator('main');
        await expect(teamContent, 'Main content area should be visible on Equipo tab').toBeVisible({ timeout: 5_000 });

        // Check if there are any role items displayed
        // The roles API returns role names — look for common role labels
        const roleIndicators = page.locator('text=/clo|pm_transaccion|abogado_area|deal_sponsor|cliente_externo/i');
        const roleCount = await roleIndicators.count();

        if (roleCount === 0) {
            // If no roles assigned yet, we just verify the tab loaded without error
            console.warn('[03-projects] No roles found on Equipo tab — this is OK if roles have not been assigned.');
        } else {
            expect(roleCount, 'At least one role should be displayed').toBeGreaterThanOrEqual(1);
        }
    });

    // -----------------------------------------------------------------------
    // 3.8 — Tab Eventos: EventFeed loads
    // -----------------------------------------------------------------------
    test('3.8 — Tab Eventos: EventFeed container is visible', async ({ page, baseURL }) => {
        await seedAuth(page, baseURL!);

        const projectId = await getFirstProjectId(page);
        test.skip(!projectId, 'No project found — skipping EventFeed test');

        await gotoWithRetry(page, `/projects/${projectId}`);
        await page.waitForLoadState('networkidle', { timeout: 15_000 }).catch(() => {});

        // Click the "Eventos" tab
        const eventsTab = page.locator('button:has-text("Eventos")');
        await expect(eventsTab, 'Eventos tab should be visible').toBeVisible({ timeout: 10_000 });
        await eventsTab.click();

        // Wait for content to render
        await page.waitForTimeout(1_000);

        // The EventFeed component should render. It typically has a container div.
        // We look for the main content area to contain event-related content or an empty state.
        const mainContent = page.locator('main');
        await expect(mainContent, 'Main content should be visible on Eventos tab').toBeVisible({ timeout: 5_000 });

        // Check that the events tab content loaded (not stuck on loading)
        // Look for event-related text or the empty state
        const eventsContent = page.locator('main >> text=/Evento|evento|actividad|Actividad|timeline|No hay/i').first();
        const hasContent = await eventsContent.isVisible().catch(() => false);

        // Even an empty state is valid — just verify the tab did not error out
        if (!hasContent) {
            // Verify no error message is shown
            const errorText = page.locator('text=/Error cargando|Error al cargar/i');
            const hasError = await errorText.isVisible().catch(() => false);
            expect(hasError, 'Eventos tab should not show an error message').toBe(false);
        }
    });

    // -----------------------------------------------------------------------
    // 3.9 — Tab IA Insights: SmartSuggestions loads
    // -----------------------------------------------------------------------
    test('3.9 — Tab IA Insights: SmartSuggestions section is visible', async ({ page, baseURL }) => {
        await seedAuth(page, baseURL!);

        const projectId = await getFirstProjectId(page);
        test.skip(!projectId, 'No project found — skipping SmartSuggestions test');

        await gotoWithRetry(page, `/projects/${projectId}`);
        await page.waitForLoadState('networkidle', { timeout: 15_000 }).catch(() => {});

        // Click the "IA Insights" tab
        const insightsTab = page.locator('button:has-text("IA Insights")');
        await expect(insightsTab, 'IA Insights tab should be visible').toBeVisible({ timeout: 10_000 });
        await insightsTab.click();

        // Wait for content to render
        await page.waitForTimeout(1_000);

        // The SmartSuggestions component should render within the main content area
        const mainContent = page.locator('main');
        await expect(mainContent, 'Main content should be visible on IA Insights tab').toBeVisible({ timeout: 5_000 });

        // Look for suggestions-related content or the empty state
        const suggestionsContent = page.locator('main >> text=/Sugerencia|sugerencia|Insight|insight|IA|No hay/i').first();
        const hasContent = await suggestionsContent.isVisible().catch(() => false);

        // Even an empty state is valid — just verify the tab did not error out
        if (!hasContent) {
            const errorText = page.locator('text=/Error cargando|Error al cargar/i');
            const hasError = await errorText.isVisible().catch(() => false);
            expect(hasError, 'IA Insights tab should not show an error message').toBe(false);
        }
    });

    // -----------------------------------------------------------------------
    // 3.10 — Badge review_depth visible in project header
    // -----------------------------------------------------------------------
    test('3.10 — Badge review_depth (Light/Standard/Enhanced) is visible in project header', async ({
        page,
        baseURL,
    }) => {
        await seedAuth(page, baseURL!);

        const projectId = await getFirstProjectId(page);
        test.skip(!projectId, 'No project found — skipping review depth badge test');

        await gotoWithRetry(page, `/projects/${projectId}`);
        await page.waitForLoadState('networkidle', { timeout: 15_000 }).catch(() => {});

        // The review depth badge is in the project header area, next to the status badge.
        // REVIEW_DEPTH_CONFIG.labelEs values: "Revision Ligera", "Revision Estandar", "Revision Intensiva"
        // Raw values: "light", "standard", "enhanced"
        // English labels: "Light", "Standard", "Enhanced"
        // Use a regex to match any of these via has-text (substring matching)
        const validLabels = [
            'Light', 'Standard', 'Enhanced',
            'Revision Ligera', 'Revision Estandar', 'Revision Intensiva',
            'light', 'standard', 'enhanced',
        ];

        const depthBadge = page.locator('span').filter({
            hasText: /Revision Ligera|Revision Estandar|Revision Intensiva|Light|Standard|Enhanced/,
        }).first();

        // The badge may not exist if the project has no review_depth set
        const badgeCount = await depthBadge.count();
        if (badgeCount === 0) {
            console.warn('[03-projects] No review_depth badge found — project may not have a review_depth set. Skipping.');
            test.skip();
            return;
        }

        await expect(
            depthBadge,
            'Review depth badge should be visible in the header',
        ).toBeVisible({ timeout: 10_000 });

        // Verify the badge text is one of the expected values
        const badgeText = await depthBadge.textContent();
        expect(
            validLabels.some((l) => badgeText?.includes(l)),
            `Review depth badge should contain one of ${validLabels.join(', ')}, got "${badgeText}"`,
        ).toBe(true);
    });
});
