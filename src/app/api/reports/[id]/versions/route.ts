import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { requirePermission } from '@/lib/auth/require-permission';
import {
    buildDDReportsSelect,
    getDDReportsColumnSet,
    hasDDReportsColumns,
} from '@/lib/reports/schema-compat';

/**
 * GET  /api/reports/[id]/versions — Lista todas las versiones de un informe
 * POST /api/reports/[id]/versions — Crea nueva version a partir del informe actual
 */

const VERSION_COLUMN = ['version_number'] as const;
const FREEZE_COLUMNS = ['is_frozen', 'frozen_at', 'frozen_by'] as const;
const REPORT_META_OPTIONAL_COLUMNS = ['report_category', 'visibility'] as const;
const VERSION_LIST_OPTIONAL_COLUMNS = [
    ...VERSION_COLUMN,
    ...FREEZE_COLUMNS,
    ...REPORT_META_OPTIONAL_COLUMNS,
] as const;

type ReportRow = Record<string, unknown>;

function toNumber(value: unknown): number | null {
    if (typeof value === 'number' && Number.isFinite(value)) return value;
    if (typeof value === 'string') {
        const parsed = Number(value);
        if (Number.isFinite(parsed)) return parsed;
    }
    return null;
}

function toStringOrNull(value: unknown): string | null {
    return typeof value === 'string' ? value : null;
}

function toVersionItem(row: ReportRow, fallbackVersion: number) {
    return {
        id: toStringOrNull(row.id) || '',
        version_number: toNumber(row.version_number) ?? fallbackVersion,
        is_frozen: Boolean(row.is_frozen ?? false),
        frozen_at: toStringOrNull(row.frozen_at),
        frozen_by: toStringOrNull(row.frozen_by),
        grounding_score: toNumber(row.grounding_score) ?? 0,
        status: toStringOrNull(row.status) || 'pending',
        report_category: toStringOrNull(row.report_category),
        visibility: toStringOrNull(row.visibility),
        created_at: toStringOrNull(row.created_at) || '',
        updated_at: toStringOrNull(row.updated_at) || '',
    };
}

export async function GET(
    req: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const { id } = await params;

        // Permission check — require can_view_reports when project_id is provided
        const projectId = req.nextUrl.searchParams.get('project_id');
        if (projectId) {
            const { authorized, error: authError } = await requirePermission(req, projectId, 'can_view_reports');
            if (!authorized) return authError!;
        }

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

        const reportColumns = await getDDReportsColumnSet();
        const hasVersionNumber = hasDDReportsColumns(reportColumns, VERSION_COLUMN);

        // Buscar todas las versiones con el mismo report_type y request_id/snapshot_id
        const listSelect = buildDDReportsSelect(
            ['id', 'grounding_score', 'status', 'report_type', 'created_at', 'updated_at'],
            VERSION_LIST_OPTIONAL_COLUMNS,
            reportColumns,
        );

        let query = supabaseAdmin
            .from('dd_reports')
            .select(listSelect)
            .eq('report_type', baseReport.report_type);

        // Filtrar por request_id si existe para agrupar versiones del mismo informe
        if (baseReport.request_id) {
            query = query.eq('request_id', baseReport.request_id);
        } else if (baseReport.snapshot_id) {
            query = query.eq('snapshot_id', baseReport.snapshot_id);
        }

        const orderedQuery = hasVersionNumber
            ? query.order('version_number', { ascending: true })
            : query.order('created_at', { ascending: true });

        const { data: versions, error: versionsError } = await orderedQuery;

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
            versioning_supported: hasVersionNumber,
            versions: (versions || []).map((v, index) =>
                toVersionItem(
                    v as unknown as ReportRow,
                    hasVersionNumber ? (toNumber((v as unknown as ReportRow).version_number) ?? (index + 1)) : (index + 1),
                ),
            ),
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
        const { based_on_version, change_notes, project_id } = body as {
            based_on_version?: number;
            change_notes?: string;
            project_id?: string;
        };

        // Permission check — require can_view_reports when project_id is provided
        if (project_id) {
            const { authorized, error: authError } = await requirePermission(req, project_id, 'can_view_reports');
            if (!authorized) return authError!;
        }

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

        const reportColumns = await getDDReportsColumnSet();
        const hasVersionNumber = hasDDReportsColumns(reportColumns, VERSION_COLUMN);
        const sourceData = sourceReport as unknown as ReportRow;

        // Calcular el numero de version mas alto existente (fallback por conteo si no existe version_number)
        let currentMaxVersion = 1;
        if (hasVersionNumber) {
            let maxVersionQuery = supabaseAdmin
                .from('dd_reports')
                .select('version_number')
                .eq('report_type', sourceData.report_type as string);

            if (sourceData.request_id) {
                maxVersionQuery = maxVersionQuery.eq('request_id', sourceData.request_id as string);
            } else if (sourceData.snapshot_id) {
                maxVersionQuery = maxVersionQuery.eq('snapshot_id', sourceData.snapshot_id as string);
            }

            const { data: existingVersions } = await maxVersionQuery
                .order('version_number', { ascending: false })
                .limit(1);

            currentMaxVersion = toNumber(existingVersions?.[0]?.version_number) ?? 1;
        } else {
            let countQuery = supabaseAdmin
                .from('dd_reports')
                .select('id', { count: 'exact', head: true })
                .eq('report_type', sourceData.report_type as string);

            if (sourceData.request_id) {
                countQuery = countQuery.eq('request_id', sourceData.request_id as string);
            } else if (sourceData.snapshot_id) {
                countQuery = countQuery.eq('snapshot_id', sourceData.snapshot_id as string);
            }

            const { count, error: countError } = await countQuery;
            if (countError) {
                return NextResponse.json(
                    { error: `Error al calcular version actual: ${countError.message}` },
                    { status: 500 }
                );
            }

            currentMaxVersion = Math.max(count ?? 1, 1);
        }

        const newVersionNumber = currentMaxVersion + 1;

        // Determinar de que version copiar datos
        let sourceVersionData = sourceData;
        const sourceCurrentVersion = toNumber(sourceData.version_number) ?? 1;

        if (based_on_version && based_on_version > 0 && based_on_version !== sourceCurrentVersion) {
            if (hasVersionNumber) {
                let basedOnQuery = supabaseAdmin
                    .from('dd_reports')
                    .select('*')
                    .eq('report_type', sourceData.report_type as string)
                    .eq('version_number', based_on_version);

                if (sourceData.request_id) {
                    basedOnQuery = basedOnQuery.eq('request_id', sourceData.request_id as string);
                } else if (sourceData.snapshot_id) {
                    basedOnQuery = basedOnQuery.eq('snapshot_id', sourceData.snapshot_id as string);
                }

                const { data: basedOnReport } = await basedOnQuery.single();
                if (basedOnReport) {
                    sourceVersionData = basedOnReport as unknown as ReportRow;
                }
            } else {
                let basedOnQuery = supabaseAdmin
                    .from('dd_reports')
                    .select('*')
                    .eq('report_type', sourceData.report_type as string)
                    .order('created_at', { ascending: true });

                if (sourceData.request_id) {
                    basedOnQuery = basedOnQuery.eq('request_id', sourceData.request_id as string);
                } else if (sourceData.snapshot_id) {
                    basedOnQuery = basedOnQuery.eq('snapshot_id', sourceData.snapshot_id as string);
                }

                const { data: basedOnReports } = await basedOnQuery;
                const candidate = basedOnReports?.[based_on_version - 1] as unknown as ReportRow | undefined;
                if (candidate) {
                    sourceVersionData = candidate;
                }
            }
        }

        const insertPayload: ReportRow = {
            request_id: sourceVersionData.request_id ?? null,
            snapshot_id: sourceVersionData.snapshot_id ?? null,
            report_type: sourceVersionData.report_type ?? null,
            prompt_used: sourceVersionData.prompt_used ?? null,
            evidence_pack: sourceVersionData.evidence_pack ?? {},
            harvey_response: sourceVersionData.harvey_response ?? {},
            grounding_score: sourceVersionData.grounding_score ?? 0,
            grounding_issues: sourceVersionData.grounding_issues ?? [],
            status: sourceVersionData.status === 'done' ? 'done' : 'pending',
        };

        if (reportColumns.has('report_category')) {
            insertPayload.report_category = sourceVersionData.report_category ?? 'transactional';
        }
        if (reportColumns.has('visibility')) {
            insertPayload.visibility = sourceVersionData.visibility ?? 'internal';
        }
        if (reportColumns.has('version_number')) {
            insertPayload.version_number = newVersionNumber;
        }
        if (reportColumns.has('is_frozen')) {
            insertPayload.is_frozen = false;
        }
        if (reportColumns.has('frozen_at')) {
            insertPayload.frozen_at = null;
        }
        if (reportColumns.has('frozen_by')) {
            insertPayload.frozen_by = null;
        }

        // Crear nueva version copiando los datos del informe fuente
        const { data: newReport, error: insertError } = await supabaseAdmin
            .from('dd_reports')
            .insert(insertPayload)
            .select()
            .single();

        if (insertError || !newReport) {
            return NextResponse.json(
                { error: `Error al crear nueva version: ${insertError?.message}` },
                { status: 500 }
            );
        }

        const compatibleNewReport = {
            ...(newReport as unknown as ReportRow),
            version_number: reportColumns.has('version_number')
                ? (toNumber((newReport as unknown as ReportRow).version_number) ?? newVersionNumber)
                : newVersionNumber,
            is_frozen: reportColumns.has('is_frozen')
                ? Boolean((newReport as unknown as ReportRow).is_frozen ?? false)
                : false,
            frozen_at: reportColumns.has('frozen_at')
                ? toStringOrNull((newReport as unknown as ReportRow).frozen_at)
                : null,
            frozen_by: reportColumns.has('frozen_by')
                ? toStringOrNull((newReport as unknown as ReportRow).frozen_by)
                : null,
        };

        return NextResponse.json({
            success: true,
            message: `Version ${newVersionNumber} creada correctamente`,
            change_notes: change_notes || null,
            based_on_version: based_on_version || sourceCurrentVersion,
            versioning_supported: hasVersionNumber,
            report: compatibleNewReport,
        });
    } catch (error) {
        console.error('Create version error:', error);
        return NextResponse.json(
            { error: 'Error interno al crear nueva version' },
            { status: 500 }
        );
    }
}
