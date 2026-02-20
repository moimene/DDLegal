import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-admin';

/**
 * Negotiation Alerts System
 * GET   /api/alerts/negotiation?request_id=xxx — list alerts
 * POST  /api/alerts/negotiation — scan and create alerts from red flags
 * PATCH /api/alerts/negotiation — acknowledge/resolve alert
 *
 * Auto-detects critical points during DD that impact negotiation:
 * - Critical red flags in snapshots
 * - Concursal/dissolution situations
 * - Expired admin mandates
 * - CoC/consent clauses (future: from contract analysis)
 */

export async function GET(req: NextRequest) {
    const { searchParams } = new URL(req.url);
    const requestId = searchParams.get('request_id');
    const projectId = searchParams.get('project_id');
    const status = searchParams.get('status');

    let query = supabaseAdmin
        .from('dd_negotiation_alerts')
        .select('*')
        .order('created_at', { ascending: false });

    if (requestId) query = query.eq('request_id', requestId);
    if (projectId) query = query.eq('project_id', projectId);
    if (status) query = query.eq('status', status);

    const { data: alerts, error } = await query;

    if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }

    const pendingCount = (alerts || []).filter(a => a.status === 'new').length;

    return NextResponse.json({
        success: true,
        alerts: alerts || [],
        pending_count: pendingCount,
        total: (alerts || []).length,
    });
}

export async function POST(req: NextRequest) {
    try {
        const body = await req.json();
        const { request_id, project_id } = body;

        if (!request_id) {
            return NextResponse.json({ error: 'request_id is required' }, { status: 400 });
        }

        const newAlerts: Array<{
            request_id: string;
            project_id?: string;
            alert_type: string;
            severity: string;
            titulo: string;
            impacto_negociacion: string;
            evidencia: string[];
            recomendacion: string;
            area_code: string;
            status: string;
        }> = [];

        // Scan DD snapshots for critical red flags
        const { data: snapshots } = await supabaseAdmin
            .from('dd_snapshots')
            .select('id, red_flags, datos_generales, administradores')
            .eq('request_id', request_id);

        for (const snap of (snapshots || [])) {
            const redFlags = (snap.red_flags as Array<Record<string, unknown>>) || [];
            const datosGen = snap.datos_generales as Record<string, unknown>;
            const sociedad = (datosGen?.denominacion as string) || '';

            for (const flag of redFlags) {
                const severidad = (flag.severidad as string) || 'medium';
                const tipo = (flag.tipo as string) || '';

                // Critical red flags generate alerts
                if (severidad === 'critical' || severidad === 'high') {
                    newAlerts.push({
                        request_id,
                        project_id,
                        alert_type: tipo,
                        severity: severidad,
                        titulo: `${sociedad}: ${flag.descripcion || tipo}`,
                        impacto_negociacion: getImpactoNegociacion(tipo),
                        evidencia: (flag.evidence_refs as string[]) || [],
                        recomendacion: getRecomendacion(tipo),
                        area_code: 'MERC',
                        status: 'new',
                    });
                }

                // Specific triggers
                if (tipo === 'situacion_concursal') {
                    newAlerts.push({
                        request_id,
                        project_id,
                        alert_type: 'concursal_detectado',
                        severity: 'critical',
                        titulo: `${sociedad}: Situacion concursal detectada`,
                        impacto_negociacion: 'La situacion concursal puede impedir o condicionar la transaccion. Requiere analisis de viabilidad.',
                        evidencia: (flag.evidence_refs as string[]) || [],
                        recomendacion: 'Solicitar informe detallado del estado concursal. Evaluar condiciones precedentes en SPA.',
                        area_code: 'MERC',
                        status: 'new',
                    });
                }

                if (tipo === 'disolucion') {
                    newAlerts.push({
                        request_id,
                        project_id,
                        alert_type: 'disolucion_detectada',
                        severity: 'critical',
                        titulo: `${sociedad}: Proceso de disolucion detectado`,
                        impacto_negociacion: 'La sociedad esta en proceso de disolucion. La transaccion puede no ser viable.',
                        evidencia: (flag.evidence_refs as string[]) || [],
                        recomendacion: 'Verificar estado actual y evaluar viabilidad de la operacion.',
                        area_code: 'MERC',
                        status: 'new',
                    });
                }

                if (tipo === 'mandato_expirado') {
                    newAlerts.push({
                        request_id,
                        project_id,
                        alert_type: 'mandato_expirado',
                        severity: 'high',
                        titulo: `${sociedad}: Mandato de administrador expirado`,
                        impacto_negociacion: 'Administrador con mandato potencialmente expirado. Puede afectar la validez de actos otorgados.',
                        evidencia: (flag.evidence_refs as string[]) || [],
                        recomendacion: 'Incluir regularizacion del organo de administracion como condicion precedente.',
                        area_code: 'MERC',
                        status: 'new',
                    });
                }
            }
        }

        // Scan IP snapshots for red flags
        const { data: ipSnapshots } = await supabaseAdmin
            .from('ip_snapshots')
            .select('id, data')
            .eq('ip_request_id', request_id);

        for (const ipSnap of (ipSnapshots || [])) {
            const data = ipSnap.data as Record<string, unknown>;
            const ipRedFlags = (data?.red_flags as Array<Record<string, unknown>>) || [];
            const titular = (data?.titular as Record<string, unknown>);
            const titularNombre = (titular?.nombre as string) || '';

            for (const flag of ipRedFlags) {
                const severidad = (flag.severidad as string) || 'medium';
                if (severidad === 'high' || severidad === 'critical') {
                    newAlerts.push({
                        request_id,
                        project_id,
                        alert_type: (flag.tipo as string) || 'ip_risk',
                        severity: severidad,
                        titulo: `IP — ${titularNombre}: ${flag.descripcion || ''}`,
                        impacto_negociacion: 'Riesgo de propiedad industrial que puede afectar la valoracion o condiciones de la transaccion.',
                        evidencia: [],
                        recomendacion: 'Evaluar impacto en la valoracion y considerar R&W especificas sobre PI.',
                        area_code: 'PI',
                        status: 'new',
                    });
                }
            }
        }

        // Deduplicate by alert_type + request_id
        const { data: existingAlerts } = await supabaseAdmin
            .from('dd_negotiation_alerts')
            .select('alert_type, titulo')
            .eq('request_id', request_id);

        const existingKeys = new Set(
            (existingAlerts || []).map(a => `${a.alert_type}:${a.titulo}`)
        );

        const uniqueAlerts = newAlerts.filter(
            a => !existingKeys.has(`${a.alert_type}:${a.titulo}`)
        );

        // Insert new alerts
        let insertedCount = 0;
        if (uniqueAlerts.length > 0) {
            const { error } = await supabaseAdmin
                .from('dd_negotiation_alerts')
                .insert(uniqueAlerts);

            if (!error) {
                insertedCount = uniqueAlerts.length;
            }
        }

        return NextResponse.json({
            success: true,
            scanned: {
                snapshots: (snapshots || []).length,
                ip_snapshots: (ipSnapshots || []).length,
            },
            alerts_found: newAlerts.length,
            alerts_new: insertedCount,
            alerts_duplicate: newAlerts.length - insertedCount,
        });

    } catch (error) {
        console.error('Negotiation alerts error:', error);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}

export async function PATCH(req: NextRequest) {
    try {
        const body = await req.json();
        const { alert_id, status } = body;

        if (!alert_id || !status) {
            return NextResponse.json({ error: 'alert_id and status are required' }, { status: 400 });
        }

        if (!['new', 'acknowledged', 'resolved'].includes(status)) {
            return NextResponse.json({ error: 'status must be new, acknowledged, or resolved' }, { status: 400 });
        }

        const updateData: Record<string, unknown> = {
            status,
            updated_at: new Date().toISOString(),
        };

        if (status === 'resolved') {
            updateData.resolved_at = new Date().toISOString();
        }

        const { data, error } = await supabaseAdmin
            .from('dd_negotiation_alerts')
            .update(updateData)
            .eq('id', alert_id)
            .select()
            .single();

        if (error) {
            return NextResponse.json({ error: error.message }, { status: 500 });
        }

        return NextResponse.json({ success: true, alert: data });

    } catch (error) {
        console.error('Negotiation alert update error:', error);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}

// Helper functions
function getImpactoNegociacion(tipo: string): string {
    const impactos: Record<string, string> = {
        situacion_concursal: 'Puede impedir o condicionar gravemente la transaccion.',
        disolucion: 'Sociedad en proceso de disolucion. Transaccion potencialmente inviable.',
        mandato_expirado: 'Actos otorgados por administrador con mandato expirado pueden ser impugnados.',
        cambios_frecuentes_admin: 'Inestabilidad en el organo de administracion. Evaluar governance risk.',
        sin_administradores: 'Sociedad sin administradores vigentes. No puede otorgar actos validos.',
    };
    return impactos[tipo] || 'Punto relevante identificado durante la DD que puede impactar la negociacion.';
}

function getRecomendacion(tipo: string): string {
    const recomendaciones: Record<string, string> = {
        situacion_concursal: 'Solicitar informe concursal detallado. Incluir condicion precedente en SPA.',
        disolucion: 'Verificar estado actual y evaluar viabilidad. Considerar operacion de rescate.',
        mandato_expirado: 'Incluir regularizacion del organo de administracion como condicion precedente.',
        cambios_frecuentes_admin: 'Solicitar aclaraciones sobre cambios. Evaluar R&W sobre continuidad de gestion.',
        sin_administradores: 'Exigir nombramiento de administradores antes de cualquier negociacion.',
    };
    return recomendaciones[tipo] || 'Evaluar impacto en la negociacion y considerar condiciones adicionales en SPA.';
}
