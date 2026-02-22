import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { requirePermission } from '@/lib/auth/require-permission';

/**
 * Project Role Assignments — API Route
 * GET  /api/projects/[id]/roles   — List all role assignments for project
 * POST /api/projects/[id]/roles   — Add new role assignment
 * DELETE /api/projects/[id]/roles — Remove role assignment by role_id (query param)
 */

export async function GET(
    req: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const { id: projectId } = await params;

        // Permission check — GET requires can_view_all_areas
        const { authorized, error: authError } = await requirePermission(req, projectId, 'can_view_all_areas');
        if (!authorized) return authError!;

        const { data: roles, error } = await supabaseAdmin
            .from('dd_project_user_roles')
            .select('*')
            .eq('project_id', projectId)
            .eq('is_active', true)
            .order('granted_at', { ascending: false });

        if (error) {
            console.error('Roles list error:', error);
            return NextResponse.json(
                { error: 'Failed to fetch roles', details: error.message },
                { status: 500 }
            );
        }

        return NextResponse.json({
            success: true,
            project_id: projectId,
            roles: roles || [],
            count: roles?.length || 0,
        });
    } catch (error) {
        console.error('Project roles GET error:', error);
        return NextResponse.json(
            { error: 'Internal server error' },
            { status: 500 }
        );
    }
}

export async function POST(
    req: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const { id: projectId } = await params;

        // Permission check — POST requires can_manage_roles
        const { authorized, error: authError } = await requirePermission(req, projectId, 'can_manage_roles');
        if (!authorized) return authError!;

        const body = await req.json();
        const { user_id, role, area_code, granted_by } = body as {
            user_id?: string;
            role?: string;
            area_code?: string;
            granted_by?: string;
        };

        if (!user_id || !role) {
            return NextResponse.json(
                { error: 'Missing required fields: user_id, role.' },
                { status: 400 }
            );
        }

        // Check if this exact assignment already exists
        const { data: existing } = await supabaseAdmin
            .from('dd_project_user_roles')
            .select('id')
            .eq('project_id', projectId)
            .eq('user_id', user_id)
            .eq('role', role)
            .eq('is_active', true)
            .maybeSingle();

        if (existing) {
            return NextResponse.json(
                { error: 'This role assignment already exists.', existing_id: existing.id },
                { status: 409 }
            );
        }

        const { data: newRole, error: insertError } = await supabaseAdmin
            .from('dd_project_user_roles')
            .insert({
                project_id: projectId,
                user_id,
                role,
                area_code: area_code || null,
                is_active: true,
                granted_by: granted_by || null,
            })
            .select('*')
            .single();

        if (insertError) {
            console.error('Role insert error:', insertError);
            return NextResponse.json(
                { error: 'Failed to create role assignment.', details: insertError.message },
                { status: 500 }
            );
        }

        return NextResponse.json({
            success: true,
            role: newRole,
        }, { status: 201 });
    } catch (error) {
        console.error('Project roles POST error:', error);
        return NextResponse.json(
            { error: 'Internal server error' },
            { status: 500 }
        );
    }
}

export async function DELETE(
    req: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const { id: projectId } = await params;

        // Permission check — DELETE requires can_manage_roles
        const { authorized, error: authError } = await requirePermission(req, projectId, 'can_manage_roles');
        if (!authorized) return authError!;

        const { searchParams } = new URL(req.url);
        const roleId = searchParams.get('role_id');

        if (!roleId) {
            return NextResponse.json(
                { error: 'Missing required query parameter: role_id.' },
                { status: 400 }
            );
        }

        // Soft-delete: set is_active = false
        const { data: updatedRole, error: updateError } = await supabaseAdmin
            .from('dd_project_user_roles')
            .update({
                is_active: false,
                updated_at: new Date().toISOString(),
            })
            .eq('id', roleId)
            .eq('project_id', projectId)
            .select('*')
            .single();

        if (updateError) {
            console.error('Role delete error:', updateError);
            return NextResponse.json(
                { error: 'Failed to remove role assignment.', details: updateError.message },
                { status: 500 }
            );
        }

        if (!updatedRole) {
            return NextResponse.json(
                { error: 'Role assignment not found in this project.' },
                { status: 404 }
            );
        }

        return NextResponse.json({
            success: true,
            removed: updatedRole,
        });
    } catch (error) {
        console.error('Project roles DELETE error:', error);
        return NextResponse.json(
            { error: 'Internal server error' },
            { status: 500 }
        );
    }
}
