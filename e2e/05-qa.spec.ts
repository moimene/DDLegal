import { test, expect, type Page, type APIRequestContext } from '@playwright/test';

/**
 * 05 — Q&A Module E2E Tests
 *
 * Covers:
 *   - Q&A page loads (browser)
 *   - Thread CRUD lifecycle via API (serial, API-only)
 *   - Messages (advisor + target sender roles)
 *   - Status lifecycle: draft -> sent -> answered -> closed
 *   - SLA tracking (auto-created when sla_hours specified)
 *   - Assignment routing
 *   - Cross-links to contingency and document_version
 *   - Filters by area_code and status
 *
 * Tests run serially because later tests depend on thread IDs
 * and state created in earlier tests.
 */

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const TEST_PASSWORD = 'test123456';
const PM_EMAIL = 'pm@test.ddlegal.com';
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

/** Log in via the API and return the access token. */
async function getAuthToken(request: APIRequestContext): Promise<string> {
    const resp = await request.post('/api/auth/login', {
        data: { email: PM_EMAIL, password: TEST_PASSWORD },
    });
    expect(resp.ok(), `Login failed for ${PM_EMAIL} — HTTP ${resp.status()}`).toBeTruthy();
    const body = await resp.json();
    expect(body.session?.access_token, 'Login response missing access_token').toBeTruthy();
    return body.session.access_token;
}

/**
 * Discover a valid project ID from the system. Tries:
 * 1. Health endpoint → PostgREST dd_projects
 * 2. Falls back to null if no project found
 */
async function discoverProjectId(request: APIRequestContext, token: string): Promise<string | null> {
    // Try health endpoint to get Supabase URL and table counts
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
        {
            headers: {
                Authorization: `Bearer ${token}`,
                apikey: token,
            },
        },
    );

    if (!projectsResp.ok()) return null;

    const projects = await projectsResp.json();
    if (!Array.isArray(projects) || projects.length === 0) return null;

    return projects[0].id;
}

/**
 * Navigate with retry — handles Next.js dev-server cold-start 404 race.
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
 * Seed the browser's localStorage with the auth token so the app
 * treats the session as authenticated without going through the login UI.
 */
async function seedAuth(page: Page, request: APIRequestContext) {
    const token = await getAuthToken(request);
    await page.goto('/login', { waitUntil: 'domcontentloaded', timeout: 15_000 });
    await page.evaluate(
        ({ key, value }) => localStorage.setItem(key, value),
        { key: TOKEN_KEY, value: token },
    );
    return token;
}

/** Returns true if the console message should be treated as a real error. */
function isRealConsoleError(text: string): boolean {
    return !IGNORED_CONSOLE_PATTERNS.some((p) => text.includes(p));
}

/** Helper to build auth headers for API calls. */
function authHeaders(token: string) {
    return { Authorization: `Bearer ${token}` };
}

// ============================================================================
// Q&A API Tests — serial (state shared between tests)
// ============================================================================

test.describe('05 — Q&A Module', () => {
    test.describe.configure({ mode: 'serial' });

    // Shared state across serial tests
    let token: string;
    let projectId: string | null = null;
    let threadId: string;
    let threadNumber: number;
    let slaThreadId: string;
    let assignmentId: string;
    let contingencyLinkId: string;
    let docVersionLinkId: string;
    const testSubject = `E2E QA Thread ${Date.now()}`;
    const slaSubject = `E2E SLA Thread ${Date.now()}`;
    const filterSubject = `E2E Filter Thread ${Date.now()}`;

    // ------------------------------------------------------------------
    // Setup: authenticate and discover project
    // ------------------------------------------------------------------

    test('setup — authenticate and discover project', async ({ request }) => {
        token = await getAuthToken(request);
        expect(token, 'Auth token should be present').toBeTruthy();

        projectId = await discoverProjectId(request, token);
        if (!projectId) {
            console.warn('[05-qa] No project found — project-dependent tests will be skipped.');
        } else {
            console.log(`[05-qa] Using project: ${projectId}`);
        }
    });

    // ------------------------------------------------------------------
    // 5.1 Q&A page loads (browser test)
    // ------------------------------------------------------------------

    test('5.1 — Q&A page loads with thread list or empty state visible', async ({ page, request }) => {
        test.skip(!projectId, 'No project found — skipping browser test');

        await seedAuth(page, request);

        const errors: string[] = [];
        page.on('console', (msg) => {
            if (msg.type() === 'error') errors.push(msg.text());
        });

        await gotoWithRetry(page, `/projects/${projectId}/qa`);
        await page.waitForLoadState('networkidle');

        // The page should display the Q&A heading
        const heading = page.locator('h1');
        await expect(
            heading,
            'Q&A page should display the main heading',
        ).toBeVisible({ timeout: 10_000 });
        const headingText = await heading.textContent();
        expect(
            headingText,
            'Heading should contain Q&A text',
        ).toContain('Q&A');

        // Either thread list items or empty state message should be visible
        const threadListItem = page.locator('button:has-text("Q-")').first();
        const emptyState = page.locator('text=No hay hilos Q&A');
        const hasThreads = await threadListItem.isVisible().catch(() => false);
        const hasEmpty = await emptyState.isVisible().catch(() => false);
        expect(
            hasThreads || hasEmpty,
            'Q&A page should show either thread list items or the empty state message',
        ).toBe(true);

        // Check for real console errors
        const realErrors = errors.filter(isRealConsoleError);
        if (realErrors.length > 0) {
            console.log('Unfiltered console errors on Q&A page:', realErrors);
        }
        expect(realErrors.length, 'Q&A page should load without critical console errors').toBe(0);
    });

    // ------------------------------------------------------------------
    // 5.2 Create Q&A thread via API
    // ------------------------------------------------------------------

    test('5.2 — POST /api/qa/threads creates a new thread with thread_number and status=draft', async ({ request }) => {
        test.skip(!projectId, 'No project found — skipping');

        const resp = await request.post('/api/qa/threads', {
            headers: authHeaders(token),
            data: {
                project_id: projectId,
                subject: testSubject,
                priority: 'high',
                area_code: 'MERC',
                source: 'manual',
            },
        });

        expect(resp.ok(), `Create thread failed — HTTP ${resp.status()}`).toBeTruthy();

        const body = await resp.json();
        expect(body.success, 'Response should include success: true').toBe(true);
        expect(body.thread, 'Response should include the thread object').toBeTruthy();
        expect(body.thread.id, 'Thread should have an id').toBeTruthy();
        expect(body.thread.thread_number, 'Thread should have a thread_number assigned').toBeTruthy();
        expect(typeof body.thread.thread_number, 'thread_number should be a number').toBe('number');
        expect(body.thread.status, 'New thread status should be draft').toBe('draft');
        expect(body.thread.subject, 'Thread subject should match what was sent').toBe(testSubject);
        expect(body.thread.priority, 'Thread priority should match what was sent').toBe('high');
        expect(body.thread.area_code, 'Thread area_code should match what was sent').toBe('MERC');
        expect(body.thread.project_id, 'Thread project_id should match').toBe(projectId);

        // Save for downstream tests
        threadId = body.thread.id;
        threadNumber = body.thread.thread_number;
    });

    // ------------------------------------------------------------------
    // 5.3 Thread appears in list (API)
    // ------------------------------------------------------------------

    test('5.3 — GET /api/qa/threads returns the created thread in the list', async ({ request }) => {
        test.skip(!projectId, 'No project found — skipping');
        expect(threadId, 'threadId should have been set by test 5.2').toBeTruthy();

        const resp = await request.get(`/api/qa/threads?project_id=${projectId}`, {
            headers: authHeaders(token),
        });

        expect(resp.ok(), `List threads failed — HTTP ${resp.status()}`).toBeTruthy();

        const body = await resp.json();
        expect(body.success, 'Response should include success: true').toBe(true);
        expect(Array.isArray(body.threads), 'threads should be an array').toBe(true);

        const found = body.threads.find((t: { id: string }) => t.id === threadId);
        expect(found, `Thread with id ${threadId} should appear in the list`).toBeTruthy();
        expect(found.subject, 'Found thread subject should match').toBe(testSubject);
        expect(found.thread_number, 'Found thread should have the same thread_number').toBe(threadNumber);
    });

    // ------------------------------------------------------------------
    // 5.4 Send message in thread (advisor)
    // ------------------------------------------------------------------

    test('5.4 — POST message with sender_role=advisor saves content and role correctly', async ({ request }) => {
        test.skip(!projectId, 'No project found — skipping');
        expect(threadId, 'threadId should have been set by test 5.2').toBeTruthy();

        const messageContent = 'E2E test: advisor question about corporate structure.';

        const resp = await request.post(`/api/qa/threads/${threadId}/messages`, {
            headers: authHeaders(token),
            data: {
                content: messageContent,
                sender_role: 'advisor',
                is_internal: false,
            },
        });

        expect(resp.ok(), `Send advisor message failed — HTTP ${resp.status()}`).toBeTruthy();

        const body = await resp.json();
        expect(body.success, 'Response should include success: true').toBe(true);
        expect(body.message, 'Response should include the message object').toBeTruthy();
        expect(body.message.content, 'Message content should match').toBe(messageContent);
        expect(body.message.sender_role, 'sender_role should be advisor').toBe('advisor');
        expect(body.message.thread_id, 'Message thread_id should match the thread').toBe(threadId);
        expect(body.message.is_internal, 'is_internal should be false').toBe(false);

        // Verify the thread status was updated to 'sent' (advisor message auto-updates)
        const threadResp = await request.get(`/api/qa/threads/${threadId}`, {
            headers: authHeaders(token),
        });
        const threadBody = await threadResp.json();
        expect(
            threadBody.thread.status,
            'Thread status should transition to sent after advisor sends a message',
        ).toBe('sent');
    });

    // ------------------------------------------------------------------
    // 5.5 Reply as target
    // ------------------------------------------------------------------

    test('5.5 — POST message with sender_role=target saves message and updates thread status to answered', async ({ request }) => {
        test.skip(!projectId, 'No project found — skipping');
        expect(threadId, 'threadId should have been set by test 5.2').toBeTruthy();

        const targetReply = 'E2E test: target response with requested documentation.';

        const resp = await request.post(`/api/qa/threads/${threadId}/messages`, {
            headers: authHeaders(token),
            data: {
                content: targetReply,
                sender_role: 'target',
                is_internal: false,
            },
        });

        expect(resp.ok(), `Send target message failed — HTTP ${resp.status()}`).toBeTruthy();

        const body = await resp.json();
        expect(body.success, 'Response should include success: true').toBe(true);
        expect(body.message.content, 'Target message content should match').toBe(targetReply);
        expect(body.message.sender_role, 'sender_role should be target').toBe('target');

        // Verify the thread status was updated to 'answered' (target message auto-updates)
        const threadResp = await request.get(`/api/qa/threads/${threadId}`, {
            headers: authHeaders(token),
        });
        const threadBody = await threadResp.json();
        expect(
            threadBody.thread.status,
            'Thread status should transition to answered after target replies',
        ).toBe('answered');

        // Verify GET messages returns both messages
        expect(
            threadBody.messages.length,
            'Thread should have 2 messages (advisor + target)',
        ).toBeGreaterThanOrEqual(2);
    });

    // ------------------------------------------------------------------
    // 5.6 Full lifecycle: draft -> sent -> answered -> closed
    // ------------------------------------------------------------------

    test('5.6 — Full lifecycle: PATCH status transitions from draft through closed', async ({ request }) => {
        test.skip(!projectId, 'No project found — skipping');
        expect(threadId, 'threadId should have been set by test 5.2').toBeTruthy();

        // At this point the thread is 'answered' (from 5.5).
        // We'll transition: answered -> follow_up -> escalated -> closed

        // Step 1: answered -> follow_up
        const followUpResp = await request.patch(`/api/qa/threads/${threadId}`, {
            headers: authHeaders(token),
            data: { status: 'follow_up' },
        });
        expect(followUpResp.ok(), `PATCH to follow_up failed — HTTP ${followUpResp.status()}`).toBeTruthy();
        const followUpBody = await followUpResp.json();
        expect(followUpBody.success, 'follow_up update should succeed').toBe(true);
        expect(followUpBody.thread.status, 'Status should be follow_up').toBe('follow_up');

        // Step 2: follow_up -> escalated
        const escalatedResp = await request.patch(`/api/qa/threads/${threadId}`, {
            headers: authHeaders(token),
            data: { status: 'escalated' },
        });
        expect(escalatedResp.ok(), `PATCH to escalated failed — HTTP ${escalatedResp.status()}`).toBeTruthy();
        const escalatedBody = await escalatedResp.json();
        expect(escalatedBody.thread.status, 'Status should be escalated').toBe('escalated');

        // Step 3: escalated -> closed
        const closedResp = await request.patch(`/api/qa/threads/${threadId}`, {
            headers: authHeaders(token),
            data: { status: 'closed' },
        });
        expect(closedResp.ok(), `PATCH to closed failed — HTTP ${closedResp.status()}`).toBeTruthy();
        const closedBody = await closedResp.json();
        expect(closedBody.thread.status, 'Status should be closed').toBe('closed');

        // Final verification via GET
        const getResp = await request.get(`/api/qa/threads/${threadId}`, {
            headers: authHeaders(token),
        });
        const getBody = await getResp.json();
        expect(getBody.thread.status, 'Thread should ultimately be closed').toBe('closed');
    });

    // ------------------------------------------------------------------
    // 5.7 SLA tracking
    // ------------------------------------------------------------------

    test('5.7 — Create thread with sla_hours auto-creates qa_slas record', async ({ request }) => {
        test.skip(!projectId, 'No project found — skipping');

        const resp = await request.post('/api/qa/threads', {
            headers: authHeaders(token),
            data: {
                project_id: projectId,
                subject: slaSubject,
                priority: 'critical',
                sla_hours: 1,
            },
        });

        expect(resp.ok(), `Create SLA thread failed — HTTP ${resp.status()}`).toBeTruthy();

        const body = await resp.json();
        expect(body.success, 'Response should include success: true').toBe(true);
        expect(body.thread.sla_hours, 'Thread sla_hours should be 1').toBe(1);

        slaThreadId = body.thread.id;

        // Fetch thread detail to check SLA records
        const detailResp = await request.get(`/api/qa/threads/${slaThreadId}`, {
            headers: authHeaders(token),
        });
        const detailBody = await detailResp.json();
        expect(detailBody.success, 'Thread detail should succeed').toBe(true);
        expect(
            Array.isArray(detailBody.slas),
            'Thread detail should include slas array',
        ).toBe(true);
        expect(
            detailBody.slas.length,
            'SLA record should have been auto-created',
        ).toBeGreaterThanOrEqual(1);

        const slaRecord = detailBody.slas.find(
            (s: { thread_id: string; sla_type: string }) =>
                s.thread_id === slaThreadId && s.sla_type === 'response',
        );
        expect(slaRecord, 'Should find a response SLA record for this thread').toBeTruthy();
        expect(slaRecord.target_at, 'SLA should have a target_at timestamp').toBeTruthy();

        // Verify target_at is approximately 1 hour from now (within 5 min tolerance)
        const targetTime = new Date(slaRecord.target_at).getTime();
        const expectedTime = Date.now() + 1 * 3600 * 1000;
        const diffMinutes = Math.abs(targetTime - expectedTime) / (60 * 1000);
        expect(
            diffMinutes,
            `SLA target_at should be ~1 hour from now (diff: ${diffMinutes.toFixed(1)} min)`,
        ).toBeLessThan(5);
    });

    // ------------------------------------------------------------------
    // 5.8 Q&A assignment routing
    // ------------------------------------------------------------------

    test('5.8 — POST /api/qa/assignments creates assignment with default_assignee', async ({ request }) => {
        test.skip(!projectId, 'No project found — skipping');

        const resp = await request.post('/api/qa/assignments', {
            headers: authHeaders(token),
            data: {
                project_id: projectId,
                area_code: 'MERC',
                default_assignee: 'abogado.merc@test.ddlegal.com',
                sla_hours: 24,
                escalation_after_hours: 48,
            },
        });

        expect(resp.ok(), `Create assignment failed — HTTP ${resp.status()}`).toBeTruthy();

        const body = await resp.json();
        expect(body.success, 'Response should include success: true').toBe(true);
        expect(body.assignment, 'Response should include the assignment object').toBeTruthy();
        expect(body.assignment.project_id, 'Assignment project_id should match').toBe(projectId);
        expect(body.assignment.area_code, 'Assignment area_code should be MERC').toBe('MERC');
        expect(
            body.assignment.default_assignee,
            'default_assignee should match the email provided',
        ).toBe('abogado.merc@test.ddlegal.com');
        expect(body.assignment.sla_hours, 'sla_hours should be 24').toBe(24);

        assignmentId = body.assignment.id;

        // Verify via GET
        const listResp = await request.get(`/api/qa/assignments?project_id=${projectId}`, {
            headers: authHeaders(token),
        });
        const listBody = await listResp.json();
        expect(listBody.success, 'Assignments list should succeed').toBe(true);
        const found = listBody.assignments.find(
            (a: { id: string }) => a.id === assignmentId,
        );
        expect(found, 'Created assignment should appear in the list').toBeTruthy();
    });

    // ------------------------------------------------------------------
    // 5.9 Cross-link to contingency
    // ------------------------------------------------------------------

    test('5.9 — POST /api/qa/links creates cross-link to contingency entity', async ({ request }) => {
        test.skip(!projectId, 'No project found — skipping');
        expect(threadId, 'threadId should have been set by test 5.2').toBeTruthy();

        // Use a synthetic UUID for the contingency entity (testing API validation)
        const syntheticContingencyId = '00000000-0000-0000-0000-000000000099';

        const resp = await request.post('/api/qa/links', {
            headers: authHeaders(token),
            data: {
                thread_id: threadId,
                entity_type: 'contingency',
                entity_id: syntheticContingencyId,
                link_type: 'related',
            },
        });

        expect(resp.ok(), `Create contingency link failed — HTTP ${resp.status()}`).toBeTruthy();

        const body = await resp.json();
        expect(body.success, 'Response should include success: true').toBe(true);
        expect(body.link, 'Response should include the link object').toBeTruthy();
        expect(body.link.thread_id, 'Link thread_id should match').toBe(threadId);
        expect(body.link.entity_type, 'Link entity_type should be contingency').toBe('contingency');
        expect(body.link.entity_id, 'Link entity_id should match the synthetic UUID').toBe(syntheticContingencyId);
        expect(body.link.link_type, 'Link type should be related').toBe('related');

        contingencyLinkId = body.link.id;

        // Verify via thread detail
        const detailResp = await request.get(`/api/qa/threads/${threadId}`, {
            headers: authHeaders(token),
        });
        const detailBody = await detailResp.json();
        const foundLink = detailBody.links?.find(
            (l: { id: string }) => l.id === contingencyLinkId,
        );
        expect(foundLink, 'Contingency link should appear in thread detail links').toBeTruthy();
    });

    // ------------------------------------------------------------------
    // 5.10 Cross-link to document_version
    // ------------------------------------------------------------------

    test('5.10 — POST /api/qa/links creates cross-link to document_version entity', async ({ request }) => {
        test.skip(!projectId, 'No project found — skipping');
        expect(threadId, 'threadId should have been set by test 5.2').toBeTruthy();

        const syntheticDocVersionId = '00000000-0000-0000-0000-000000000088';

        const resp = await request.post('/api/qa/links', {
            headers: authHeaders(token),
            data: {
                thread_id: threadId,
                entity_type: 'document_version',
                entity_id: syntheticDocVersionId,
                link_type: 'caused_by',
            },
        });

        expect(resp.ok(), `Create document_version link failed — HTTP ${resp.status()}`).toBeTruthy();

        const body = await resp.json();
        expect(body.success, 'Response should include success: true').toBe(true);
        expect(body.link, 'Response should include the link object').toBeTruthy();
        expect(body.link.entity_type, 'Link entity_type should be document_version').toBe('document_version');
        expect(body.link.entity_id, 'Link entity_id should match the synthetic UUID').toBe(syntheticDocVersionId);
        expect(body.link.link_type, 'Link type should be caused_by').toBe('caused_by');

        docVersionLinkId = body.link.id;

        // Verify via thread detail
        const detailResp = await request.get(`/api/qa/threads/${threadId}`, {
            headers: authHeaders(token),
        });
        const detailBody = await detailResp.json();
        const foundLink = detailBody.links?.find(
            (l: { id: string }) => l.id === docVersionLinkId,
        );
        expect(foundLink, 'Document version link should appear in thread detail links').toBeTruthy();
    });

    // ------------------------------------------------------------------
    // 5.11 Filter by area_code
    // ------------------------------------------------------------------

    test('5.11 — GET /api/qa/threads?area_code=MERC returns only threads with that area', async ({ request }) => {
        test.skip(!projectId, 'No project found — skipping');

        // First, create an extra thread with a different area_code to ensure filtering works
        const otherAreaResp = await request.post('/api/qa/threads', {
            headers: authHeaders(token),
            data: {
                project_id: projectId,
                subject: `${filterSubject} — CONT area`,
                priority: 'low',
                area_code: 'CONT',
            },
        });
        expect(otherAreaResp.ok(), 'Creating CONT area thread should succeed').toBeTruthy();

        // Now filter by MERC
        const resp = await request.get(`/api/qa/threads?project_id=${projectId}&area_code=MERC`, {
            headers: authHeaders(token),
        });

        expect(resp.ok(), `Filter by area_code failed — HTTP ${resp.status()}`).toBeTruthy();

        const body = await resp.json();
        expect(body.success, 'Response should include success: true').toBe(true);
        expect(Array.isArray(body.threads), 'threads should be an array').toBe(true);

        // All returned threads must have area_code === 'MERC'
        for (const thread of body.threads) {
            expect(
                thread.area_code,
                `Thread ${thread.id} should have area_code=MERC but got ${thread.area_code}`,
            ).toBe('MERC');
        }

        // At least the thread from test 5.2 should be included
        expect(
            body.threads.length,
            'Should return at least 1 thread with area_code=MERC',
        ).toBeGreaterThanOrEqual(1);

        // The CONT thread should NOT be in the results
        const contThread = body.threads.find(
            (t: { subject: string }) => t.subject.includes('CONT area'),
        );
        expect(contThread, 'CONT area thread should NOT appear in MERC filtered results').toBeFalsy();
    });

    // ------------------------------------------------------------------
    // 5.12 Filter by status
    // ------------------------------------------------------------------

    test('5.12 — GET /api/qa/threads?status=closed returns only threads with that status', async ({ request }) => {
        test.skip(!projectId, 'No project found — skipping');

        // The thread from test 5.6 was closed. Create a new draft thread to ensure filtering.
        const draftResp = await request.post('/api/qa/threads', {
            headers: authHeaders(token),
            data: {
                project_id: projectId,
                subject: `${filterSubject} — draft for filter test`,
                priority: 'low',
            },
        });
        expect(draftResp.ok(), 'Creating draft thread should succeed').toBeTruthy();

        // Filter by status=closed
        const resp = await request.get(`/api/qa/threads?project_id=${projectId}&status=closed`, {
            headers: authHeaders(token),
        });

        expect(resp.ok(), `Filter by status failed — HTTP ${resp.status()}`).toBeTruthy();

        const body = await resp.json();
        expect(body.success, 'Response should include success: true').toBe(true);
        expect(Array.isArray(body.threads), 'threads should be an array').toBe(true);

        // All returned threads must have status === 'closed'
        for (const thread of body.threads) {
            expect(
                thread.status,
                `Thread ${thread.id} should have status=closed but got ${thread.status}`,
            ).toBe('closed');
        }

        // The thread closed in 5.6 should be among them
        const closedThread = body.threads.find(
            (t: { id: string }) => t.id === threadId,
        );
        expect(closedThread, 'The thread closed in test 5.6 should appear in closed filter results').toBeTruthy();

        // The draft thread should NOT be in the results
        const draftThread = body.threads.find(
            (t: { subject: string }) => t.subject.includes('draft for filter test'),
        );
        expect(draftThread, 'Draft thread should NOT appear in closed filtered results').toBeFalsy();
    });

    // ------------------------------------------------------------------
    // Bonus: SLA check endpoint
    // ------------------------------------------------------------------

    test('5.13 — GET /api/qa/sla/check returns SLA breach info for the project', async ({ request }) => {
        test.skip(!projectId, 'No project found — skipping');

        const resp = await request.get(`/api/qa/sla/check?project_id=${projectId}`, {
            headers: authHeaders(token),
        });

        expect(resp.ok(), `SLA check failed — HTTP ${resp.status()}`).toBeTruthy();

        const body = await resp.json();
        expect(body.success, 'Response should include success: true').toBe(true);
        expect(
            typeof body.breached_count,
            'breached_count should be a number',
        ).toBe('number');
        expect(
            Array.isArray(body.breached_slas),
            'breached_slas should be an array',
        ).toBe(true);
    });

    // ------------------------------------------------------------------
    // Bonus: DELETE cross-link cleanup
    // ------------------------------------------------------------------

    test('5.14 — DELETE /api/qa/links removes a cross-link', async ({ request }) => {
        test.skip(!projectId, 'No project found — skipping');
        test.skip(!contingencyLinkId, 'No link to delete — skipping');

        const resp = await request.delete(`/api/qa/links?id=${contingencyLinkId}`, {
            headers: authHeaders(token),
        });

        expect(resp.ok(), `Delete link failed — HTTP ${resp.status()}`).toBeTruthy();

        const body = await resp.json();
        expect(body.success, 'Delete should return success: true').toBe(true);

        // Verify the link is gone from thread detail
        const detailResp = await request.get(`/api/qa/threads/${threadId}`, {
            headers: authHeaders(token),
        });
        const detailBody = await detailResp.json();
        const removedLink = detailBody.links?.find(
            (l: { id: string }) => l.id === contingencyLinkId,
        );
        expect(removedLink, 'Deleted link should no longer appear in thread detail').toBeFalsy();
    });

    // ------------------------------------------------------------------
    // Bonus: API validation — missing required fields
    // ------------------------------------------------------------------

    test('5.15 — POST /api/qa/threads returns 400 when project_id is missing', async ({ request }) => {
        const resp = await request.post('/api/qa/threads', {
            headers: authHeaders(token),
            data: { subject: 'Missing project_id' },
        });

        expect(resp.status(), 'Should return 400 for missing project_id').toBe(400);
        const body = await resp.json();
        expect(body.error, 'Error message should be present').toBeTruthy();
    });

    test('5.16 — POST /api/qa/threads returns 400 when subject is missing', async ({ request }) => {
        test.skip(!projectId, 'No project found — skipping');

        const resp = await request.post('/api/qa/threads', {
            headers: authHeaders(token),
            data: { project_id: projectId },
        });

        expect(resp.status(), 'Should return 400 for missing subject').toBe(400);
        const body = await resp.json();
        expect(body.error, 'Error message should be present').toBeTruthy();
    });

    test('5.17 — GET /api/qa/threads returns 400 when project_id is missing', async ({ request }) => {
        const resp = await request.get('/api/qa/threads', {
            headers: authHeaders(token),
        });

        expect(resp.status(), 'Should return 400 for missing project_id query param').toBe(400);
        const body = await resp.json();
        expect(body.error, 'Error message should be present').toBeTruthy();
    });

    test('5.18 — POST /api/qa/threads/[id]/messages returns 400 when content is missing', async ({ request }) => {
        test.skip(!projectId, 'No project found — skipping');
        test.skip(!slaThreadId, 'No SLA thread — skipping');

        const resp = await request.post(`/api/qa/threads/${slaThreadId}/messages`, {
            headers: authHeaders(token),
            data: { sender_role: 'advisor' },
        });

        // The API requires both sender_role and content
        expect(resp.status(), 'Should return 400 for missing content').toBe(400);
        const body = await resp.json();
        expect(body.error, 'Error message should be present').toBeTruthy();
    });

    test('5.19 — POST /api/qa/assignments returns 400 when area_code is missing', async ({ request }) => {
        test.skip(!projectId, 'No project found — skipping');

        const resp = await request.post('/api/qa/assignments', {
            headers: authHeaders(token),
            data: { project_id: projectId },
        });

        expect(resp.status(), 'Should return 400 for missing area_code').toBe(400);
        const body = await resp.json();
        expect(body.error, 'Error message should be present').toBeTruthy();
    });

    test('5.20 — POST /api/qa/links returns 400 when required fields are missing', async ({ request }) => {
        const resp = await request.post('/api/qa/links', {
            headers: authHeaders(token),
            data: { thread_id: 'some-id' },
        });

        expect(resp.status(), 'Should return 400 for missing entity_type and entity_id').toBe(400);
        const body = await resp.json();
        expect(body.error, 'Error message should be present').toBeTruthy();
    });
});
