import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-admin';

const AREA_NAMES: Record<string, string> = {
    MERC: 'Mercantil',
    CONT: 'Contratos',
    LAB: 'Laboral',
    FISC: 'Fiscal',
    INM: 'Inmobiliario',
    PI: 'Propiedad Industrial',
    LIT: 'Litigios',
    ADMIN: 'Administrativo',
    MA: 'M&A Transversal',
    DATOS: 'Proteccion Datos',
    GENERAL: 'General',
};

export async function GET(
    _req: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const { id: projectId } = await params;

        // Get distinct area_codes that have kanban tasks in this project
        const { data: rows } = await supabaseAdmin
            .from('dd_kanban_tasks')
            .select('area_code')
            .eq('project_id', projectId);

        const uniqueCodes = Array.from(new Set((rows || []).map((r) => r.area_code))).sort();

        const areas = uniqueCodes.map((code) => ({
            code,
            name: AREA_NAMES[code] || code,
        }));

        return NextResponse.json({ areas });
    } catch (error) {
        console.error('Active areas API error:', error);
        return NextResponse.json({ areas: [] });
    }
}
