import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { requirePermission } from '@/lib/auth/require-permission';
import {
    buildDDReportsSelect,
    getDDReportsColumnSet,
    hasDDReportsColumns,
} from '@/lib/reports/schema-compat';

/**
 * POST /api/reports/[id]/freeze
 * Body: { action: 'freeze' | 'unfreeze', frozen_by?: string }
 *
 * Congela o descongela un informe.
 * - freeze: Marca is_frozen=true, frozen_at=now(), frozen_by
 * - unfreeze: Marca is_frozen=false, limpia frozen_at y frozen_by
 */
export async function POST(
    req: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const { id } = await params;
        const body = await req.json();
        const { action, frozen_by, project_id } = body as {
            action: 'freeze' | 'unfreeze';
            frozen_by?: string;
            project_id?: string;
        };

        // Permission check — require can_approve_reports when project_id is provided
        if (project_id) {
            const { authorized, error: authError } = await requirePermission(req, project_id, 'can_approve_reports');
            if (!authorized) return authError!;
        }

        if (!action || (action !== 'freeze' && action !== 'unfreeze')) {
            return NextResponse.json(
                { error: 'Se requiere action: "freeze" o "unfreeze"' },
                { status: 400 }
            );
        }

        const reportColumns = await getDDReportsColumnSet();
        const supportsFreeze = hasDDReportsColumns(reportColumns, ['is_frozen', 'frozen_at', 'frozen_by']);

        if (!supportsFreeze) {
            return NextResponse.json(
                {
                    error: 'El esquema actual de dd_reports no soporta congelacion de informes',
                    code: 'freeze_not_supported',
                    required_columns: ['is_frozen', 'frozen_at', 'frozen_by'],
                },
                { status: 409 }
            );
        }

        const selectColumns = buildDDReportsSelect(
            ['id', 'status'],
            ['is_frozen', 'frozen_at', 'frozen_by', 'version_number'],
            reportColumns,
        );

        // Obtener estado actual del informe
        const { data: report, error: fetchError } = await supabaseAdmin
            .from('dd_reports')
            .select(selectColumns)
            .eq('id', id)
            .single();

        if (fetchError || !report) {
            return NextResponse.json(
                { error: 'Informe no encontrado' },
                { status: 404 }
            );
        }

        const reportRow = report as unknown as Record<string, unknown>;
        const isFrozen = Boolean(reportRow.is_frozen ?? false);

        if (action === 'freeze') {
            // Validar que no este ya congelado
            if (isFrozen) {
                return NextResponse.json(
                    {
                        error: 'Este informe ya esta congelado',
                        frozen_at: reportRow.frozen_at ?? null,
                        frozen_by: reportRow.frozen_by ?? null,
                    },
                    { status: 409 }
                );
            }

            // Validar que el informe este en estado completado
            if (reportRow.status !== 'done') {
                return NextResponse.json(
                    {
                        error: 'Solo se pueden congelar informes con estado "done"',
                        current_status: reportRow.status,
                    },
                    { status: 400 }
                );
            }

            const { data: updated, error: updateError } = await supabaseAdmin
                .from('dd_reports')
                .update({
                    is_frozen: true,
                    frozen_at: new Date().toISOString(),
                    frozen_by: frozen_by || null,
                    updated_at: new Date().toISOString(),
                })
                .eq('id', id)
                .select()
                .single();

            if (updateError) {
                return NextResponse.json(
                    { error: `Error al congelar: ${updateError.message}` },
                    { status: 500 }
                );
            }

            return NextResponse.json({
                success: true,
                action: 'freeze',
                report: updated,
                message: 'Informe congelado correctamente',
            });
        }

        // action === 'unfreeze'
        if (!isFrozen) {
            return NextResponse.json(
                { error: 'Este informe no esta congelado' },
                { status: 409 }
            );
        }

        // Nota: En produccion, verificar que el usuario tenga rol CLO o PM
        // antes de permitir descongelar. Por ahora se incluye como nota.
        const { data: updated, error: updateError } = await supabaseAdmin
            .from('dd_reports')
            .update({
                is_frozen: false,
                frozen_at: null,
                frozen_by: null,
                updated_at: new Date().toISOString(),
            })
            .eq('id', id)
            .select()
            .single();

        if (updateError) {
            return NextResponse.json(
                { error: `Error al descongelar: ${updateError.message}` },
                { status: 500 }
            );
        }

        return NextResponse.json({
            success: true,
            action: 'unfreeze',
            report: updated,
            message: 'Informe descongelado correctamente. Nota: solo roles CLO/PM deberian poder descongelar.',
        });
    } catch (error) {
        console.error('Freeze/unfreeze error:', error);
        return NextResponse.json(
            { error: 'Error interno al procesar la solicitud de congelacion' },
            { status: 500 }
        );
    }
}
