import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { supabaseAdmin } from '@/lib/supabase-admin';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

/**
 * Auth Me — API Route
 * GET /api/auth/me
 *
 * Returns current user info and project roles.
 * Requires Authorization: Bearer <token> header.
 */
export async function GET(req: NextRequest) {
    try {
        const authHeader = req.headers.get('authorization');

        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            return NextResponse.json(
                { error: 'Missing or invalid Authorization header.' },
                { status: 401 }
            );
        }

        const token = authHeader.replace('Bearer ', '');

        // Validate the token by getting the user
        const supabase = createClient(supabaseUrl, supabaseAnonKey, {
            global: { headers: { Authorization: `Bearer ${token}` } },
            auth: { autoRefreshToken: false, persistSession: false },
        });

        const { data: { user }, error: userError } = await supabase.auth.getUser(token);

        if (userError || !user) {
            return NextResponse.json(
                { error: 'Invalid or expired token.' },
                { status: 401 }
            );
        }

        // Fetch project roles for this user using admin client
        const { data: roles, error: rolesError } = await supabaseAdmin
            .from('dd_project_user_roles')
            .select('*')
            .eq('user_id', user.id)
            .eq('is_active', true)
            .order('granted_at', { ascending: false });

        if (rolesError) {
            // Table may not exist yet — return user without roles
            console.warn('Could not fetch project roles:', rolesError.message);
        }

        return NextResponse.json({
            success: true,
            user: {
                id: user.id,
                email: user.email,
                created_at: user.created_at,
            },
            roles: roles || [],
        });
    } catch (error) {
        console.error('Auth me API error:', error);
        return NextResponse.json(
            { error: 'Internal server error' },
            { status: 500 }
        );
    }
}
