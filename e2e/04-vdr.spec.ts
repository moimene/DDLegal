import { test, expect, type Page } from '@playwright/test';

/**
 * 04 — Virtual Data Room (VDR) E2E Tests
 *
 * Covers:
 *   - VDR API: documents pagination, filters, folder CRUD, bulk create (serial, API-only)
 *   - VDR UI:  page load, folder tree, document list, gap analysis (browser tests)
 *
 * Test users are expected to be seeded via POST /api/auth/setup-test-users.
 * Password for all test accounts: test123456
 */

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const TEST_EMAIL = 'pm@test.ddlegal.com';
const TEST_PASSWORD = 'test123456';
const TOKEN_KEY = 'dd_session_token';

/** Unique suffix to avoid collisions between test runs. */
const RUN_ID = Date.now().toString(36);

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

/** Returns true if the console message should be treated as a real error. */
function isRealConsoleError(text: string): boolean {
    return !IGNORED_CONSOLE_PATTERNS.some((p) => text.includes(p));
}

/**
 * Navigate with retry — handles Next.js dev-server cold-start 404 race.
 * Retries up to 3 times if the page shows a 404.
 */
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
    await page.goto('/login', { waitUntil: 'domcontentloaded', timeout: 15_000 });
    await page.evaluate(
        ({ key, value }) => localStorage.setItem(key, value),
        { key: TOKEN_KEY, value: token },
    );
}

/**
 * Fetch a valid project ID from the projects listing API or from the
 * Supabase-backed projects list on the page. Returns null if no project exists.
 */
async function getProjectId(
    request: { get: (url: string, options?: Record<string, unknown>) => Promise<{ ok: () => boolean; json: () => Promise<Record<string, unknown>> }> },
    token: string,
): Promise<string | null> {
    // Strategy 1: Try the projects listing API
    try {
        const listResp = await request.get('/api/projects', {
            headers: { Authorization: `Bearer ${token}` },
        });
        if (listResp.ok()) {
            const body = await listResp.json();
            const projects = (body.projects || body.data || (Array.isArray(body) ? body : [])) as Array<{ id: string; status?: string }>;
            if (projects.length > 0) {
                const active = projects.find((p) => p.status === 'active');
                return (active?.id || projects[0].id) as string;
            }
        }
    } catch {
        // Endpoint may not exist
    }

    // Strategy 2: Try the system health endpoint
    try {
        const healthResp = await request.get('/api/system/health', {
            headers: { Authorization: `Bearer ${token}` },
        });
        if (healthResp.ok()) {
            const body = await healthResp.json();
            if (body.demo_project_id) return body.demo_project_id as string;
        }
    } catch {
        // Continue
    }

    return null;
}

// ============================================================================
// VDR API Tests — serial, API-only (no browser)
// ============================================================================

test.describe('VDR API', () => {
    test.describe.configure({ mode: 'serial' });

    // Shared state across serial tests
    let token: string;
    let projectId: string;
    let createdFolderId: string;
    let createdSubfolderId: string;
    let createdDocIds: string[] = [];

    // ------------------------------------------------------------------
    // Setup: login and get a project ID
    // ------------------------------------------------------------------
    test('setup — login and resolve project ID', async ({ request }) => {
        const loginResp = await request.post('/api/auth/login', {
            data: { email: TEST_EMAIL, password: TEST_PASSWORD },
        });
        expect(loginResp.status(), 'Login should return 200').toBe(200);

        const loginBody = await loginResp.json();
        expect(loginBody.session?.access_token, 'Login should return an access_token').toBeTruthy();
        token = loginBody.session.access_token;

        const id = await getProjectId(request as never, token);
        if (!id) {
            test.skip();
            return;
        }
        projectId = id;
    });

    // ------------------------------------------------------------------
    // 4.2 — Create folder via API
    // ------------------------------------------------------------------
    test('4.2 — POST /api/vdr/folders creates a folder', async ({ request }) => {
        test.skip(!projectId, 'No project available');

        const folderName = `E2E Folder ${RUN_ID}`;
        const resp = await request.post('/api/vdr/folders', {
            headers: { Authorization: `Bearer ${token}` },
            data: { project_id: projectId, name: folderName, area_code: 'MERC' },
        });

        expect(resp.status(), 'POST /api/vdr/folders should return 200').toBe(200);

        const body = await resp.json();
        expect(body.success, 'Response should include success: true').toBe(true);
        expect(body.folder, 'Response should include a folder object').toBeTruthy();
        expect(body.folder.name, 'Folder name should match').toBe(folderName);
        expect(body.folder.project_id, 'Folder project_id should match').toBe(projectId);
        expect(body.folder.id, 'Folder should have an id').toBeTruthy();

        createdFolderId = body.folder.id;
    });

    // ------------------------------------------------------------------
    // 4.3 — Create subfolder (nested folder)
    // ------------------------------------------------------------------
    test('4.3 — POST /api/vdr/folders creates a nested subfolder', async ({ request }) => {
        test.skip(!projectId || !createdFolderId, 'No project or parent folder available');

        const subfolderName = `E2E Subfolder ${RUN_ID}`;
        const resp = await request.post('/api/vdr/folders', {
            headers: { Authorization: `Bearer ${token}` },
            data: {
                project_id: projectId,
                name: subfolderName,
                parent_id: createdFolderId,
                area_code: 'MERC',
            },
        });

        expect(resp.status(), 'POST /api/vdr/folders (subfolder) should return 200').toBe(200);

        const body = await resp.json();
        expect(body.success, 'Response should include success: true').toBe(true);
        expect(body.folder.parent_id, 'Subfolder parent_id should match parent folder id').toBe(createdFolderId);

        createdSubfolderId = body.folder.id;
    });

    // ------------------------------------------------------------------
    // 4.A3 — PATCH /api/vdr/folders rename
    // ------------------------------------------------------------------
    test('4.A3 — PATCH /api/vdr/folders renames a folder', async ({ request }) => {
        test.skip(!projectId || !createdFolderId, 'No project or folder available');

        const newName = `E2E Renamed ${RUN_ID}`;
        const resp = await request.patch('/api/vdr/folders', {
            headers: { Authorization: `Bearer ${token}` },
            data: { id: createdFolderId, name: newName },
        });

        expect(resp.status(), 'PATCH /api/vdr/folders should return 200').toBe(200);

        const body = await resp.json();
        expect(body.success, 'Response should include success: true').toBe(true);
        expect(body.folder.name, 'Folder name should be updated').toBe(newName);
        expect(body.folder.id, 'Folder id should remain the same').toBe(createdFolderId);
    });

    // ------------------------------------------------------------------
    // 4.4 — Create document via API
    // ------------------------------------------------------------------
    test('4.4 — POST /api/vdr/documents creates a document with status draft', async ({ request }) => {
        test.skip(!projectId, 'No project available');

        const docName = `E2E Document ${RUN_ID}`;
        const resp = await request.post('/api/vdr/documents', {
            headers: { Authorization: `Bearer ${token}` },
            data: {
                project_id: projectId,
                name: docName,
                folder_id: createdFolderId || null,
                area_code: 'MERC',
                category: 'contrato',
                is_confidential: false,
                description: 'Test document created by E2E suite',
                tags: ['e2e', 'test'],
            },
        });

        expect(resp.status(), 'POST /api/vdr/documents should return 200').toBe(200);

        const body = await resp.json();
        expect(body.success, 'Response should include success: true').toBe(true);
        expect(body.document, 'Response should include a document object').toBeTruthy();
        expect(body.document.name, 'Document name should match').toBe(docName);
        expect(body.document.status, 'New document should have status "draft"').toBe('draft');
        expect(body.document.category, 'Document category should be "contrato"').toBe('contrato');
        expect(body.document.is_confidential, 'Document should not be confidential').toBe(false);
        expect(body.document.id, 'Document should have an id').toBeTruthy();

        createdDocIds.push(body.document.id);
    });

    // ------------------------------------------------------------------
    // 4.A5 — Bulk create multiple documents
    // ------------------------------------------------------------------
    test('4.A5 — POST /api/vdr/documents bulk create (multiple docs)', async ({ request }) => {
        test.skip(!projectId, 'No project available');

        const docNames = [
            `E2E Bulk Doc A ${RUN_ID}`,
            `E2E Bulk Doc B ${RUN_ID}`,
            `E2E Bulk Doc C ${RUN_ID}`,
        ];

        for (const name of docNames) {
            const resp = await request.post('/api/vdr/documents', {
                headers: { Authorization: `Bearer ${token}` },
                data: {
                    project_id: projectId,
                    name,
                    category: 'general',
                    is_confidential: false,
                    tags: ['e2e', 'bulk'],
                },
            });

            expect(resp.status(), `Creating "${name}" should return 200`).toBe(200);

            const body = await resp.json();
            expect(body.success, `"${name}" creation should succeed`).toBe(true);
            expect(body.document?.id, `"${name}" should have an id`).toBeTruthy();

            createdDocIds.push(body.document.id);
        }

        // Now verify total count for our test docs via a search
        const verifyResp = await request.get(
            `/api/vdr/documents?project_id=${projectId}&search=E2E+Bulk+Doc&limit=10`,
            { headers: { Authorization: `Bearer ${token}` } },
        );

        expect(verifyResp.status(), 'Verification query should return 200').toBe(200);

        const verifyBody = await verifyResp.json();
        expect(
            verifyBody.documents.length,
            'Should find at least 3 bulk docs',
        ).toBeGreaterThanOrEqual(3);
    });

    // ------------------------------------------------------------------
    // 4.A1 — GET /api/vdr/documents pagination
    // ------------------------------------------------------------------
    test('4.A1 — GET /api/vdr/documents returns pagination and X-Total-Count header', async ({ request }) => {
        test.skip(!projectId, 'No project available');

        // Fetch with limit=2 to verify pagination fields
        const resp = await request.get(
            `/api/vdr/documents?project_id=${projectId}&limit=2&offset=0`,
            { headers: { Authorization: `Bearer ${token}` } },
        );

        expect(resp.status(), 'GET /api/vdr/documents should return 200').toBe(200);

        // X-Total-Count header
        const totalCountHeader = resp.headers()['x-total-count'];
        expect(totalCountHeader, 'X-Total-Count header should be present').toBeTruthy();
        const totalCount = parseInt(totalCountHeader, 10);
        expect(totalCount, 'X-Total-Count should be a non-negative number').toBeGreaterThanOrEqual(0);

        const body = await resp.json();
        expect(body.success, 'Response should include success: true').toBe(true);
        expect(body.pagination, 'Response should include pagination object').toBeTruthy();
        expect(body.pagination.total, 'pagination.total should be a number').toBe(totalCount);
        expect(body.pagination.limit, 'pagination.limit should be 2').toBe(2);
        expect(body.pagination.offset, 'pagination.offset should be 0').toBe(0);
        expect(typeof body.pagination.has_more, 'pagination.has_more should be boolean').toBe('boolean');

        // Documents array should not exceed limit
        expect(
            body.documents.length,
            'Documents returned should not exceed limit',
        ).toBeLessThanOrEqual(2);

        // If there are more than 2 docs, has_more should be true
        if (totalCount > 2) {
            expect(body.pagination.has_more, 'has_more should be true when total > limit').toBe(true);
        }

        // Verify offset works: fetch second page
        if (totalCount > 2) {
            const page2Resp = await request.get(
                `/api/vdr/documents?project_id=${projectId}&limit=2&offset=2`,
                { headers: { Authorization: `Bearer ${token}` } },
            );
            expect(page2Resp.status(), 'Offset query should return 200').toBe(200);

            const page2Body = await page2Resp.json();
            expect(page2Body.pagination.offset, 'Second page offset should be 2').toBe(2);

            // IDs from page 1 and page 2 should not overlap
            const page1Ids = new Set(body.documents.map((d: { id: string }) => d.id));
            const page2Ids = page2Body.documents.map((d: { id: string }) => d.id);
            for (const id of page2Ids) {
                expect(page1Ids.has(id), `Document ${id} should not appear on both pages`).toBe(false);
            }
        }
    });

    // ------------------------------------------------------------------
    // 4.A2 — GET /api/vdr/documents filters
    // ------------------------------------------------------------------
    test('4.A2 — GET /api/vdr/documents supports filters (is_confidential, date_from, search)', async ({ request }) => {
        test.skip(!projectId, 'No project available');

        // Filter: is_confidential=false
        const confResp = await request.get(
            `/api/vdr/documents?project_id=${projectId}&is_confidential=false&limit=5`,
            { headers: { Authorization: `Bearer ${token}` } },
        );
        expect(confResp.status(), 'Confidentiality filter should return 200').toBe(200);
        const confBody = await confResp.json();
        expect(confBody.success, 'Response should include success: true').toBe(true);
        // All returned docs should have is_confidential=false
        for (const doc of confBody.documents) {
            expect(doc.is_confidential, 'Filtered docs should have is_confidential=false').toBe(false);
        }

        // Filter: date_from (use a date far in the past to get all docs)
        const dateResp = await request.get(
            `/api/vdr/documents?project_id=${projectId}&date_from=2020-01-01&limit=5`,
            { headers: { Authorization: `Bearer ${token}` } },
        );
        expect(dateResp.status(), 'Date filter should return 200').toBe(200);
        const dateBody = await dateResp.json();
        expect(dateBody.success, 'Response should include success: true').toBe(true);
        // All returned docs should be after 2020-01-01
        for (const doc of dateBody.documents) {
            expect(
                new Date(doc.created_at).getTime(),
                `Document "${doc.name}" created_at should be >= 2020-01-01`,
            ).toBeGreaterThanOrEqual(new Date('2020-01-01').getTime());
        }

        // Filter: search with our unique RUN_ID
        const searchResp = await request.get(
            `/api/vdr/documents?project_id=${projectId}&search=${encodeURIComponent(`E2E Document ${RUN_ID}`)}&limit=10`,
            { headers: { Authorization: `Bearer ${token}` } },
        );
        expect(searchResp.status(), 'Search filter should return 200').toBe(200);
        const searchBody = await searchResp.json();
        expect(searchBody.success, 'Response should include success: true').toBe(true);
        expect(
            searchBody.documents.length,
            'Search should return at least 1 matching document',
        ).toBeGreaterThanOrEqual(1);
        expect(
            searchBody.documents[0].name,
            'First result should contain the search term',
        ).toContain(`E2E Document ${RUN_ID}`);
    });

    // ------------------------------------------------------------------
    // 4.6 — Move document between folders via PATCH
    // ------------------------------------------------------------------
    test('4.6 — PATCH /api/vdr/documents/[id] moves document to a different folder', async ({ request }) => {
        test.skip(!projectId || createdDocIds.length === 0, 'No project or document available');

        const docId = createdDocIds[0];

        // Move to subfolder (if it exists) or to root (null)
        const targetFolderId = createdSubfolderId || null;

        const resp = await request.patch(`/api/vdr/documents/${docId}`, {
            headers: { Authorization: `Bearer ${token}` },
            data: { folder_id: targetFolderId },
        });

        expect(resp.status(), 'PATCH /api/vdr/documents/[id] should return 200').toBe(200);

        const body = await resp.json();
        expect(body.success, 'Response should include success: true').toBe(true);
        expect(body.document.folder_id, 'Document folder_id should be updated').toBe(targetFolderId);

        // Verify by fetching the document
        const verifyResp = await request.get(`/api/vdr/documents/${docId}`, {
            headers: { Authorization: `Bearer ${token}` },
        });
        expect(verifyResp.status(), 'GET /api/vdr/documents/[id] should return 200').toBe(200);

        const verifyBody = await verifyResp.json();
        expect(verifyBody.document.folder_id, 'Verified folder_id should match target').toBe(targetFolderId);
    });

    // ------------------------------------------------------------------
    // 4.7 — Search documents via GET
    // ------------------------------------------------------------------
    test('4.7 — GET /api/vdr/documents with search param returns filtered results', async ({ request }) => {
        test.skip(!projectId, 'No project available');

        const searchTerm = `Bulk Doc B ${RUN_ID}`;
        const resp = await request.get(
            `/api/vdr/documents?project_id=${projectId}&search=${encodeURIComponent(searchTerm)}&limit=10`,
            { headers: { Authorization: `Bearer ${token}` } },
        );

        expect(resp.status(), 'Search query should return 200').toBe(200);

        const body = await resp.json();
        expect(body.success, 'Response should include success: true').toBe(true);
        expect(body.documents.length, 'Search should return at least 1 result').toBeGreaterThanOrEqual(1);

        // Every returned document should contain the search term
        for (const doc of body.documents) {
            expect(
                doc.name.toLowerCase(),
                `Document "${doc.name}" should match search term`,
            ).toContain('bulk doc b');
        }
    });

    // ------------------------------------------------------------------
    // 4.A4 — DELETE /api/vdr/folders cascade check (non-empty folder)
    // ------------------------------------------------------------------
    test('4.A4 — DELETE /api/vdr/folders returns 409 for non-empty folder', async ({ request }) => {
        test.skip(!projectId || !createdFolderId, 'No project or folder available');

        // The folder has a subfolder, so it should be non-empty
        const resp = await request.delete(
            `/api/vdr/folders?id=${createdFolderId}`,
            { headers: { Authorization: `Bearer ${token}` } },
        );

        // Should get 409 because folder has child folders
        expect(resp.status(), 'DELETE non-empty folder without force should return 409').toBe(409);

        const body = await resp.json();
        expect(body.success, 'Response success should be false').toBe(false);
        expect(body.warning, 'Response should include a warning message').toBeTruthy();
        expect(body.child_folder_count, 'Response should report child_folder_count').toBeGreaterThanOrEqual(1);
    });

    // ------------------------------------------------------------------
    // Cleanup: force-delete test folders and archive test documents
    // ------------------------------------------------------------------
    test('cleanup — remove test data', async ({ request }) => {
        test.skip(!projectId, 'No project available — nothing to clean up');

        // Archive test documents
        for (const docId of createdDocIds) {
            await request.patch(`/api/vdr/documents/${docId}`, {
                headers: { Authorization: `Bearer ${token}` },
                data: { status: 'archived' },
            }).catch(() => { /* best effort */ });
        }

        // Delete subfolder first, then parent
        if (createdSubfolderId) {
            await request.delete(
                `/api/vdr/folders?id=${createdSubfolderId}&force=true`,
                { headers: { Authorization: `Bearer ${token}` } },
            ).catch(() => { /* best effort */ });
        }

        if (createdFolderId) {
            await request.delete(
                `/api/vdr/folders?id=${createdFolderId}&force=true`,
                { headers: { Authorization: `Bearer ${token}` } },
            ).catch(() => { /* best effort */ });
        }
    });
});

// ============================================================================
// VDR Browser Tests — serial
// ============================================================================

test.describe('VDR Browser', () => {
    test.describe.configure({ mode: 'serial' });

    // Shared state
    let projectId: string;

    // ------------------------------------------------------------------
    // Setup: resolve project ID via API
    // ------------------------------------------------------------------
    test('setup — resolve project ID for browser tests', async ({ request }) => {
        const loginResp = await request.post('/api/auth/login', {
            data: { email: TEST_EMAIL, password: TEST_PASSWORD },
        });
        expect(loginResp.status(), 'Login should return 200').toBe(200);

        const loginBody = await loginResp.json();
        const token = loginBody.session.access_token;

        const id = await getProjectId(request as never, token);
        if (!id) {
            test.skip();
            return;
        }
        projectId = id;
    });

    // ------------------------------------------------------------------
    // 4.1 — VDR page loads (folder tree or document list visible)
    // ------------------------------------------------------------------
    test('4.1 — VDR page loads with folder tree and document list', async ({ page, baseURL }) => {
        test.skip(!projectId, 'No project available');

        await seedAuth(page, baseURL!);

        const errors: string[] = [];
        page.on('console', (msg) => {
            if (msg.type() === 'error') errors.push(msg.text());
        });

        await gotoWithRetry(page, `/projects/${projectId}/vdr`);
        await page.waitForLoadState('networkidle');

        // The page heading should be "Data Room Virtual"
        const heading = page.locator('h1');
        await expect(heading, 'VDR page heading should be visible').toBeVisible({ timeout: 15_000 });
        const headingText = await heading.textContent();
        expect(headingText, 'Heading should contain "Data Room Virtual"').toContain('Data Room Virtual');

        // Folder tree section: "Carpetas" heading should be present
        const foldersHeading = page.locator('h3:text-is("Carpetas")');
        await expect(foldersHeading, 'Folder tree heading "Carpetas" should be visible').toBeVisible({ timeout: 10_000 });

        // "Todos los documentos" button in folder tree
        const allDocsBtn = page.locator('button:has-text("Todos los documentos")');
        await expect(allDocsBtn, '"Todos los documentos" button should be visible').toBeVisible({ timeout: 5_000 });

        // Search bar placeholder
        const searchInput = page.locator('input[placeholder*="Buscar documentos"]');
        await expect(searchInput, 'Search input should be visible').toBeVisible({ timeout: 5_000 });

        // "Subir Documento" button
        const uploadBtn = page.locator('button:has-text("Subir Documento")');
        await expect(uploadBtn, 'Upload button should be visible').toBeVisible({ timeout: 5_000 });

        // Check for real console errors
        const realErrors = errors.filter(isRealConsoleError);
        if (realErrors.length > 0) {
            console.log('Unfiltered console errors on VDR page:', realErrors);
        }
        expect(realErrors.length, 'VDR page should have no unexpected console errors').toBe(0);
    });

    // ------------------------------------------------------------------
    // 4.5 — Document appears with correct status badge
    // ------------------------------------------------------------------
    test('4.5 — Documents display with status badges', async ({ page, baseURL }) => {
        test.skip(!projectId, 'No project available');

        await seedAuth(page, baseURL!);
        await gotoWithRetry(page, `/projects/${projectId}/vdr`);
        await page.waitForLoadState('networkidle');

        // Wait for document list to load (either documents appear or "No hay documentos" message)
        const docsOrEmpty = page.locator('[class*="col-span-5"]').first();
        await expect(docsOrEmpty, 'Document list column should be visible').toBeVisible({ timeout: 10_000 });

        // Check for status badges — look for any of the VDR status labels
        const statusLabels = ['Borrador', 'Preparado', 'Subido', 'Procesando', 'Indexado', 'Superado', 'Archivado', 'Error'];
        const hasStatus = await page.locator('span').filter({
            hasText: new RegExp(statusLabels.join('|')),
        }).count();

        const emptyMessage = await page.locator('text=No hay documentos').count();

        // Either we have documents with status badges, or the list is empty
        expect(
            hasStatus > 0 || emptyMessage > 0,
            'Page should show either documents with status badges or an empty message',
        ).toBe(true);
    });

    // ------------------------------------------------------------------
    // 4.8 — Gap Analysis page loads with KPIs
    // ------------------------------------------------------------------
    test('4.8 — Gap Analysis page loads with KPI cards', async ({ page, baseURL }) => {
        test.skip(!projectId, 'No project available');

        await seedAuth(page, baseURL!);

        const errors: string[] = [];
        page.on('console', (msg) => {
            if (msg.type() === 'error') errors.push(msg.text());
        });

        await gotoWithRetry(page, `/projects/${projectId}/vdr/gap-analysis`);
        await page.waitForLoadState('networkidle');

        // Page heading should contain "Analisis de Brechas" or "Gap Analysis"
        const heading = page.locator('h1');
        await expect(heading, 'Gap Analysis page heading should be visible').toBeVisible({ timeout: 15_000 });

        // KPI cards section: should have 4 metric cards
        // Look for the key KPI labels
        const expectedKPILabels = [
            'Documentos Esperados',
            'Documentos Subidos',
            'Faltantes Obligatorios',
            'Faltantes Opcionales',
        ];

        for (const label of expectedKPILabels) {
            const kpiLabel = page.locator(`text=${label}`);
            await expect(
                kpiLabel,
                `KPI card "${label}" should be visible`,
            ).toBeVisible({ timeout: 10_000 });
        }

        // Coverage percentage badge should be visible
        const coverageBadge = page.locator('text=/\\d+% cobertura/');
        await expect(coverageBadge, 'Coverage percentage badge should be visible').toBeVisible({ timeout: 10_000 });

        // "Cobertura por Area" section heading
        const areaSectionHeading = page.locator('h2:text-is("Cobertura por Area")');
        await expect(areaSectionHeading, '"Cobertura por Area" heading should be visible').toBeVisible({ timeout: 10_000 });

        // Area coverage grid should have at least 5 area cards (MERC, CONT, LAB, FISC, etc.)
        const areaCards = page.locator('.g-card').filter({
            has: page.locator('text=/\\d+%/'),
        });
        const areaCount = await areaCards.count();
        expect(
            areaCount,
            'Should have at least 5 area coverage cards',
        ).toBeGreaterThanOrEqual(5);

        // "Documentos Faltantes" table section
        const missingDocsHeading = page.locator('h2:text-is("Documentos Faltantes")');
        await expect(missingDocsHeading, '"Documentos Faltantes" heading should be visible').toBeVisible({ timeout: 10_000 });

        // Check for real console errors
        const realErrors = errors.filter(isRealConsoleError);
        if (realErrors.length > 0) {
            console.log('Unfiltered console errors on Gap Analysis page:', realErrors);
        }
        expect(realErrors.length, 'Gap Analysis page should have no unexpected console errors').toBe(0);
    });
});
