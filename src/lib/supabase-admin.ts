import { createClient, SupabaseClient } from '@supabase/supabase-js';

/**
 * Creates a fresh Supabase admin client for each request.
 * This avoids potential caching/state issues with singleton clients.
 */
export function getSupabaseAdmin(): SupabaseClient {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!url) {
        throw new Error('Missing NEXT_PUBLIC_SUPABASE_URL environment variable.');
    }

    if (!key) {
        throw new Error(
            'Missing SUPABASE_SERVICE_ROLE_KEY. This is required for server-side operations. ' +
            'Add it to .env.local (get from Supabase Dashboard > Settings > API > service_role key).'
        );
    }

    return createClient(url, key, {
        auth: {
            autoRefreshToken: false,
            persistSession: false,
        },
    });
}

/**
 * @deprecated Use getSupabaseAdmin() instead to get a fresh client per request.
 * This singleton is kept for backwards compatibility but may have caching issues.
 */
export const supabaseAdmin = getSupabaseAdmin();

