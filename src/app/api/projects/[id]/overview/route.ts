import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-admin';

export async function GET(
    _request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    const { id: projectId } = await params;

    const [pRes, aRes, prRes, tRes, cRes, skillsRes] = await Promise.all([
        supabaseAdmin.from('dd_projects').select('*').eq('id', projectId).single(),
        supabaseAdmin.from('dd_areas').select('*').order('sort_order'),
        supabaseAdmin.from('dd_processes').select('*').order('sort_order'),
        supabaseAdmin.from('dd_tasks').select('*').eq('project_id', projectId).order('created_at'),
        supabaseAdmin.from('dd_contingencies').select('*').eq('project_id', projectId).order('severity'),
        supabaseAdmin.from('dd_skills_catalog').select('*').eq('is_active', true).order('area_code').order('skill_key'),
    ]);

    // These tables may not exist yet — handle gracefully
    const warnings: string[] = [];
    let qas: Record<string, unknown>[] = [];
    let deliverables: Record<string, unknown>[] = [];

    const qaRes = await supabaseAdmin
        .from('dd_qa')
        .select('*')
        .eq('project_id', projectId)
        .order('created_at', { ascending: false });
    if (qaRes.error) {
        warnings.push('No se pudo cargar la pestaña Q&A (tabla dd_qa no disponible).');
    } else {
        qas = qaRes.data || [];
    }

    const dRes = await supabaseAdmin
        .from('dd_deliverables')
        .select('*')
        .eq('project_id', projectId)
        .order('created_at', { ascending: false });
    if (dRes.error) {
        warnings.push('No se pudo cargar la pestaña Entregables (tabla dd_deliverables no disponible).');
    } else {
        deliverables = dRes.data || [];
    }

    if (!pRes.data) {
        return NextResponse.json({ success: false, error: 'Project not found' }, { status: 404 });
    }

    return NextResponse.json({
        success: true,
        project: pRes.data,
        areas: aRes.data || [],
        processes: prRes.data || [],
        tasks: tRes.data || [],
        contingencies: cRes.data || [],
        qas,
        deliverables,
        skills: skillsRes.data || [],
        warnings,
    });
}
