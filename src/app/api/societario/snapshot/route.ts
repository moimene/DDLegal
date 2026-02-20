import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-admin';

/**
 * Snapshot Builder
 * POST /api/societario/snapshot
 * Body: { request_id }
 *
 * Builds a point-in-time snapshot of the company state from BORME data
 * and governance roles. Detects red flags automatically.
 */
export async function POST(req: NextRequest) {
    try {
        const body = await req.json();
        const { request_id } = body;

        if (!request_id) {
            return NextResponse.json({ error: 'request_id is required' }, { status: 400 });
        }

        // Get the request with sociedad
        const { data: request, error: reqErr } = await supabaseAdmin
            .from('dd_requests')
            .select('*')
            .eq('id', request_id)
            .single();

        if (reqErr || !request) {
            return NextResponse.json({ error: 'Request not found' }, { status: 404 });
        }

        if (!request.sociedad_id) {
            return NextResponse.json(
                { error: 'Identity must be resolved before building snapshot' },
                { status: 400 }
            );
        }

        // Get sociedad details
        const { data: sociedad } = await supabaseAdmin
            .from('sociedades')
            .select('*')
            .eq('id', request.sociedad_id)
            .single();

        if (!sociedad) {
            return NextResponse.json({ error: 'Sociedad not found' }, { status: 404 });
        }

        // Get BORME announcements for this sociedad within periodo
        const periodoAnios = request.periodo_anios || 5;
        const dateFrom = new Date();
        dateFrom.setFullYear(dateFrom.getFullYear() - periodoAnios);

        const { data: announcements } = await supabaseAdmin
            .from('borme_announcements')
            .select('*')
            .eq('sociedad_id', sociedad.id)
            .gte('borme_date', dateFrom.toISOString().split('T')[0])
            .order('borme_date', { ascending: true });

        // Get governance roles
        const { data: roles } = await supabaseAdmin
            .from('governance_roles')
            .select('*, persona:personas(nombre_completo, nif, tipo)')
            .eq('sociedad_id', sociedad.id)
            .order('fecha_inicio', { ascending: false });

        // Build structured snapshot sections
        const datosGenerales = {
            denominacion: sociedad.denominacion,
            nif: sociedad.nif,
            domicilio: sociedad.domicilio,
            objeto_social: sociedad.objeto_social,
            capital_social: sociedad.capital_social,
            moneda: sociedad.moneda,
            organo_admin: sociedad.organo_admin,
            fecha_constitucion: sociedad.fecha_constitucion,
        };

        // Current administrators
        const currentRoles = (roles || []).filter((r: Record<string, unknown>) => r.is_current);
        const administradores = currentRoles.map((r: Record<string, unknown>) => {
            const persona = r.persona as Record<string, unknown> | null;
            return {
                nombre: persona?.nombre_completo || 'Desconocido',
                nif: persona?.nif || null,
                cargo: r.cargo,
                fecha_inicio: r.fecha_inicio,
                borme_announcement_id: r.borme_announcement_id,
            };
        });

        // Extract apoderamientos from BORME
        const apoderamientos = (announcements || [])
            .filter((a: Record<string, unknown>) =>
                a.tipo_acto === 'PODER_GENERAL' || a.tipo_acto === 'PODER_ESPECIAL'
            )
            .map((a: Record<string, unknown>) => ({
                tipo: a.tipo_acto,
                fecha: a.borme_date,
                raw_text: a.raw_text,
                source_url: a.source_url,
            }));

        // Extract modifications (non-governance, non-poder)
        const modificationTypes = [
            'AMPLIACION_CAPITAL', 'REDUCCION_CAPITAL', 'CAMBIO_DOMICILIO',
            'CAMBIO_OBJETO', 'CAMBIO_DENOMINACION', 'FUSION', 'ESCISION',
            'TRANSFORMACION', 'DISOLUCION', 'LIQUIDACION',
        ];
        const modificaciones = (announcements || [])
            .filter((a: Record<string, unknown>) => modificationTypes.includes(a.tipo_acto as string))
            .map((a: Record<string, unknown>) => ({
                tipo: a.tipo_acto,
                fecha: a.borme_date,
                raw_text: a.raw_text,
                source_url: a.source_url,
            }));

        // Capital history
        const capitalHistory = (announcements || [])
            .filter((a: Record<string, unknown>) =>
                a.tipo_acto === 'AMPLIACION_CAPITAL' || a.tipo_acto === 'REDUCCION_CAPITAL'
            )
            .map((a: Record<string, unknown>) => ({
                tipo: a.tipo_acto,
                fecha: a.borme_date,
                raw_text: a.raw_text,
            }));

        // Full timeline
        const timelineEventos = (announcements || []).map((a: Record<string, unknown>) => ({
            fecha: a.borme_date,
            tipo_acto: a.tipo_acto,
            descripcion: a.raw_text,
            source_url: a.source_url,
            borme_code: a.borme_code,
        }));

        // ---- Red Flags Detection ----
        const redFlags: Array<{ tipo: string; severidad: string; descripcion: string }> = [];

        // RF1: Expired mandates (>6 years without reelection)
        for (const r of currentRoles) {
            if (r.fecha_inicio) {
                const start = new Date(r.fecha_inicio as string);
                const years = (Date.now() - start.getTime()) / (1000 * 60 * 60 * 24 * 365.25);
                if (years > 6) {
                    const persona = r.persona as Record<string, unknown> | null;
                    redFlags.push({
                        tipo: 'mandato_expirado',
                        severidad: 'high',
                        descripcion: `Mandato de ${persona?.nombre_completo || 'desconocido'} (${r.cargo}) posiblemente expirado: ${Math.floor(years)} años sin reelección registrada`,
                    });
                }
            }
        }

        // RF2: Frequent admin changes (>3 changes in last 2 years)
        const twoYearsAgo = new Date();
        twoYearsAgo.setFullYear(twoYearsAgo.getFullYear() - 2);
        const recentAdminChanges = (announcements || []).filter((a: Record<string, unknown>) =>
            (a.tipo_acto === 'NOMBRAMIENTO_ADMIN' || a.tipo_acto === 'CESE_ADMIN') &&
            new Date(a.borme_date as string) > twoYearsAgo
        );
        if (recentAdminChanges.length > 3) {
            redFlags.push({
                tipo: 'cambios_frecuentes',
                severidad: 'medium',
                descripcion: `${recentAdminChanges.length} cambios en órgano de administración en los últimos 2 años`,
            });
        }

        // RF3: Situación concursal
        const concursalItems = (announcements || []).filter((a: Record<string, unknown>) =>
            a.tipo_acto === 'SITUACION_CONCURSAL'
        );
        if (concursalItems.length > 0) {
            redFlags.push({
                tipo: 'situacion_concursal',
                severidad: 'critical',
                descripcion: `Situación concursal registrada en BORME (${concursalItems.length} inscripción${concursalItems.length > 1 ? 'es' : ''})`,
            });
        }

        // RF4: Dissolution/Liquidation
        const disolutionItems = (announcements || []).filter((a: Record<string, unknown>) =>
            a.tipo_acto === 'DISOLUCION' || a.tipo_acto === 'LIQUIDACION'
        );
        if (disolutionItems.length > 0) {
            redFlags.push({
                tipo: 'disolucion_liquidacion',
                severidad: 'critical',
                descripcion: `Disolución/liquidación registrada en BORME`,
            });
        }

        // RF5: No admin data
        if (currentRoles.length === 0) {
            redFlags.push({
                tipo: 'sin_administradores',
                severidad: 'high',
                descripcion: 'No se encontraron administradores vigentes en los registros',
            });
        }

        // Create snapshot
        const { data: snapshot, error: snapErr } = await supabaseAdmin
            .from('dd_snapshots')
            .insert({
                request_id,
                sociedad_id: sociedad.id,
                snapshot_date: new Date().toISOString().split('T')[0],
                datos_generales: datosGenerales,
                administradores,
                apoderamientos,
                modificaciones,
                capital_history: capitalHistory,
                timeline_eventos: timelineEventos,
                red_flags: redFlags,
                metadata: {
                    periodo_anios: periodoAnios,
                    total_announcements: (announcements || []).length,
                    total_roles: (roles || []).length,
                },
            })
            .select()
            .single();

        if (snapErr || !snapshot) {
            console.error('Snapshot creation error:', snapErr);
            return NextResponse.json(
                { error: 'Failed to create snapshot' },
                { status: 500 }
            );
        }

        // Update request
        await supabaseAdmin
            .from('dd_requests')
            .update({
                pipeline_step: 'snapshot_built',
                updated_at: new Date().toISOString(),
            })
            .eq('id', request_id);

        return NextResponse.json({
            success: true,
            snapshot_id: snapshot.id,
            summary: {
                administradores: administradores.length,
                apoderamientos: apoderamientos.length,
                modificaciones: modificaciones.length,
                timeline_events: timelineEventos.length,
                red_flags: redFlags.length,
                capital_changes: capitalHistory.length,
            },
        });

    } catch (error) {
        console.error('Snapshot error:', error);
        return NextResponse.json(
            { error: 'Internal server error' },
            { status: 500 }
        );
    }
}
