import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-admin';

/**
 * IP Radar — Request Management
 * POST /api/ip/requests — create new IP investigation request
 * GET  /api/ip/requests?id=xxx — get request status
 */

export async function POST(req: NextRequest) {
    try {
        const body = await req.json();
        const { denominacion_input, titular_nif, scope_jurisdicciones, project_id } = body;

        if (!denominacion_input) {
            return NextResponse.json(
                { error: 'denominacion_input is required' },
                { status: 400 }
            );
        }

        const scope = scope_jurisdicciones || ['ES', 'EU'];

        // Create IP request
        const { data: request, error } = await supabaseAdmin
            .from('ip_requests')
            .insert({
                denominacion_input,
                titular_nif: titular_nif || null,
                scope_jurisdicciones: scope,
                project_id: project_id || null,
                status: 'pending',
                pipeline_step: 'created',
            })
            .select()
            .single();

        if (error || !request) {
            return NextResponse.json(
                { error: `Failed to create IP request: ${error?.message}` },
                { status: 500 }
            );
        }

        return NextResponse.json({
            success: true,
            request_id: request.id,
            status: 'pending',
            pipeline_step: 'created',
        });

    } catch (error) {
        console.error('IP request creation error:', error);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}

export async function GET(req: NextRequest) {
    const { searchParams } = new URL(req.url);
    const id = searchParams.get('id');

    if (!id) {
        return NextResponse.json({ error: 'id is required' }, { status: 400 });
    }

    const { data: request, error } = await supabaseAdmin
        .from('ip_requests')
        .select('*')
        .eq('id', id)
        .single();

    if (error || !request) {
        return NextResponse.json({ error: 'Request not found' }, { status: 404 });
    }

    // Get related data counts
    const titular_id = request.titular_id;
    let marcasCount = 0;
    let disenosCount = 0;

    if (titular_id) {
        const { count: mc } = await supabaseAdmin
            .from('ip_marcas')
            .select('*', { count: 'exact', head: true })
            .eq('titular_id', titular_id);
        marcasCount = mc || 0;

        const { count: dc } = await supabaseAdmin
            .from('ip_disenos')
            .select('*', { count: 'exact', head: true })
            .eq('titular_id', titular_id);
        disenosCount = dc || 0;
    }

    return NextResponse.json({
        success: true,
        request,
        counts: {
            marcas: marcasCount,
            disenos: disenosCount,
        },
    });
}
