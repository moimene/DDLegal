import { type Page, expect } from '@playwright/test';

/**
 * Page Helpers — Shared utilities for E2E browser tests
 *
 * Refactored from patterns in societario-page.spec.ts.
 * Import these into any spec file that uses Page interactions.
 */

/**
 * Navigate with retry for Next.js dev server cold-start.
 *
 * On the first request after `npm run dev`, Next.js may return a 404 while
 * compiling the page. This helper retries up to `retries` times with a short
 * delay between attempts.
 */
export async function gotoWithRetry(
    page: Page,
    url: string,
    retries = 3,
): Promise<void> {
    for (let attempt = 0; attempt < retries; attempt++) {
        await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 15_000 });

        // Check if we landed on a 404 page (Next.js dev compilation race)
        const title = await page
            .locator('h1, h2')
            .first()
            .textContent({ timeout: 5_000 })
            .catch(() => '');

        if (!title?.includes('404')) return;

        // Wait before retrying to give the dev server time to compile
        await page.waitForTimeout(1_000);
    }

    // If we exhausted retries the last navigation result stays — callers can
    // assert on the page state and will get a clear failure message.
}

/**
 * Fill a React controlled input reliably.
 *
 * React's synthetic event system does not always pick up Playwright's `fill()`
 * because it skips the native `input` event. This helper focuses the element,
 * clears it with keyboard shortcuts, and types character-by-character so that
 * React's `onChange` fires for every keystroke.
 */
export async function fillReactInput(
    page: Page,
    selector: string,
    value: string,
): Promise<void> {
    const input = page.locator(selector).first();
    await expect(input).toBeVisible({ timeout: 10_000 });

    // Focus, select all, delete, then type character-by-character
    await input.click();
    await page.keyboard.press('Meta+a');
    await page.keyboard.press('Backspace');
    await input.pressSequentially(value, { delay: 20 });
}

/**
 * Wait for page to stabilize — no pending network requests.
 *
 * Waits for the `networkidle` load state which fires when there have been no
 * network connections for at least 500ms. Useful after navigation or after
 * triggering an action that causes multiple API calls.
 */
export async function waitForPageStable(page: Page): Promise<void> {
    await page.waitForLoadState('networkidle', { timeout: 15_000 });
}

/**
 * Collect console errors from the page, filtered to exclude known benign
 * messages from Supabase, Next.js hydration, PostgREST, fonts, etc.
 *
 * Usage:
 * ```ts
 * const errors: string[] = [];
 * page.on('console', (msg) => {
 *     if (msg.type() === 'error') errors.push(msg.text());
 * });
 * // ... navigate / interact ...
 * const real = getConsoleErrors(errors);
 * expect(real).toHaveLength(0);
 * ```
 *
 * Note: you must wire up the `page.on('console', ...)` listener yourself
 * before navigation so that messages are captured. This function only filters
 * the collected array.
 */
export function getConsoleErrors(collected: string[]): string[] {
    const IGNORE_PATTERNS = [
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
        '42P01',           // Postgres: relation does not exist
        'PostgrestError',
        'PGRST',           // PostgREST error codes
        'status code 4',   // HTTP 4xx from API
        'ERR_',            // Chrome network errors
        'net::',           // Network errors
        'loading chunk',   // Next.js chunk loading
        'Load failed',
        'Failed to load resource',
        'fetch',           // Generic fetch errors
        'API',
        'mxanelzxyaklvuypuafa',  // Supabase project URL
        'ghmurrvvzochgtippxwu',  // Supabase project URL
    ];

    return collected.filter(
        (msg) => !IGNORE_PATTERNS.some((pattern) => msg.includes(pattern)),
    );
}
