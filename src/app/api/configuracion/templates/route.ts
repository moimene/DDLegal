import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { REPORT_TEMPLATES } from '@/lib/reporting/templates';

/**
 * API: Configuracion > Plantillas y Checklists
 *
 * GET  ?type=expected_documents  — List expected documents grouped by area_code
 * GET  ?type=report_templates    — Return REPORT_TEMPLATES from reporting engine
 * POST                           — Create expected document
 * PATCH                          — Update expected document
 * DELETE                         — Remove expected document
 */

export async function GET(req: NextRequest) {
    const { searchParams } = new URL(req.url);
    const type = searchParams.get('type');

    if (type === 'report_templates') {
        const templates = Object.entries(REPORT_TEMPLATES).map(([key, tmpl]) => ({
            key,
            ...tmpl,
        }));
        return NextResponse.json({ success: true, count: templates.length, templates });
    }

    if (type === 'expected_documents') {
        const { data, error } = await supabaseAdmin
            .from('dd_expected_documents')
            .select('*')
            .order('area_code')
            .order('sort_order');

        if (error) {
            return NextResponse.json({ error: error.message }, { status: 500 });
        }

        // Group by area_code
        const grouped: Record<string, typeof data> = {};
        (data || []).forEach(doc => {
            if (!grouped[doc.area_code]) grouped[doc.area_code] = [];
            grouped[doc.area_code].push(doc);
        });

        return NextResponse.json({
            success: true,
            count: (data || []).length,
            documents: data || [],
            grouped,
        });
    }

    return NextResponse.json(
        { error: 'Query param "type" required: expected_documents | report_templates' },
        { status: 400 }
    );
}

export async function POST(req: NextRequest) {
    try {
        const body = await req.json();
        const { area_code, category, name, description, is_mandatory, review_depth, sort_order } = body;

        if (!area_code || !category || !name) {
            return NextResponse.json(
                { error: 'area_code, category and name are required' },
                { status: 400 }
            );
        }

        const { data, error } = await supabaseAdmin
            .from('dd_expected_documents')
            .insert({
                area_code,
                category,
                name,
                description: description || null,
                is_mandatory: is_mandatory ?? true,
                review_depth: review_depth || 'standard',
                sort_order: sort_order ?? 0,
            })
            .select()
            .single();

        if (error) {
            return NextResponse.json({ error: error.message }, { status: 500 });
        }

        return NextResponse.json({ success: true, document: data });
    } catch {
        return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });
    }
}

export async function PATCH(req: NextRequest) {
    try {
        const body = await req.json();
        const { id, ...fields } = body;

        if (!id) {
            return NextResponse.json({ error: 'id is required' }, { status: 400 });
        }

        // Only allow valid fields
        const allowed = ['area_code', 'category', 'name', 'description', 'is_mandatory', 'review_depth', 'sort_order'];
        const updates: Record<string, unknown> = {};
        for (const key of allowed) {
            if (key in fields) updates[key] = fields[key];
        }

        if (Object.keys(updates).length === 0) {
            return NextResponse.json({ error: 'No valid fields to update' }, { status: 400 });
        }

        const { data, error } = await supabaseAdmin
            .from('dd_expected_documents')
            .update(updates)
            .eq('id', id)
            .select()
            .single();

        if (error) {
            return NextResponse.json({ error: error.message }, { status: 500 });
        }

        return NextResponse.json({ success: true, document: data });
    } catch {
        return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });
    }
}

export async function DELETE(req: NextRequest) {
    try {
        const body = await req.json();
        const { id } = body;

        if (!id) {
            return NextResponse.json({ error: 'id is required' }, { status: 400 });
        }

        const { error } = await supabaseAdmin
            .from('dd_expected_documents')
            .delete()
            .eq('id', id);

        if (error) {
            return NextResponse.json({ error: error.message }, { status: 500 });
        }

        return NextResponse.json({ success: true, deleted: id });
    } catch {
        return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });
    }
}
