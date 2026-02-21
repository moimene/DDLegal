import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-admin';

/**
 * GET  /api/reports/[id]/versions — Lista todas las versiones de un informe
 * POST /api/reports/[id]/versions — Crea nueva version a partir del informe actual
 */

export async function GET(
    _req: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const { id } = await params;

        // Obtener el informe base para encontrar el report_type y project_id
        const { data: baseReport, error: fetchError } = await supabaseAdmin
            .from('dd_reports')
            .select('id, report_type, request_id, snapshot_id')
            .eq('id', id)
            .single();

        if (fetchError || !baseReport) {
            return NextResponse.json(
                { error: 'Informe no encontrado' },
                { status: 404 }
            );
        }

        // Buscar todas las versiones con el mismo report_type y request_id/snapshot_id
        let query = supabaseAdmin
            .from('dd_reports')
            .select('id, version_number, is_frozen, frozen_at, frozen_by, grounding_score, status, report_type, report_category, visibility, created_at, updated_at')
            .eq('report_type', baseReport.report_type);

        // Filtrar por request_id si existe para agrupar versiones del mismo informe
        if (baseReport.request_id) {
            query = query.eq('request_id', baseReport.request_id);
        } else if (baseReport.snapshot_id) {
            query = query.eq('snapshot_id', baseReport.snapshot_id);
        }

        const { data: versions, error: versionsError } = await query
            .order('version_number', { ascending: true });

        if (versionsError) {
            return NextResponse.json(
                { error: `Error al obtener versiones: ${versionsError.message}` },
                { status: 500 }
            );
        }

        return NextResponse.json({
            success: true,
            base_report_id: id,
            report_type: baseReport.report_type,
            total_versions: versions?.length || 0,
            versions: (versions || []).map(v => ({
                id: v.id,
                version_number: v.version_number || 1,
                is_frozen: v.is_frozen || false,
                frozen_at: v.frozen_at,
                frozen_by: v.frozen_by,
                grounding_score: v.grounding_score,
                status: v.status,
                report_category: v.report_category,
                visibility: v.visibility,
                created_at: v.created_at,
                updated_at: v.updated_at,
            })),
        });
    } catch (error) {
        console.error('Get versions error:', error);
        return NextResponse.json(
            { error: 'Error interno al obtener versiones' },
            { status: 500 }
        );
    }
}

export async function POST(
    req: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const { id } = await params;
        const body = await req.json();
        const { based_on_version, change_notes } = body as {
            based_on_version?: number;
            change_notes?: string;
        };

        // Obtener el informe fuente
        const { data: sourceReport, error: fetchError } = await supabaseAdmin
            .from('dd_reports')
            .select('*')
            .eq('id', id)
            .single();

        if (fetchError || !sourceReport) {
            return NextResponse.json(
                { error: 'Informe fuente no encontrado' },
                { status: 404 }
            );
        }

        // Calcular el numero de version mas alto existente
        let maxVersionQuery = supabaseAdmin
            .from('dd_reports')
            .select('version_number')
            .eq('report_type', sourceReport.report_type);

        if (sourceReport.request_id) {
            maxVersionQuery = maxVersionQuery.eq('request_id', sourceReport.request_id);
        } else if (sourceReport.snapshot_id) {
            maxVersionQuery = maxVersionQuery.eq('snapshot_id', sourceReport.snapshot_id);
        }

        const { data: existingVersions } = await maxVersionQuery
            .order('version_number', { ascending: false })
            .limit(1);

        const currentMaxVersion = existingVersions?.[0]?.version_number || 1;
        const newVersionNumber = currentMaxVersion + 1;

        // Determinar de que version copiar datos
        let sourceData = sourceReport;
        if (based_on_version && based_on_version !== (sourceReport.version_number || 1)) {
            let basedOnQuery = supabaseAdmin
                .from('dd_reports')
                .select('*')
                .eq('report_type', sourceReport.report_type)
                .eq('version_number', based_on_version);

            if (sourceReport.request_id) {
                basedOnQuery = basedOnQuery.eq('request_id', sourceReport.request_id);
            }

            const { data: basedOnReport } = await basedOnQuery.single();
            if (basedOnReport) {
                sourceData = basedOnReport;
            }
        }

        // Crear nueva version copiando los datos del informe fuente
        const { data: newReport, error: insertError } = await supabaseAdmin
            .from('dd_reports')
            .insert({
                request_id: sourceData.request_id,
                snapshot_id: sourceData.snapshot_id,
                report_type: sourceData.report_type,
                prompt_used: sourceData.prompt_used,
                evidence_pack: sourceData.evidence_pack,
                harvey_response: sourceData.harvey_response,
                grounding_score: sourceData.grounding_score,
                grounding_issues: sourceData.grounding_issues,
                status: sourceData.status === 'done' ? 'done' : 'pending',
                report_category: sourceData.report_category,
                version_number: newVersionNumber,
                is_frozen: false,
                frozen_at: null,
                frozen_by: null,
                visibility: sourceData.visibility,
            })
            .select()
            .single();

        if (insertError || !newReport) {
            return NextResponse.json(
                { error: `Error al crear nueva version: ${insertError?.message}` },
                { status: 500 }
            );
        }

        return NextResponse.json({
            success: true,
            message: `Version ${newVersionNumber} creada correctamente`,
            change_notes: change_notes || null,
            based_on_version: based_on_version || (sourceReport.version_number || 1),
            report: newReport,
        });
    } catch (error) {
        console.error('Create version error:', error);
        return NextResponse.json(
            { error: 'Error interno al crear nueva version' },
            { status: 500 }
        );
    }
}
