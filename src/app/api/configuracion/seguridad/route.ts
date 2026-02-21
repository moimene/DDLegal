import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-admin';

/**
 * Security & Access console API
 *
 * GET   ?type=users                         — List user roles across projects
 * GET   ?type=audit&project_id=x&limit=50   — Fetch audit log entries
 * GET   ?type=projects                      — List projects (id, name) for selects
 * POST  { action: 'create_role', email, role, project_id, area_code?, expires_at? }
 * POST  { action: 'log_audit', project_id?, entity_type, entity_id?, details? }
 * PATCH { action: 'toggle_active', id, is_active }
 * PATCH { action: 'update_role', id, email?, role?, project_id?, area_code?, expires_at? }
 */

export async function GET(req: NextRequest) {
    try {
        const { searchParams } = new URL(req.url);
        const type = searchParams.get('type');

        if (type === 'users') {
            const { data, error } = await supabaseAdmin
                .from('dd_project_user_roles')
                .select('*, dd_projects(name)')
                .order('user_id')
                .order('granted_at', { ascending: false });

            if (error) {
                console.error('Users list error:', error);
                return NextResponse.json({ error: error.message }, { status: 500 });
            }

            return NextResponse.json({
                success: true,
                users: data || [],
                count: data?.length || 0,
            });
        }

        if (type === 'audit') {
            const projectId = searchParams.get('project_id');
            const limit = Math.min(parseInt(searchParams.get('limit') || '50'), 500);

            let query = supabaseAdmin
                .from('dd_audit_log')
                .select('*, dd_projects(name)')
                .order('created_at', { ascending: false })
                .limit(limit);

            if (projectId) {
                query = query.eq('project_id', projectId);
            }

            const { data, error } = await query;

            if (error) {
                console.error('Audit log error:', error);
                return NextResponse.json({ error: error.message }, { status: 500 });
            }

            return NextResponse.json({
                success: true,
                audit: data || [],
                count: data?.length || 0,
            });
        }

        if (type === 'projects') {
            const { data, error } = await supabaseAdmin
                .from('dd_projects')
                .select('id, name')
                .order('name');

            if (error) {
                console.error('Projects list error:', error);
                return NextResponse.json({ error: error.message }, { status: 500 });
            }

            return NextResponse.json({
                success: true,
                projects: data || [],
            });
        }

        return NextResponse.json(
            { error: 'type parameter required: "users", "audit", or "projects"' },
            { status: 400 }
        );
    } catch (error) {
        console.error('Seguridad API GET error:', error);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}

export async function POST(req: NextRequest) {
    try {
        const body = await req.json();
        const { action } = body;

        // ── Create a new user-role assignment ──
        if (action === 'create_role') {
            const { email, role, project_id, area_code, expires_at } = body;

            if (!email || !role || !project_id) {
                return NextResponse.json(
                    { error: 'email, role, and project_id are required for create_role' },
                    { status: 400 }
                );
            }

            const validRoles = [
                'clo', 'pm_transaccion', 'abogado_area', 'deal_sponsor',
                'target_liaison', 'stakeholder_negocio', 'cliente_externo',
            ];
            if (!validRoles.includes(role)) {
                return NextResponse.json(
                    { error: `Invalid role. Must be one of: ${validRoles.join(', ')}` },
                    { status: 400 }
                );
            }

            // Use email as the user_id identifier
            const insertPayload: Record<string, unknown> = {
                user_id: email,
                role,
                project_id,
                is_active: true,
            };
            if (area_code) insertPayload.area_code = area_code;
            if (expires_at) insertPayload.expires_at = expires_at;

            const { data, error } = await supabaseAdmin
                .from('dd_project_user_roles')
                .insert(insertPayload)
                .select('*, dd_projects(name)')
                .single();

            if (error) {
                console.error('Create role error:', error);
                return NextResponse.json({ error: error.message }, { status: 500 });
            }

            return NextResponse.json({ success: true, role: data });
        }

        // ── Default: log an audit entry (legacy behaviour) ──
        const { project_id, entity_type, entity_id, details } = body;

        if (!action || !entity_type) {
            return NextResponse.json(
                { error: 'action (string) and entity_type (string) are required' },
                { status: 400 }
            );
        }

        const { data, error } = await supabaseAdmin
            .from('dd_audit_log')
            .insert({
                project_id: project_id || null,
                action,
                entity_type,
                entity_id: entity_id || null,
                details: details || {},
            })
            .select()
            .single();

        if (error) {
            console.error('Audit log insert error:', error);
            return NextResponse.json({ error: error.message }, { status: 500 });
        }

        return NextResponse.json({ success: true, entry: data });
    } catch (error) {
        console.error('Seguridad API POST error:', error);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}

export async function PATCH(req: NextRequest) {
    try {
        const body = await req.json();
        const { action } = body;

        // ── Toggle active status ──
        if (action === 'toggle_active') {
            const { id, is_active } = body;
            if (!id || typeof is_active !== 'boolean') {
                return NextResponse.json(
                    { error: 'id (string) and is_active (boolean) are required' },
                    { status: 400 }
                );
            }

            const { data, error } = await supabaseAdmin
                .from('dd_project_user_roles')
                .update({ is_active })
                .eq('id', id)
                .select('*, dd_projects(name)')
                .single();

            if (error) {
                console.error('Toggle active error:', error);
                return NextResponse.json({ error: error.message }, { status: 500 });
            }

            return NextResponse.json({ success: true, role: data });
        }

        // ── Update role details ──
        if (action === 'update_role') {
            const { id, email, role, project_id, area_code, expires_at } = body;
            if (!id) {
                return NextResponse.json(
                    { error: 'id is required for update_role' },
                    { status: 400 }
                );
            }

            const updatePayload: Record<string, unknown> = {};
            if (email !== undefined) updatePayload.user_id = email;
            if (role !== undefined) updatePayload.role = role;
            if (project_id !== undefined) updatePayload.project_id = project_id;
            if (area_code !== undefined) updatePayload.area_code = area_code || null;
            if (expires_at !== undefined) updatePayload.expires_at = expires_at || null;

            const { data, error } = await supabaseAdmin
                .from('dd_project_user_roles')
                .update(updatePayload)
                .eq('id', id)
                .select('*, dd_projects(name)')
                .single();

            if (error) {
                console.error('Update role error:', error);
                return NextResponse.json({ error: error.message }, { status: 500 });
            }

            return NextResponse.json({ success: true, role: data });
        }

        return NextResponse.json(
            { error: 'action must be "toggle_active" or "update_role"' },
            { status: 400 }
        );
    } catch (error) {
        console.error('Seguridad API PATCH error:', error);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}
