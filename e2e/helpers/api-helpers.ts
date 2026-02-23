import { type APIRequestContext, type APIResponse } from '@playwright/test';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import os from 'node:os';

/**
 * API Helpers — Wrappers for authenticated API calls in E2E tests
 *
 * All requests are sent to the baseURL configured in playwright.config.ts
 * (http://localhost:3000). Playwright's `request` fixture automatically
 * prepends the baseURL for relative paths.
 */

// ---------------------------------------------------------------------------
// Constants — mirror the values from /api/auth/setup-test-users
// ---------------------------------------------------------------------------

export const TEST_PASSWORD = 'test123456';

export const TEST_USERS = {
    clo: 'clo@test.ddlegal.com',
    pm: 'pm@test.ddlegal.com',
    abogado_merc: 'abogado.merc@test.ddlegal.com',
    sponsor: 'sponsor@test.ddlegal.com',
    target: 'target@test.ddlegal.com',
    stakeholder: 'stakeholder@test.ddlegal.com',
    cliente: 'cliente@test.ddlegal.com',
} as const;

export type TestUserKey = keyof typeof TEST_USERS;

// Cache auth tokens across workers to avoid hammering /api/auth/login.
const TOKEN_CACHE_FILE = path.join(os.tmpdir(), 'dd-legal-pmo-e2e-auth-cache.json');
const TOKEN_SKEW_MS = 60_000;
const MAX_LOGIN_RETRIES = 5;

type TokenCacheEntry = {
    accessToken: string;
    expiresAtMs: number;
};

const memoryTokenCache = new Map<string, TokenCacheEntry>();

function cacheKey(email: string): string {
    return email.trim().toLowerCase().replace(/[^a-z0-9_.-]/g, '_');
}

function isTokenFresh(entry: TokenCacheEntry | undefined): entry is TokenCacheEntry {
    if (!entry) return false;
    return entry.expiresAtMs - TOKEN_SKEW_MS > Date.now();
}

function isRetryableLoginFailure(status: number, bodyText: string): boolean {
    if (status === 429 || status === 503) return true;
    if (status === 401 && /rate\s*limit/i.test(bodyText)) return true;
    return false;
}

async function sleep(ms: number): Promise<void> {
    await new Promise((resolve) => setTimeout(resolve, ms));
}

async function readTokenCacheFile(): Promise<Record<string, TokenCacheEntry>> {
    try {
        const raw = await fs.readFile(TOKEN_CACHE_FILE, 'utf8');
        const parsed = JSON.parse(raw) as Record<string, TokenCacheEntry>;
        if (!parsed || typeof parsed !== 'object') return {};
        return parsed;
    } catch {
        return {};
    }
}

async function writeTokenCacheFile(cache: Record<string, TokenCacheEntry>): Promise<void> {
    try {
        await fs.mkdir(path.dirname(TOKEN_CACHE_FILE), { recursive: true });
        await fs.writeFile(TOKEN_CACHE_FILE, JSON.stringify(cache), 'utf8');
    } catch {
        // Best effort only; in-memory cache still helps.
    }
}

async function getCachedToken(email: string): Promise<string | null> {
    const key = cacheKey(email);
    const inMemory = memoryTokenCache.get(key);
    if (isTokenFresh(inMemory)) {
        return inMemory.accessToken;
    }

    const diskCache = await readTokenCacheFile();
    const onDisk = diskCache[key];
    if (isTokenFresh(onDisk)) {
        memoryTokenCache.set(key, onDisk);
        return onDisk.accessToken;
    }

    return null;
}

async function setCachedToken(
    email: string,
    accessToken: string,
    expiresAtUnixSeconds: number | null | undefined,
): Promise<void> {
    const expiresAtMs = typeof expiresAtUnixSeconds === 'number' && Number.isFinite(expiresAtUnixSeconds)
        ? expiresAtUnixSeconds * 1000
        : Date.now() + 30 * 60_000;

    const entry: TokenCacheEntry = { accessToken, expiresAtMs };
    const key = cacheKey(email);
    memoryTokenCache.set(key, entry);

    const diskCache = await readTokenCacheFile();
    diskCache[key] = entry;
    await writeTokenCacheFile(diskCache);
}

async function withEmailLoginLock(
    email: string,
    run: () => Promise<string>,
): Promise<string> {
    const key = cacheKey(email);
    const lockFile = `${TOKEN_CACHE_FILE}.${key}.lock`;
    const timeoutMs = 15_000;
    const started = Date.now();

    while (Date.now() - started < timeoutMs) {
        try {
            const lock = await fs.open(lockFile, 'wx');
            try {
                return await run();
            } finally {
                await lock.close().catch(() => {});
                await fs.unlink(lockFile).catch(() => {});
            }
        } catch (error) {
            const code = (error as NodeJS.ErrnoException).code;
            if (code !== 'EEXIST') break;

            const cached = await getCachedToken(email);
            if (cached) return cached;
            await sleep(150);
        }
    }

    return run();
}

// ---------------------------------------------------------------------------
// Authentication helpers
// ---------------------------------------------------------------------------

/**
 * Login as a test user and return the access token.
 *
 * Calls `POST /api/auth/login` with the given email and the shared test
 * password. Throws with a clear message if the login fails (e.g. if test
 * users have not been seeded yet).
 */
export async function loginAs(
    request: APIRequestContext,
    email: string,
): Promise<string> {
    const cached = await getCachedToken(email);
    if (cached) return cached;

    return withEmailLoginLock(email, async () => {
        const cachedInsideLock = await getCachedToken(email);
        if (cachedInsideLock) return cachedInsideLock;

        let lastFailure = '<unknown>';

        for (let attempt = 1; attempt <= MAX_LOGIN_RETRIES; attempt += 1) {
            const resp = await request.post('/api/auth/login', {
                data: { email, password: TEST_PASSWORD },
            });

            if (resp.ok()) {
                const body = await resp.json();

                if (!body.success || !body.session?.access_token) {
                    throw new Error(
                        `loginAs(${email}) returned unexpected body: ${JSON.stringify(body)}`,
                    );
                }

                await setCachedToken(email, body.session.access_token, body.session.expires_at);
                return body.session.access_token;
            }

            const bodyText = await resp.text().catch(() => '<no body>');
            lastFailure = `status ${resp.status()}: ${bodyText}`;

            if (!isRetryableLoginFailure(resp.status(), bodyText) || attempt === MAX_LOGIN_RETRIES) {
                break;
            }

            const backoffMs = 250 * (2 ** (attempt - 1));
            await sleep(backoffMs);
        }

        throw new Error(
            `loginAs(${email}) failed with ${lastFailure}. ` +
            'Have you seeded test users with setupTestUsers()?',
        );
    });
}

/**
 * Convenience: login as a named test user (e.g. 'pm', 'clo', 'cliente').
 */
export async function loginAsRole(
    request: APIRequestContext,
    role: TestUserKey,
): Promise<string> {
    return loginAs(request, TEST_USERS[role]);
}

// ---------------------------------------------------------------------------
// Authenticated request helpers
// ---------------------------------------------------------------------------

/**
 * Make an authenticated GET request.
 *
 * Attaches `Authorization: Bearer <token>` to the request headers.
 */
export async function authGet(
    request: APIRequestContext,
    url: string,
    token: string,
): Promise<APIResponse> {
    return request.get(url, {
        headers: { Authorization: `Bearer ${token}` },
    });
}

/**
 * Make an authenticated POST request.
 *
 * Attaches `Authorization: Bearer <token>` and sends `body` as JSON.
 */
export async function authPost(
    request: APIRequestContext,
    url: string,
    token: string,
    body: unknown,
): Promise<APIResponse> {
    return request.post(url, {
        headers: { Authorization: `Bearer ${token}` },
        data: body,
    });
}

/**
 * Make an authenticated PATCH request.
 *
 * Attaches `Authorization: Bearer <token>` and sends `body` as JSON.
 */
export async function authPatch(
    request: APIRequestContext,
    url: string,
    token: string,
    body: unknown,
): Promise<APIResponse> {
    return request.patch(url, {
        headers: { Authorization: `Bearer ${token}` },
        data: body,
    });
}

/**
 * Make an authenticated DELETE request.
 *
 * Attaches `Authorization: Bearer <token>`.
 */
export async function authDelete(
    request: APIRequestContext,
    url: string,
    token: string,
): Promise<APIResponse> {
    return request.delete(url, {
        headers: { Authorization: `Bearer ${token}` },
    });
}

// ---------------------------------------------------------------------------
// Setup helpers
// ---------------------------------------------------------------------------

/**
 * Seed test users via `POST /api/auth/setup-test-users`.
 *
 * This endpoint is idempotent: it creates users only if they do not already
 * exist. Optionally pass a `projectId` to also assign project roles.
 *
 * Throws if the endpoint returns an error (e.g. in production mode).
 */
export async function setupTestUsers(
    request: APIRequestContext,
    projectId?: string,
): Promise<void> {
    const resp = await request.post('/api/auth/setup-test-users', {
        data: projectId ? { project_id: projectId } : {},
    });

    if (!resp.ok()) {
        const body = await resp.text().catch(() => '<no body>');
        throw new Error(
            `setupTestUsers() failed with status ${resp.status()}: ${body}`,
        );
    }

    const body = await resp.json();

    if (!body.success) {
        throw new Error(
            `setupTestUsers() returned unsuccessful: ${JSON.stringify(body)}`,
        );
    }
}
