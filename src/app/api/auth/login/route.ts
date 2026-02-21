import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

/**
 * Auth Login — API Route
 * POST /api/auth/login
 *
 * Accepts email + password, authenticates via Supabase Auth.
 * Returns user data and session token.
 */
export async function POST(req: NextRequest) {
    try {
        const body = await req.json();
        const { email, password } = body as { email?: string; password?: string };

        if (!email || !password) {
            return NextResponse.json(
                { error: 'Email and password are required.' },
                { status: 400 }
            );
        }

        // Use a fresh client per request to avoid session leakage
        const supabase = createClient(supabaseUrl, supabaseAnonKey, {
            auth: { autoRefreshToken: false, persistSession: false },
        });

        const { data, error } = await supabase.auth.signInWithPassword({
            email,
            password,
        });

        if (error || !data.session) {
            return NextResponse.json(
                { error: error?.message || 'Invalid credentials.' },
                { status: 401 }
            );
        }

        return NextResponse.json({
            success: true,
            user: {
                id: data.user.id,
                email: data.user.email,
            },
            session: {
                access_token: data.session.access_token,
                refresh_token: data.session.refresh_token,
                expires_at: data.session.expires_at,
            },
        });
    } catch (error) {
        console.error('Auth login API error:', error);
        return NextResponse.json(
            { error: 'Internal server error' },
            { status: 500 }
        );
    }
}
