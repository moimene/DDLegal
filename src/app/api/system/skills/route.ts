import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-admin';

// ---------------------------------------------------------------------------
// Auth helper: verify x-user-id header exists (JWT middleware passed)
// ---------------------------------------------------------------------------
function requireAuth(req: NextRequest): NextResponse | null {
    const userId = req.headers.get('x-user-id');
    if (!userId) {
        return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }
    return null;
}

// ---------------------------------------------------------------------------
// GET /api/system/skills?area_code=MERC&category=verificacion&is_active=true
// List skills, optionally filtered by area_code, category, is_active.
// ---------------------------------------------------------------------------
export async function GET(req: NextRequest) {
    try {
        const authErr = requireAuth(req);
        if (authErr) return authErr;

        const { searchParams } = new URL(req.url);
        const areaCode = searchParams.get('area_code');
        const category = searchParams.get('category');
        const isActive = searchParams.get('is_active');

        let query = supabaseAdmin
            .from('dd_skills_catalog')
            .select('*')
            .order('area_code')
            .order('skill_key');

        if (areaCode) {
            query = query.eq('area_code', areaCode);
        }

        if (category) {
            query = query.eq('category', category);
        }

        if (isActive !== null && isActive !== undefined && isActive !== '') {
            query = query.eq('is_active', isActive === 'true');
        }

        const { data, error } = await query;

        if (error) {
            console.error('Skills GET error:', error);
            return NextResponse.json({ error: error.message }, { status: 500 });
        }

        return NextResponse.json({ success: true, data: data || [] });
    } catch (error) {
        console.error('Skills GET error:', error);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}

// ---------------------------------------------------------------------------
// POST /api/system/skills
// Create a new skill entry.
// Body: { skill_key, area_code, name, category, prompt_template, ...optional }
// ---------------------------------------------------------------------------
export async function POST(req: NextRequest) {
    try {
        const authErr = requireAuth(req);
        if (authErr) return authErr;

        const body = await req.json();
        const { skill_key, area_code, name, category, prompt_template } = body;

        if (!skill_key || !area_code || !name || !category || !prompt_template) {
            return NextResponse.json(
                { error: 'skill_key, area_code, name, category y prompt_template son obligatorios' },
                { status: 400 }
            );
        }

        const OPTIONAL_FIELDS = [
            'priority', 'expected_output_schema', 'agent_pipeline',
            'hitl_required', 'inputs_required', 'validation_rules',
            'hitl_conditions', 'grounding_description', 'risks_limits',
            'kpis', 'trigger_description', 'authorized_sources',
            'dependencies', 'purpose', 'metadata', 'description',
            'evidence_requirements', 'area_id',
        ];

        const insertData: Record<string, unknown> = {
            skill_key,
            area_code,
            name,
            category,
            prompt_template,
        };

        for (const key of OPTIONAL_FIELDS) {
            if (body[key] !== undefined) {
                insertData[key] = body[key];
            }
        }

        const { data, error } = await supabaseAdmin
            .from('dd_skills_catalog')
            .insert(insertData)
            .select()
            .single();

        if (error) {
            console.error('Skills POST error:', error);
            return NextResponse.json({ error: error.message }, { status: 500 });
        }

        return NextResponse.json({ success: true, data }, { status: 201 });
    } catch (error) {
        console.error('Skills POST error:', error);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}

// ---------------------------------------------------------------------------
// PATCH /api/system/skills
// Update an existing skill entry.
// Body: { skill_id, ...fields }  -- allowlist validation
// ---------------------------------------------------------------------------
export async function PATCH(req: NextRequest) {
    try {
        const authErr = requireAuth(req);
        if (authErr) return authErr;

        const body = await req.json();
        const { skill_id, ...fields } = body;

        if (!skill_id) {
            return NextResponse.json({ error: 'skill_id es obligatorio' }, { status: 400 });
        }

        const ALLOWED_FIELDS = [
            'is_active', 'priority', 'prompt_template', 'expected_output_schema',
            'agent_pipeline', 'hitl_required', 'validation_rules', 'hitl_conditions',
            'grounding_description', 'risks_limits', 'kpis', 'trigger_description',
            'authorized_sources', 'dependencies', 'purpose', 'metadata',
        ];

        const updateData: Record<string, unknown> = {};
        for (const key of ALLOWED_FIELDS) {
            if (key in fields) {
                updateData[key] = fields[key];
            }
        }

        if (Object.keys(updateData).length === 0) {
            return NextResponse.json(
                { error: 'No se proporcionaron campos permitidos para actualizar' },
                { status: 400 }
            );
        }

        const { data, error } = await supabaseAdmin
            .from('dd_skills_catalog')
            .update(updateData)
            .eq('id', skill_id)
            .select()
            .single();

        if (error) {
            console.error('Skills PATCH error:', error);
            return NextResponse.json({ error: error.message }, { status: 500 });
        }

        return NextResponse.json({ success: true, data });
    } catch (error) {
        console.error('Skills PATCH error:', error);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}

// ---------------------------------------------------------------------------
// DELETE /api/system/skills
// Soft-delete a skill (deactivate + mark deleted in metadata).
// Body: { skill_id }
// ---------------------------------------------------------------------------
export async function DELETE(req: NextRequest) {
    try {
        const authErr = requireAuth(req);
        if (authErr) return authErr;

        const body = await req.json();
        const { skill_id } = body;

        if (!skill_id) {
            return NextResponse.json({ error: 'skill_id es obligatorio' }, { status: 400 });
        }

        // Fetch current metadata to merge
        const { data: current, error: fetchError } = await supabaseAdmin
            .from('dd_skills_catalog')
            .select('metadata')
            .eq('id', skill_id)
            .single();

        if (fetchError) {
            console.error('Skills DELETE fetch error:', fetchError);
            return NextResponse.json({ error: fetchError.message }, { status: 500 });
        }

        const existingMeta = (current?.metadata as Record<string, unknown>) || {};

        const { data, error } = await supabaseAdmin
            .from('dd_skills_catalog')
            .update({
                is_active: false,
                metadata: {
                    ...existingMeta,
                    deleted: true,
                    deleted_at: new Date().toISOString(),
                },
            })
            .eq('id', skill_id)
            .select()
            .single();

        if (error) {
            console.error('Skills DELETE error:', error);
            return NextResponse.json({ error: error.message }, { status: 500 });
        }

        return NextResponse.json({ success: true, data });
    } catch (error) {
        console.error('Skills DELETE error:', error);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}
