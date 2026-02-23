import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-admin';

const AREA_NAMES: Record<string, string> = {
    MERC: 'Mercantil / Societario',
    CONT: 'Contratos',
    LAB: 'Laboral',
    FISC: 'Fiscal',
    INM: 'Inmobiliario',
    PI: 'Propiedad Industrial',
    LIT: 'Litigios',
    ADMIN: 'Administrativo',
    MA: 'M&A Transversal',
    DATOS: 'Proteccion de Datos',
    GENERAL: 'General',
};

export async function GET(
    _req: NextRequest,
    { params }: { params: Promise<{ id: string; code: string }> }
) {
    try {
        const { id: projectId, code } = await params;

        // Resolve area UUID from code (dd_contingencies uses area_id, not area_code)
        const { data: area } = await supabaseAdmin
            .from('dd_areas')
            .select('id')
            .eq('code', code)
            .single();

        const areaId = area?.id ?? null;

        const [tasksRes, contingenciesRes] = await Promise.all([
            supabaseAdmin
                .from('dd_kanban_tasks')
                .select('id, title, state, priority, assigned_to, updated_at')
                .eq('project_id', projectId)
                .eq('area_code', code)
                .order('updated_at', { ascending: false }),
            areaId
                ? supabaseAdmin
                      .from('dd_contingencies')
                      .select('id, title, severity, probability, estimated_amount, status, recommendation')
                      .eq('project_id', projectId)
                      .eq('area_id', areaId)
                      .order('severity', { ascending: true })
                : Promise.resolve({ data: [], error: null }),
        ]);

        return NextResponse.json({
            success: true,
            data: {
                area_code: code,
                area_name: AREA_NAMES[code] || code,
                tasks: tasksRes.data || [],
                contingencies: contingenciesRes.data || [],
            },
        });
    } catch (error) {
        console.error('Area API error:', error);
        return NextResponse.json(
            { error: 'Internal server error' },
            { status: 500 }
        );
    }
}
