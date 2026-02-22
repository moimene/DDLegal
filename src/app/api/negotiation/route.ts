import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { requirePermission } from '@/lib/auth/require-permission';

/**
 * Negotiation CRUD — dd_contingencies_ext
 * GET   /api/negotiation?project_id=xxx[&contingency_id=xxx][&negotiation_status=xxx]
 * POST  /api/negotiation — Upsert contingency ext record
 * PATCH /api/negotiation — Update specific fields on ext record
 */

export async function GET(req: NextRequest) {
    try {
        const { searchParams } = new URL(req.url);
        const projectId = searchParams.get('project_id');
        const contingencyId = searchParams.get('contingency_id');
        const negotiationStatus = searchParams.get('negotiation_status');

        if (!projectId) {
            return NextResponse.json(
                { error: 'project_id is required' },
                { status: 400 }
            );
        }

        // Permission check
        const { authorized, error: authError } = await requirePermission(req, projectId, 'can_view_negotiation');
        if (!authorized) return authError!;

        // ── Single contingency with clause maps ──────────────────
        if (contingencyId) {
            const { data: contingency, error: cError } = await supabaseAdmin
                .from('dd_contingencies')
                .select('*')
                .eq('id', contingencyId)
                .eq('project_id', projectId)
                .single();

            if (cError || !contingency) {
                return NextResponse.json(
                    { error: 'Contingency not found' },
                    { status: 404 }
                );
            }

            const { data: ext } = await supabaseAdmin
                .from('dd_contingencies_ext')
                .select('*')
                .eq('contingency_id', contingencyId)
                .maybeSingle();

            const { data: clauseMaps } = await supabaseAdmin
                .from('dd_contingency_clause_map')
                .select('*')
                .eq('contingency_id', contingencyId);

            return NextResponse.json({
                success: true,
                contingency: {
                    ...contingency,
                    ext: ext || null,
                    clause_maps: clauseMaps || [],
                },
            });
        }

        // ── All contingencies for project with ext records ───────
        const { data: contingencies, error: listError } = await supabaseAdmin
            .from('dd_contingencies')
            .select('*')
            .eq('project_id', projectId)
            .order('created_at', { ascending: false });

        if (listError) {
            console.error('Negotiation list error:', listError);
            return NextResponse.json(
                { error: 'Failed to fetch contingencies' },
                { status: 500 }
            );
        }

        const contingencyIds = (contingencies || []).map((c) => c.id);

        // Fetch all ext records for these contingencies in one query
        let extRecords: Record<string, unknown>[] = [];
        if (contingencyIds.length > 0) {
            const { data: exts } = await supabaseAdmin
                .from('dd_contingencies_ext')
                .select('*')
                .in('contingency_id', contingencyIds);
            extRecords = exts || [];
        }

        const extByContingencyId = new Map<string, Record<string, unknown>>();
        for (const ext of extRecords) {
            extByContingencyId.set(ext.contingency_id as string, ext);
        }

        // Join ext records onto contingencies
        let results = (contingencies || []).map((c) => ({
            ...c,
            ext: extByContingencyId.get(c.id) || null,
        }));

        // Optional filter by negotiation_status
        if (negotiationStatus) {
            results = results.filter((r) => {
                const ext = r.ext as Record<string, unknown> | null;
                return ext && ext.negotiation_status === negotiationStatus;
            });
        }

        return NextResponse.json({
            success: true,
            contingencies: results,
            count: results.length,
        });
    } catch (error) {
        console.error('Negotiation GET error:', error);
        return NextResponse.json(
            { error: 'Internal server error' },
            { status: 500 }
        );
    }
}

export async function POST(req: NextRequest) {
    try {
        const body = await req.json();
        const {
            contingency_id,
            buy_position,
            sell_position,
            treatment,
            cap_amount,
            basket_type,
            basket_amount,
            survival_months,
            rwi_coverage,
            spa_clause_ref,
            negotiation_status,
            notes,
        } = body as {
            contingency_id?: string;
            buy_position?: string;
            sell_position?: string;
            treatment?: string;
            cap_amount?: number;
            basket_type?: string;
            basket_amount?: number;
            survival_months?: number;
            rwi_coverage?: boolean;
            spa_clause_ref?: string;
            negotiation_status?: string;
            notes?: string;
        };

        if (!contingency_id) {
            return NextResponse.json(
                { error: 'contingency_id is required' },
                { status: 400 }
            );
        }

        // Verify the contingency exists
        const { data: contingency, error: cError } = await supabaseAdmin
            .from('dd_contingencies')
            .select('id, project_id')
            .eq('id', contingency_id)
            .single();

        if (cError || !contingency) {
            return NextResponse.json(
                { error: 'Contingency not found' },
                { status: 404 }
            );
        }

        // Permission check
        if (contingency.project_id) {
            const { authorized, error: authError } = await requirePermission(req, contingency.project_id, 'can_view_negotiation');
            if (!authorized) return authError!;
        } else {
            // Fallback: require at least an authenticated user
            const userId = req.headers.get('x-user-id');
            if (!userId) return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
        }

        // Upsert into dd_contingencies_ext
        const upsertData: Record<string, unknown> = {
            contingency_id,
        };

        if (buy_position !== undefined) upsertData.buy_position = buy_position;
        if (sell_position !== undefined) upsertData.sell_position = sell_position;
        if (treatment !== undefined) upsertData.treatment = treatment;
        if (cap_amount !== undefined) upsertData.cap_amount = cap_amount;
        if (basket_type !== undefined) upsertData.basket_type = basket_type;
        if (basket_amount !== undefined) upsertData.basket_amount = basket_amount;
        if (survival_months !== undefined) upsertData.survival_months = survival_months;
        if (rwi_coverage !== undefined) upsertData.rwi_coverage = rwi_coverage;
        if (spa_clause_ref !== undefined) upsertData.spa_clause_ref = spa_clause_ref;
        if (negotiation_status !== undefined) upsertData.negotiation_status = negotiation_status;
        if (notes !== undefined) upsertData.notes = notes;

        const { data, error } = await supabaseAdmin
            .from('dd_contingencies_ext')
            .upsert(upsertData, { onConflict: 'contingency_id' })
            .select()
            .single();

        if (error) {
            console.error('Negotiation upsert error:', error);
            return NextResponse.json(
                { error: 'Failed to upsert negotiation data', details: error.message },
                { status: 500 }
            );
        }

        return NextResponse.json({
            success: true,
            ext: data,
        }, { status: 201 });
    } catch (error) {
        console.error('Negotiation POST error:', error);
        return NextResponse.json(
            { error: 'Internal server error' },
            { status: 500 }
        );
    }
}

export async function PATCH(req: NextRequest) {
    try {
        const body = await req.json();
        const { id, ...fieldsToUpdate } = body as {
            id?: string;
            [key: string]: unknown;
        };

        if (!id) {
            return NextResponse.json(
                { error: 'id is required' },
                { status: 400 }
            );
        }

        // Permission check: look up ext record to find contingency's project_id
        const { data: extRecord } = await supabaseAdmin
            .from('dd_contingencies_ext')
            .select('contingency_id')
            .eq('id', id)
            .maybeSingle();
        if (extRecord?.contingency_id) {
            const { data: cont } = await supabaseAdmin
                .from('dd_contingencies')
                .select('project_id')
                .eq('id', extRecord.contingency_id)
                .maybeSingle();
            if (cont?.project_id) {
                const { authorized, error: authError } = await requirePermission(req, cont.project_id, 'can_view_negotiation');
                if (!authorized) return authError!;
            }
        } else {
            const userId = req.headers.get('x-user-id');
            if (!userId) {
                return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
            }
        }

        if (Object.keys(fieldsToUpdate).length === 0) {
            return NextResponse.json(
                { error: 'No fields to update' },
                { status: 400 }
            );
        }

        // Only allow known fields
        const allowedFields = new Set([
            'buy_position', 'sell_position', 'treatment', 'cap_amount',
            'basket_type', 'basket_amount', 'survival_months', 'rwi_coverage',
            'spa_clause_ref', 'negotiation_status', 'notes',
        ]);

        const updateData: Record<string, unknown> = {};
        for (const [key, value] of Object.entries(fieldsToUpdate)) {
            if (allowedFields.has(key)) {
                updateData[key] = value;
            }
        }

        if (Object.keys(updateData).length === 0) {
            return NextResponse.json(
                { error: 'No valid fields to update' },
                { status: 400 }
            );
        }

        const { data, error } = await supabaseAdmin
            .from('dd_contingencies_ext')
            .update(updateData)
            .eq('id', id)
            .select()
            .single();

        if (error) {
            console.error('Negotiation update error:', error);
            return NextResponse.json(
                { error: 'Failed to update negotiation data', details: error.message },
                { status: 500 }
            );
        }

        if (!data) {
            return NextResponse.json(
                { error: 'Record not found' },
                { status: 404 }
            );
        }

        return NextResponse.json({
            success: true,
            ext: data,
        });
    } catch (error) {
        console.error('Negotiation PATCH error:', error);
        return NextResponse.json(
            { error: 'Internal server error' },
            { status: 500 }
        );
    }
}
