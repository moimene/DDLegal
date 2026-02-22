import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const PUBLIC_ROUTES = [
  '/api/auth/login',
  '/api/auth/setup-test-users',  // Uses CRON_SECRET internally
  '/api/system/health',          // Health check should always be public
  '/api/gateway/whoami',
  '/api/gateway/health',
  '/api/cron/',           // Cron routes use CRON_SECRET, not Bearer auth
];

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  // Only protect API routes
  if (!pathname.startsWith('/api/')) {
    return NextResponse.next();
  }

  // Allow public routes
  if (PUBLIC_ROUTES.some(r => pathname.startsWith(r))) {
    return NextResponse.next();
  }

  const authHeader = req.headers.get('authorization');
  if (!authHeader?.startsWith('Bearer ')) {
    return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
  }

  const token = authHeader.replace('Bearer ', '');

  try {
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      { auth: { autoRefreshToken: false, persistSession: false } }
    );

    const { data: { user }, error } = await supabase.auth.getUser(token);

    if (error || !user) {
      return NextResponse.json({ success: false, error: 'Invalid token' }, { status: 401 });
    }

    // Forward user id in header for route handlers
    const response = NextResponse.next();
    response.headers.set('x-user-id', user.id);
    response.headers.set('x-user-email', user.email || '');
    return response;
  } catch {
    return NextResponse.json({ success: false, error: 'Auth error' }, { status: 500 });
  }
}

export const config = {
  matcher: '/api/:path*',
};
