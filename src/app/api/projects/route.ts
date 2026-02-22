import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-admin';

/**
 * GET /api/projects — List projects the authenticated user has access to.
 *
 * Returns projects where the user has an active role assignment.
 * Middleware sets x-user-id from the Bearer token.
 */
export async function GET(req: NextRequest) {
  const userId = req.headers.get('x-user-id');

  if (!userId) {
    return NextResponse.json(
      { success: false, error: 'Unauthorized' },
      { status: 401 },
    );
  }

  try {
    // Find projects where the user has a role
    const { data: roles, error: rolesError } = await supabaseAdmin
      .from('dd_project_user_roles')
      .select('project_id')
      .eq('user_id', userId)
      .eq('is_active', true);

    if (rolesError) {
      return NextResponse.json(
        { success: false, error: rolesError.message },
        { status: 500 },
      );
    }

    const projectIds = [...new Set((roles || []).map(r => r.project_id))];

    if (projectIds.length === 0) {
      return NextResponse.json({ success: true, data: [], count: 0 });
    }

    const { data: projects, error: projError } = await supabaseAdmin
      .from('dd_projects')
      .select('*')
      .in('id', projectIds)
      .order('created_at', { ascending: false });

    if (projError) {
      return NextResponse.json(
        { success: false, error: projError.message },
        { status: 500 },
      );
    }

    return NextResponse.json({
      success: true,
      data: projects || [],
      count: (projects || []).length,
    });
  } catch (err) {
    console.error('GET /api/projects error:', err);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 },
    );
  }
}
