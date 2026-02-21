import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-admin';

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
        const { action, frozen_by } = body as {
            action: 'freeze' | 'unfreeze';
            frozen_by?: string;
        };

        if (!action || (action !== 'freeze' && action !== 'unfreeze')) {
            return NextResponse.json(
                { error: 'Se requiere action: "freeze" o "unfreeze"' },
                { status: 400 }
            );
        }

        // Obtener estado actual del informe
        const { data: report, error: fetchError } = await supabaseAdmin
            .from('dd_reports')
            .select('id, is_frozen, frozen_at, frozen_by, version_number, status')
            .eq('id', id)
            .single();

        if (fetchError || !report) {
            return NextResponse.json(
                { error: 'Informe no encontrado' },
                { status: 404 }
            );
        }

        if (action === 'freeze') {
            // Validar que no este ya congelado
            if (report.is_frozen) {
                return NextResponse.json(
                    {
                        error: 'Este informe ya esta congelado',
                        frozen_at: report.frozen_at,
                        frozen_by: report.frozen_by,
                    },
                    { status: 409 }
                );
            }

            // Validar que el informe este en estado completado
            if (report.status !== 'done') {
                return NextResponse.json(
                    {
                        error: 'Solo se pueden congelar informes con estado "done"',
                        current_status: report.status,
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
        if (!report.is_frozen) {
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
