import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { requirePermission } from '@/lib/auth/require-permission';

/**
 * SPA Clause Library & Contingency-Clause Mappings
 * GET    /api/negotiation/clauses?clause_type=&area_code=&is_active=true — clause library
 * POST   /api/negotiation/clauses — Create contingency <-> clause mapping
 * DELETE /api/negotiation/clauses — Remove contingency <-> clause mapping
 */

export async function GET(req: NextRequest) {
    try {
        // Verify authenticated user
        const userId = req.headers.get('x-user-id');
        if (!userId) {
            return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
        }

        const { searchParams } = new URL(req.url);
        const clauseType = searchParams.get('clause_type');
        const areaCode = searchParams.get('area_code');
        const isActiveParam = searchParams.get('is_active');
        const isActive = isActiveParam !== 'false'; // defaults to true

        let query = supabaseAdmin
            .from('dd_spa_clause_library')
            .select('*')
            .order('clause_type')
            .order('clause_key');

        if (clauseType) {
            query = query.eq('clause_type', clauseType);
        }

        if (areaCode) {
            query = query.eq('area_code', areaCode);
        }

        if (isActive) {
            query = query.eq('is_active', true);
        }

        const { data, error } = await query;

        if (error) {
            console.error('Clause library fetch error:', error);
            return NextResponse.json(
                { error: 'Failed to fetch clause library' },
                { status: 500 }
            );
        }

        return NextResponse.json({
            success: true,
            clauses: data || [],
            count: (data || []).length,
        });
    } catch (error) {
        console.error('Clauses GET error:', error);
        return NextResponse.json(
            { error: 'Internal server error' },
            { status: 500 }
        );
    }
}

export async function POST(req: NextRequest) {
    try {
        const body = await req.json();
        const { contingency_id, clause_key, merge_fields, is_primary } = body as {
            contingency_id?: string;
            clause_key?: string;
            merge_fields?: Record<string, unknown>;
            is_primary?: boolean;
        };

        if (!contingency_id || !clause_key) {
            return NextResponse.json(
                { error: 'contingency_id and clause_key are required' },
                { status: 400 }
            );
        }

        // Permission check: look up contingency's project_id
        const { data: cont } = await supabaseAdmin
            .from('dd_contingencies')
            .select('project_id')
            .eq('id', contingency_id)
            .maybeSingle();
        if (cont?.project_id) {
            const { authorized, error: authError } = await requirePermission(req, cont.project_id, 'can_view_negotiation');
            if (!authorized) return authError!;
        } else {
            const uid = req.headers.get('x-user-id');
            if (!uid) {
                return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
            }
        }

        const { data, error } = await supabaseAdmin
            .from('dd_contingency_clause_map')
            .insert({
                contingency_id,
                clause_key,
                merge_fields: merge_fields || {},
                is_primary: is_primary || false,
            })
            .select()
            .single();

        if (error) {
            // Handle unique constraint violation (contingency_id, clause_key)
            if (error.code === '23505') {
                return NextResponse.json(
                    { error: 'This clause mapping already exists for this contingency' },
                    { status: 409 }
                );
            }
            console.error('Clause mapping insert error:', error);
            return NextResponse.json(
                { error: 'Failed to create clause mapping', details: error.message },
                { status: 500 }
            );
        }

        return NextResponse.json({
            success: true,
            mapping: data,
        }, { status: 201 });
    } catch (error) {
        console.error('Clauses POST error:', error);
        return NextResponse.json(
            { error: 'Internal server error' },
            { status: 500 }
        );
    }
}

export async function DELETE(req: NextRequest) {
    try {
        const body = await req.json();
        const { contingency_id, clause_key } = body as {
            contingency_id?: string;
            clause_key?: string;
        };

        if (!contingency_id || !clause_key) {
            return NextResponse.json(
                { error: 'contingency_id and clause_key are required' },
                { status: 400 }
            );
        }

        // Permission check: look up contingency's project_id
        const { data: cont } = await supabaseAdmin
            .from('dd_contingencies')
            .select('project_id')
            .eq('id', contingency_id)
            .maybeSingle();
        if (cont?.project_id) {
            const { authorized, error: authError } = await requirePermission(req, cont.project_id, 'can_view_negotiation');
            if (!authorized) return authError!;
        } else {
            const uid = req.headers.get('x-user-id');
            if (!uid) {
                return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
            }
        }

        const { error } = await supabaseAdmin
            .from('dd_contingency_clause_map')
            .delete()
            .eq('contingency_id', contingency_id)
            .eq('clause_key', clause_key);

        if (error) {
            console.error('Clause mapping delete error:', error);
            return NextResponse.json(
                { error: 'Failed to delete clause mapping', details: error.message },
                { status: 500 }
            );
        }

        return NextResponse.json({ success: true });
    } catch (error) {
        console.error('Clauses DELETE error:', error);
        return NextResponse.json(
            { error: 'Internal server error' },
            { status: 500 }
        );
    }
}
