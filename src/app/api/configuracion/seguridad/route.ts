import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-admin';

/**
 * Security & Access console API
 *
 * GET  ?type=users                         — List user roles across projects
 * GET  ?type=audit&project_id=x&limit=50   — Fetch audit log entries
 * POST { project_id?, action, entity_type, entity_id?, details? } — Log audit entry
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

        return NextResponse.json(
            { error: 'type parameter required: "users" or "audit"' },
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
        const { project_id, action, entity_type, entity_id, details } = body;

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
