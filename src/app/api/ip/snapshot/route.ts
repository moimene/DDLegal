import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-admin';

/**
 * IP Snapshot Builder
 * POST /api/ip/snapshot
 * Body: { request_id }
 *
 * Builds a point-in-time snapshot of the IP portfolio from stored marcas/disenos.
 */
export async function POST(req: NextRequest) {
    try {
        const body = await req.json();
        const { request_id } = body;

        if (!request_id) {
            return NextResponse.json({ error: 'request_id is required' }, { status: 400 });
        }

        const { data: request } = await supabaseAdmin
            .from('ip_requests')
            .select('*')
            .eq('id', request_id)
            .single();

        if (!request || !request.titular_id) {
            return NextResponse.json({ error: 'Request not found or titular not resolved' }, { status: 404 });
        }

        const { data: titular } = await supabaseAdmin
            .from('ip_titulares')
            .select('*')
            .eq('id', request.titular_id)
            .single();

        if (!titular) {
            return NextResponse.json({ error: 'Titular not found' }, { status: 404 });
        }

        // Get all marcas for this titular
        const { data: marcas } = await supabaseAdmin
            .from('ip_marcas')
            .select('*')
            .eq('titular_id', titular.id)
            .order('fecha_solicitud', { ascending: false });

        // Get all disenos for this titular
        const { data: disenos } = await supabaseAdmin
            .from('ip_disenos')
            .select('*')
            .eq('titular_id', titular.id)
            .order('fecha_solicitud', { ascending: false });

        // Build diagnostico
        const now = new Date();
        const sixMonths = new Date(now);
        sixMonths.setMonth(sixMonths.getMonth() + 6);

        // Vencimientos proximos (< 6 months)
        const vencimientosProximos = (marcas || [])
            .filter((m: Record<string, unknown>) => {
                if (!m.fecha_vencimiento) return false;
                const exp = new Date(m.fecha_vencimiento as string);
                return exp > now && exp < sixMonths;
            })
            .map((m: Record<string, unknown>) => ({
                signo: m.signo as string,
                fecha: m.fecha_vencimiento as string,
                dias_restantes: Math.ceil((new Date(m.fecha_vencimiento as string).getTime() - now.getTime()) / (1000 * 60 * 60 * 24)),
            }));

        // Gaps de cobertura — track covered Nice classes per jurisdiction
        const coveredClasses = new Map<string, Set<number>>();
        for (const m of (marcas || [])) {
            const jur = m.jurisdiccion as string;
            if (!coveredClasses.has(jur)) coveredClasses.set(jur, new Set());
            for (const c of (m.clases_niza as number[]) || []) {
                coveredClasses.get(jur)!.add(c);
            }
        }

        // Red flags
        const redFlags: Array<{ tipo: string; severidad: string; descripcion: string }> = [];

        const expiredMarks = (marcas || []).filter(
            (m: Record<string, unknown>) => m.estado_legal === 'expirada'
        );
        if (expiredMarks.length > 0) {
            redFlags.push({
                tipo: 'marcas_expiradas',
                severidad: 'high',
                descripcion: `${expiredMarks.length} marca(s) expirada(s) detectada(s)`,
            });
        }

        if (vencimientosProximos.length > 0) {
            redFlags.push({
                tipo: 'vencimientos_proximos',
                severidad: 'medium',
                descripcion: `${vencimientosProximos.length} marca(s) vence(n) en los proximos 6 meses`,
            });
        }

        if (!marcas || marcas.length === 0) {
            redFlags.push({
                tipo: 'sin_marcas',
                severidad: 'high',
                descripcion: 'No se encontraron marcas registradas para este titular',
            });
        }

        const deniedMarks = (marcas || []).filter(
            (m: Record<string, unknown>) => m.estado_legal === 'denegada'
        );
        if (deniedMarks.length > 0) {
            redFlags.push({
                tipo: 'marcas_denegadas',
                severidad: 'medium',
                descripcion: `${deniedMarks.length} marca(s) denegada(s) detectada(s)`,
            });
        }

        // Build snapshot data
        const snapshotData = {
            titular: {
                nombre: titular.nombre_oficial,
                nif: titular.nif_nie_cif,
                pais: titular.pais,
            },
            marcas: (marcas || []).map((m: Record<string, unknown>) => ({
                signo: m.signo,
                jurisdiccion: m.jurisdiccion,
                tipo: m.tipo,
                clases_niza: m.clases_niza,
                estado_legal: m.estado_legal,
                numero_expediente: m.numero_expediente,
                fecha_solicitud: m.fecha_solicitud,
                fecha_vencimiento: m.fecha_vencimiento,
                evidence_ref: m.evidence_ref || `SRC-${m.jurisdiccion}-${m.numero_expediente}`,
            })),
            disenos: (disenos || []).map((d: Record<string, unknown>) => ({
                titulo: d.titulo,
                jurisdiccion: d.jurisdiccion,
                numero_expediente: d.numero_expediente,
                estado_legal: d.estado_legal,
                fecha_vencimiento: d.fecha_vencimiento,
                evidence_ref: d.evidence_ref || `SRC-${d.jurisdiccion}-${d.numero_expediente}`,
            })),
            diagnostico: {
                vencimientos_proximos: vencimientosProximos,
                gaps_cobertura: Array.from(coveredClasses.entries()).map(([jur, classes]) => ({
                    jurisdiccion: jur,
                    clases_cubiertas: Array.from(classes).sort((a, b) => a - b),
                    total_clases: classes.size,
                })),
                incoherencias_titularidad: [],
            },
            red_flags: redFlags,
            metadata: {
                jurisdicciones_consultadas: (request.scope_jurisdicciones as string[]) || ['ES', 'EU'],
                total_marcas: (marcas || []).length,
                total_disenos: (disenos || []).length,
                fuentes_consultadas: 2,
                snapshot_date: new Date().toISOString(),
            },
        };

        // Create snapshot
        const { data: snapshot, error: snapErr } = await supabaseAdmin
            .from('ip_snapshots')
            .insert({
                ip_request_id: request_id,
                titular_id: titular.id,
                version: 1,
                data: snapshotData,
            })
            .select()
            .single();

        if (snapErr || !snapshot) {
            return NextResponse.json({ error: 'Failed to create IP snapshot' }, { status: 500 });
        }

        // Update pipeline
        await supabaseAdmin
            .from('ip_requests')
            .update({
                pipeline_step: 'snapshot_built',
                updated_at: new Date().toISOString(),
            })
            .eq('id', request_id);

        return NextResponse.json({
            success: true,
            snapshot_id: snapshot.id,
            summary: {
                marcas: (marcas || []).length,
                disenos: (disenos || []).length,
                red_flags: redFlags.length,
                vencimientos_proximos: vencimientosProximos.length,
            },
        });

    } catch (error) {
        console.error('IP snapshot error:', error);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}
