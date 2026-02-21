import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-admin';
import type { ProjectRole, RolePermissions } from '@/lib/supabase-auth';
import { ROLE_PERMISSIONS } from '@/lib/supabase-auth';

interface AuthContext {
  userId: string;
  userEmail: string;
  role: ProjectRole;
  areaCode?: string;
}

/**
 * Validate user has specific permission on a project.
 * Uses x-user-id header set by middleware.
 */
export async function requirePermission(
  req: NextRequest,
  projectId: string,
  permission: keyof RolePermissions
): Promise<{ authorized: boolean; context?: AuthContext; error?: NextResponse }> {
  const userId = req.headers.get('x-user-id');
  const userEmail = req.headers.get('x-user-email') || '';

  if (!userId) {
    return {
      authorized: false,
      error: NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 }),
    };
  }

  const { data: roleData } = await supabaseAdmin
    .from('dd_project_user_roles')
    .select('role, area_code')
    .eq('user_id', userId)
    .eq('project_id', projectId)
    .eq('is_active', true)
    .single();

  if (!roleData) {
    return {
      authorized: false,
      error: NextResponse.json({ success: false, error: 'No role on project' }, { status: 403 }),
    };
  }

  const role = roleData.role as ProjectRole;
  const permissions = ROLE_PERMISSIONS[role];

  if (!permissions || !permissions[permission]) {
    return {
      authorized: false,
      error: NextResponse.json({ success: false, error: 'Insufficient permissions' }, { status: 403 }),
    };
  }

  return {
    authorized: true,
    context: { userId, userEmail, role, areaCode: roleData.area_code },
  };
}
