import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-admin';

/**
 * IP Radar — Registry Search (OEPM + EUIPO)
 * POST /api/ip/search
 * Body: { request_id, titular_id }
 *
 * Searches trademark registries and upserts results into ip_marcas.
 */

interface TrademarkResult {
    signo: string;
    tipo: string;
    jurisdiccion: string;
    clases_niza: number[];
    estado_legal: string;
    numero_expediente: string;
    fecha_solicitud: string | null;
    fecha_concesion: string | null;
    fecha_vencimiento: string | null;
    source_url: string;
}

// EUIPO eSearch+ API Gateway
async function searchEUIPO(holderName: string): Promise<TrademarkResult[]> {
    const results: TrademarkResult[] = [];

    try {
        const searchUrl = `https://search.euipo.europa.eu/api/v2/trademarks?applicantName=${encodeURIComponent(holderName)}&pageSize=50&sort=applicationDate:desc`;

        const resp = await fetch(searchUrl, {
            headers: {
                'Accept': 'application/json',
                'User-Agent': 'DD-Legal-PMO/1.0',
            },
            signal: AbortSignal.timeout(15000),
        });

        if (resp.ok) {
            const text = await resp.text();
            try {
                const data = JSON.parse(text);
                const items = data?.trademarks || data?.results || data?.items || data?.content || [];

                for (const item of Array.isArray(items) ? items : []) {
                    results.push({
                        signo: item.wordElement || item.markName || item.denomination || '',
                        tipo: (item.markType || item.trademarkType || 'denominativa').toLowerCase(),
                        jurisdiccion: 'EU',
                        clases_niza: parseNizaClasses(item.niceClasses || item.goodsAndServicesClasses || ''),
                        estado_legal: mapEUIPOStatus(item.status || item.markStatus || ''),
                        numero_expediente: item.applicationNumber || item.registrationNumber || '',
                        fecha_solicitud: item.applicationDate || null,
                        fecha_concesion: item.registrationDate || null,
                        fecha_vencimiento: item.expiryDate || null,
                        source_url: `https://euipo.europa.eu/eSearch/#details/trademarks/${item.applicationNumber || ''}`,
                    });
                }
            } catch {
                console.warn('EUIPO returned non-JSON response');
            }
        }
    } catch (error) {
        console.error('EUIPO search error:', error);
    }

    return results;
}

// OEPM Localizador de Marcas Gateway (public search)
async function searchOEPM(holderName: string): Promise<TrademarkResult[]> {
    const results: TrademarkResult[] = [];

    try {
        const searchUrl = `https://consultas2.oepm.es/LocalizadorWeb/BusquedaMarcas?denominacion=${encodeURIComponent(holderName)}&formato=json`;

        const resp = await fetch(searchUrl, {
            headers: {
                'Accept': 'application/json',
                'User-Agent': 'DD-Legal-PMO/1.0',
            },
            signal: AbortSignal.timeout(15000),
        });

        if (resp.ok) {
            const text = await resp.text();
            try {
                const data = JSON.parse(text);
                const items = data?.marcas || data?.results || data?.items || [];

                for (const item of Array.isArray(items) ? items : []) {
                    results.push({
                        signo: item.denominacion || item.marca || item.nombre || '',
                        tipo: (item.tipo || 'denominativa').toLowerCase(),
                        jurisdiccion: 'ES',
                        clases_niza: parseNizaClasses(item.clases || item.clasesNiza || ''),
                        estado_legal: mapOEPMStatus(item.situacion || item.estado || ''),
                        numero_expediente: item.expediente || item.numero || '',
                        fecha_solicitud: item.fechaSolicitud || null,
                        fecha_concesion: item.fechaConcesion || null,
                        fecha_vencimiento: item.fechaVencimiento || null,
                        source_url: `https://consultas2.oepm.es/LocalizadorWeb/DetalleExpediente?expediente=${item.expediente || ''}`,
                    });
                }
            } catch {
                // Response may be HTML, not JSON
                console.warn('OEPM returned non-JSON response');
            }
        }
    } catch (error) {
        console.error('OEPM search error:', error);
    }

    return results;
}

function mapEUIPOStatus(status: string): string {
    const lower = status.toLowerCase();
    if (lower.includes('registered') || lower.includes('registr')) return 'registrada';
    if (lower.includes('filed') || lower.includes('solicit')) return 'solicitada';
    if (lower.includes('expired') || lower.includes('expir')) return 'expirada';
    if (lower.includes('refused') || lower.includes('deneg')) return 'denegada';
    if (lower.includes('withdrawn') || lower.includes('retir')) return 'retirada';
    if (lower.includes('opposed') || lower.includes('opos')) return 'opuesta';
    if (lower.includes('cancelled') || lower.includes('anul')) return 'anulada';
    if (lower.includes('renew')) return 'renovada';
    return 'solicitada';
}

function mapOEPMStatus(status: string): string {
    const lower = status.toLowerCase();
    if (lower.includes('concedid') || lower.includes('registrad')) return 'registrada';
    if (lower.includes('solicitad') || lower.includes('publicad')) return 'solicitada';
    if (lower.includes('caducad') || lower.includes('expirad')) return 'expirada';
    if (lower.includes('denegad')) return 'denegada';
    if (lower.includes('retirad') || lower.includes('desistid')) return 'retirada';
    if (lower.includes('renovad')) return 'renovada';
    return 'solicitada';
}

function parseNizaClasses(input: string | number[]): number[] {
    if (Array.isArray(input)) return input.map(Number).filter(n => !isNaN(n));
    if (typeof input !== 'string') return [];
    return input
        .split(/[,;/\s]+/)
        .map(s => parseInt(s.trim()))
        .filter(n => !isNaN(n) && n >= 1 && n <= 45);
}

export async function POST(req: NextRequest) {
    try {
        const body = await req.json();
        const { request_id, titular_id } = body;

        if (!request_id || !titular_id) {
            return NextResponse.json(
                { error: 'request_id and titular_id are required' },
                { status: 400 }
            );
        }

        // Get request and titular
        const { data: request } = await supabaseAdmin
            .from('ip_requests')
            .select('*')
            .eq('id', request_id)
            .single();

        const { data: titular } = await supabaseAdmin
            .from('ip_titulares')
            .select('*')
            .eq('id', titular_id)
            .single();

        if (!request || !titular) {
            return NextResponse.json({ error: 'Request or titular not found' }, { status: 404 });
        }

        const jurisdicciones = (request.scope_jurisdicciones as string[]) || ['ES', 'EU'];
        const allResults: TrademarkResult[] = [];

        // Search each jurisdiction
        if (jurisdicciones.includes('EU')) {
            const euResults = await searchEUIPO(titular.nombre_oficial);
            allResults.push(...euResults);
        }

        if (jurisdicciones.includes('ES')) {
            const esResults = await searchOEPM(titular.nombre_oficial);
            allResults.push(...esResults);
        }

        // Upsert results into ip_marcas
        let insertedCount = 0;
        for (const result of allResults) {
            if (!result.numero_expediente || !result.signo) continue;

            const { error } = await supabaseAdmin
                .from('ip_marcas')
                .upsert({
                    titular_id,
                    jurisdiccion: result.jurisdiccion,
                    signo: result.signo,
                    tipo: result.tipo || 'denominativa',
                    clases_niza: result.clases_niza,
                    estado_legal: result.estado_legal,
                    numero_expediente: result.numero_expediente,
                    fecha_solicitud: result.fecha_solicitud,
                    fecha_concesion: result.fecha_concesion,
                    fecha_vencimiento: result.fecha_vencimiento,
                    source_url: result.source_url,
                    evidence_ref: `SRC-SEARCH-${result.jurisdiccion}`,
                }, {
                    onConflict: 'jurisdiccion,numero_expediente',
                    ignoreDuplicates: true,
                });

            if (!error) insertedCount++;
        }

        // Log searches to ip_sources_log
        for (const jur of jurisdicciones) {
            await supabaseAdmin
                .from('ip_sources_log')
                .insert({
                    ip_request_id: request_id,
                    source_registry: jur === 'ES' ? 'OEPM' : jur === 'EU' ? 'EUIPO' : 'WIPO',
                    query_params: { holderName: titular.nombre_oficial, jurisdiccion: jur },
                    results_count: allResults.filter(r => r.jurisdiccion === jur).length,
                    http_status: 200,
                });
        }

        // Update pipeline step
        await supabaseAdmin
            .from('ip_requests')
            .update({
                pipeline_step: 'registries_searched',
                updated_at: new Date().toISOString(),
            })
            .eq('id', request_id);

        return NextResponse.json({
            success: true,
            jurisdicciones_searched: jurisdicciones,
            results_found: allResults.length,
            marcas_inserted: insertedCount,
        });

    } catch (error) {
        console.error('IP search error:', error);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}
