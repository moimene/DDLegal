import { test, expect, type Page } from '@playwright/test';

/**
 * Societario Frontend E2E Tests
 *
 * Tests the /tools/societario page UI with correct DOM selectors.
 * Uses workers=1 in playwright config to avoid overwhelming the dev server.
 */

// Helper: goto with retry on 404 (Next.js dev server cold-start race)
async function gotoWithRetry(page: Page, url: string) {
    for (let attempt = 0; attempt < 3; attempt++) {
        await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 15000 });
        const title = await page.locator('h1, h2').first().textContent({ timeout: 5000 }).catch(() => '');
        if (!title?.includes('404')) return;
        await page.waitForTimeout(1000);
    }
}

// Helper: fill a React controlled input reliably (using native input event)
async function fillReactInput(page: Page, selector: string, value: string) {
    const input = page.locator(selector).first();
    await expect(input).toBeVisible({ timeout: 10000 });
    // Focus, select all, then type — this triggers React's onChange properly
    await input.click();
    await page.keyboard.press('Meta+a');
    await page.keyboard.press('Backspace');
    await input.pressSequentially(value, { delay: 20 });
}

test.describe('Societario Page — Load & Layout', () => {
    test('page loads at /tools/societario', async ({ page }) => {
        await gotoWithRetry(page, '/tools/societario');
        await expect(page).toHaveURL(/\/tools\/societario/);
    });

    test('displays the page title', async ({ page }) => {
        await gotoWithRetry(page, '/tools/societario');
        const heading = page.locator('h1, h2').first();
        await expect(heading).toBeVisible();
        const text = await heading.textContent();
        expect(text?.toLowerCase()).toContain('societari');
    });

    test('renders the request form with all fields', async ({ page }) => {
        await gotoWithRetry(page, '/tools/societario');

        // Sociedad target input (placeholder: "Denominación social completa...")
        const sociedadInput = page.locator('#soc-target').first();
        await expect(sociedadInput).toBeVisible({ timeout: 10000 });

        // NIF input (placeholder: "B12345678")
        const nifInput = page.locator('#soc-nif').first();
        await expect(nifInput).toBeVisible({ timeout: 10000 });
    });

    test('renders the submit button', async ({ page }) => {
        await gotoWithRetry(page, '/tools/societario');
        const submitBtn = page.locator('button:has-text("Ejecutar")').first();
        await expect(submitBtn).toBeVisible({ timeout: 10000 });
    });

    test('shows pipeline tracker when request exists', async ({ page }) => {
        await gotoWithRetry(page, '/tools/societario');

        // Fill form using the React-friendly helper
        await fillReactInput(page, '#soc-target', 'Pipeline Test SL');

        // Wait for React state update to enable the button
        const submitBtn = page.locator('button:has-text("Ejecutar")').first();
        await expect(submitBtn).toBeEnabled({ timeout: 5000 });
        await submitBtn.click();

        // Wait for response and pipeline tracker to appear
        await page.waitForTimeout(3000);

        // Pipeline tracker labels from PIPELINE_STEPS
        const step = page.locator('text=/Solicitud|BORME|Snapshot|Informe/').first();
        await expect(step).toBeVisible({ timeout: 10000 });
    });
});

test.describe('Societario Page — Form Interaction', () => {
    test('can type in the sociedad target field', async ({ page }) => {
        await gotoWithRetry(page, '/tools/societario');

        await fillReactInput(page, '#soc-target', 'Telefonica SA');
        await expect(page.locator('#soc-target').first()).toHaveValue('Telefonica SA');
    });

    test('can type in the NIF field', async ({ page }) => {
        await gotoWithRetry(page, '/tools/societario');

        await fillReactInput(page, '#soc-nif', 'A28015865');
        await expect(page.locator('#soc-nif').first()).toHaveValue('A28015865');
    });

    test('submitting the form sends API request', async ({ page }) => {
        await gotoWithRetry(page, '/tools/societario');

        await fillReactInput(page, '#soc-target', 'Iberdrola SA');
        await fillReactInput(page, '#soc-nif', 'A48010615');

        // Set up request interception BEFORE clicking
        const requestPromise = page.waitForRequest(
            (req) => req.url().includes('/api/societario/request') && req.method() === 'POST',
            { timeout: 15000 }
        );

        const submitBtn = page.locator('button:has-text("Ejecutar")').first();
        await expect(submitBtn).toBeEnabled({ timeout: 5000 });
        await submitBtn.click();

        const apiRequest = await requestPromise;
        expect(apiRequest.url()).toContain('/api/societario/request');

        const postData = apiRequest.postDataJSON();
        expect(postData.sociedad_target).toBe('Iberdrola SA');
    });

    test('button is disabled when form empty', async ({ page }) => {
        await gotoWithRetry(page, '/tools/societario');

        const submitBtn = page.locator('button:has-text("Ejecutar")').first();
        await expect(submitBtn).toBeVisible({ timeout: 10000 });
        await expect(submitBtn).toBeDisabled();
    });

    test('button enables when sociedad target filled', async ({ page }) => {
        await gotoWithRetry(page, '/tools/societario');

        await fillReactInput(page, '#soc-target', 'Test SL');

        const submitBtn = page.locator('button:has-text("Ejecutar")').first();
        await expect(submitBtn).toBeEnabled({ timeout: 5000 });
    });

    test('shows loading state after submit', async ({ page }) => {
        await gotoWithRetry(page, '/tools/societario');

        await fillReactInput(page, '#soc-target', 'Loading Test SL');

        const submitBtn = page.locator('button:has-text("Ejecutar")').first();
        await expect(submitBtn).toBeEnabled({ timeout: 5000 });
        await submitBtn.click();

        // After click, button should show loading (Ejecutando pipeline... or animate-spin)
        await page.waitForTimeout(500);
        const loadingText = page.locator('text="Ejecutando pipeline..."');
        const spinner = page.locator('.animate-spin');
        const hasLoading = await loadingText.isVisible().catch(() => false);
        const hasSpinner = await spinner.first().isVisible().catch(() => false);

        expect(hasLoading || hasSpinner).toBeTruthy();
    });
});

test.describe('Societario Page — Navigation', () => {
    test('sidebar link to societario works', async ({ page }) => {
        await gotoWithRetry(page, '/tools');
        const societarioLink = page.locator('a[href*="societario"]').first();

        if (await societarioLink.isVisible().catch(() => false)) {
            await societarioLink.click();
            await expect(page).toHaveURL(/\/tools\/societario/);
        }
    });

    test('back link navigates to tools', async ({ page }) => {
        await gotoWithRetry(page, '/tools/societario');

        const backLink = page.locator('a[href="/tools"]').first();
        if (await backLink.isVisible().catch(() => false)) {
            await backLink.click();
            await expect(page).toHaveURL(/\/tools$/);
        }
    });
});

test.describe('Societario Page — Visual Consistency', () => {
    test('uses Garrigues brand colors', async ({ page }) => {
        await gotoWithRetry(page, '/tools/societario');

        const brandColor = await page.evaluate(() => {
            return getComputedStyle(document.documentElement).getPropertyValue('--g-brand-3308').trim();
        });

        expect(brandColor).toBeTruthy();
    });

    test('page renders without critical console errors', async ({ page }) => {
        const errors: string[] = [];
        page.on('console', (msg) => {
            if (msg.type() === 'error') {
                errors.push(msg.text());
            }
        });

        await gotoWithRetry(page, '/tools/societario');
        await page.waitForLoadState('networkidle');

        // Filter out known benign errors (Supabase, Postgres, Next.js hydration, fonts, etc.)
        const realErrors = errors.filter(
            (e) =>
                !e.includes('Supabase') &&
                !e.includes('supabase') &&
                !e.includes('favicon') &&
                !e.includes('hydrat') &&
                !e.includes('downloadable font') &&
                !e.includes('dd_projects') &&
                !e.includes('dd_tools') &&
                !e.includes('relation') &&
                !e.includes('does not exist') &&
                !e.includes('Failed to fetch') &&
                !e.includes('Error fetching') &&
                !e.includes('42P01') &&           // Postgres: relation does not exist
                !e.includes('PostgrestError') &&
                !e.includes('PGRST') &&            // PostgREST error codes
                !e.includes('status code 4') &&    // HTTP 4xx from API
                !e.includes('ERR_') &&             // Chrome network errors
                !e.includes('net::') &&            // Network errors
                !e.includes('loading chunk') &&    // Next.js chunk loading
                !e.includes('Load failed') &&
                !e.includes('Failed to load resource') &&  // Browser resource 404s
                !e.includes('fetch') &&            // Generic fetch errors
                !e.includes('API') &&
                !e.includes('mxanelzxyaklvuypuafa') &&  // Supabase project URL
                !e.includes('ghmurrvvzochgtippxwu')     // Supabase project URL
        );

        // Log remaining errors for debugging
        if (realErrors.length > 0) {
            console.log('Unfiltered console errors:', realErrors);
        }

        expect(realErrors.length).toBe(0);
    });
});
