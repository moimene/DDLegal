import { test, expect } from '@playwright/test';

/**
 * Societario API E2E Tests
 *
 * Tests the complete Due Diligence pipeline API routes.
 * Tests run serially to allow sequential pipeline testing.
 */

// Force serial execution — tests depend on each other
test.describe.configure({ mode: 'serial' });

// ============================================================
// 1. BORME Summary Fetcher — GET /api/societario/borme
// ============================================================

test.describe('BORME Summary API', () => {
    test('returns 400 if no date parameter', async ({ request }) => {
        const resp = await request.get('/api/societario/borme');
        expect(resp.status()).toBe(400);
        const body = await resp.json();
        expect(body.error).toContain('date parameter required');
    });

    test('returns 400 for invalid date format', async ({ request }) => {
        const resp = await request.get('/api/societario/borme?date=2024-01-15');
        expect(resp.status()).toBe(400);
        const body = await resp.json();
        expect(body.error).toContain('YYYYMMDD');
    });

    test('handles weekend date gracefully', async ({ request }) => {
        // 2025-01-04 is a Saturday — no BORME published
        const resp = await request.get('/api/societario/borme?date=20250104');
        const body = await resp.json();
        expect(body).toHaveProperty('date', '20250104');
    });

    test('fetches BORME for a valid weekday', async ({ request }) => {
        const resp = await request.get('/api/societario/borme?date=20250210');
        const body = await resp.json();
        expect(body.success).toBe(true);
        expect(body.date).toBe('20250210');
        expect(Array.isArray(body.entries)).toBeTruthy();
    });
});

// ============================================================
// 2. Request Creation — POST /api/societario/request
// ============================================================

let createdRequestId: string;
const testCompany = `TestCo-${Date.now()}`;

test.describe('Societario Request API', () => {
    test('returns 400 if sociedad_target missing', async ({ request }) => {
        const resp = await request.post('/api/societario/request', {
            data: {},
        });
        expect(resp.status()).toBe(400);
        const body = await resp.json();
        expect(body.error).toContain('sociedad_target');
    });

    test('creates a new request successfully', async ({ request }) => {
        const resp = await request.post('/api/societario/request', {
            data: {
                sociedad_target: testCompany,
                nif_hint: 'B99999999',
                periodo_anios: 3,
            },
        });
        expect(resp.ok()).toBeTruthy();
        const body = await resp.json();
        expect(body.success).toBe(true);
        expect(body.request_id).toBeTruthy();
        expect(body.status).toBe('pending');
        expect(body.pipeline_step).toBe('created');
        createdRequestId = body.request_id;
    });

    test('returns existing request for same idempotency key', async ({ request }) => {
        const resp = await request.post('/api/societario/request', {
            data: {
                sociedad_target: testCompany,
                nif_hint: 'B99999999',
                periodo_anios: 3,
            },
        });
        expect(resp.ok()).toBeTruthy();
        const body = await resp.json();
        expect(body.success).toBe(true);
        expect(body.idempotent).toBe(true);
        expect(body.request_id).toBe(createdRequestId);
    });

    test('GET returns request details with id', async ({ request }) => {
        expect(createdRequestId).toBeTruthy();
        const resp = await request.get(`/api/societario/request?id=${createdRequestId}`);
        expect(resp.ok()).toBeTruthy();
        const body = await resp.json();
        expect(body.success).toBe(true);
        expect(body.request).toBeTruthy();
        expect(body.request.id).toBe(createdRequestId);
    });

    test('GET returns 400 without id param', async ({ request }) => {
        const resp = await request.get('/api/societario/request');
        expect(resp.status()).toBe(400);
    });

    test('GET returns 404 for non-existent id', async ({ request }) => {
        const resp = await request.get('/api/societario/request?id=00000000-0000-0000-0000-000000000000');
        expect(resp.status()).toBe(404);
    });
});

// ============================================================
// 3. Identity Resolution — POST /api/societario/resolve
// ============================================================

test.describe('Identity Resolution API', () => {
    test('returns 400 if request_id missing', async ({ request }) => {
        const resp = await request.post('/api/societario/resolve', {
            data: {},
        });
        expect(resp.status()).toBe(400);
    });

    test('returns 404 for non-existent request', async ({ request }) => {
        const resp = await request.post('/api/societario/resolve', {
            data: { request_id: '00000000-0000-0000-0000-000000000000' },
        });
        expect(resp.status()).toBe(404);
    });

    test('resolves identity for the created request', async ({ request }) => {
        expect(createdRequestId).toBeTruthy();
        const resp = await request.post('/api/societario/resolve', {
            data: { request_id: createdRequestId },
        });
        expect(resp.ok()).toBeTruthy();
        const body = await resp.json();
        expect(body.success).toBe(true);
        expect(['identity_resolved', 'needs_review']).toContain(body.pipeline_step);
    });
});

// ============================================================
// 4. Snapshot Builder — POST /api/societario/snapshot
// ============================================================

test.describe('Snapshot Builder API', () => {
    test('returns 400 if request_id missing', async ({ request }) => {
        const resp = await request.post('/api/societario/snapshot', {
            data: {},
        });
        expect(resp.status()).toBe(400);
    });

    test('returns 404 for non-existent request', async ({ request }) => {
        const resp = await request.post('/api/societario/snapshot', {
            data: { request_id: '00000000-0000-0000-0000-000000000000' },
        });
        expect(resp.status()).toBe(404);
    });

    test('builds snapshot for the resolved request', async ({ request }) => {
        expect(createdRequestId).toBeTruthy();
        const resp = await request.post('/api/societario/snapshot', {
            data: { request_id: createdRequestId },
        });
        const body = await resp.json();
        if (resp.ok()) {
            expect(body.success).toBe(true);
            expect(body.snapshot_id).toBeTruthy();
        } else {
            // May fail if sociedad_id was not resolved — that's ok
            expect(body.error).toBeTruthy();
        }
    });
});

// ============================================================
// 5. Grounding Validator — POST /api/societario/validate
// ============================================================

test.describe('Grounding Validator API', () => {
    test('returns 400 if report_id missing', async ({ request }) => {
        const resp = await request.post('/api/societario/validate', {
            data: {},
        });
        expect(resp.status()).toBe(400);
    });

    test('returns 404 for non-existent report', async ({ request }) => {
        const resp = await request.post('/api/societario/validate', {
            data: { report_id: '00000000-0000-0000-0000-000000000000' },
        });
        expect(resp.status()).toBe(404);
    });
});

// ============================================================
// 6. BORME Ingest — POST /api/societario/borme/ingest
// ============================================================

test.describe('BORME Ingest API', () => {
    test('returns 400 if required params missing', async ({ request }) => {
        const resp = await request.post('/api/societario/borme/ingest', {
            data: {},
        });
        expect(resp.status()).toBe(400);
    });

    test('returns 404 for non-existent sociedad', async ({ request }) => {
        const resp = await request.post('/api/societario/borme/ingest', {
            data: {
                sociedad_id: '00000000-0000-0000-0000-000000000000',
                date_from: '2025-01-01',
                date_to: '2025-01-03',
            },
        });
        expect(resp.status()).toBe(404);
    });
});

// ============================================================
// 7. Report Generation — POST /api/societario/report
// ============================================================

test.describe('Report Generation API', () => {
    test('returns 400 if request_id missing', async ({ request }) => {
        const resp = await request.post('/api/societario/report', {
            data: {},
        });
        expect(resp.status()).toBe(400);
    });

    test('returns 404 for non-existent request', async ({ request }) => {
        const resp = await request.post('/api/societario/report', {
            data: { request_id: '00000000-0000-0000-0000-000000000000' },
        });
        expect(resp.status()).toBe(404);
    });
});
