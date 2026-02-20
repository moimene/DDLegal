import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-admin';

/**
 * BORME Ingest
 * POST /api/societario/borme/ingest
 * Body: { sociedad_id, date_from: 'YYYY-MM-DD', date_to: 'YYYY-MM-DD' }
 *
 * Fetches BORME daily summaries across a date range,
 * matches entries to the given sociedad, and upserts into borme_announcements.
 */

const TIPO_ACTO_KEYWORDS: Record<string, string[]> = {
    CONSTITUCION: ['constitución', 'constituc'],
    NOMBRAMIENTO_ADMIN: ['nombramiento', 'nombramientos'],
    CESE_ADMIN: ['ceses', 'cese'],
    REELECCION: ['reelección', 'reelecc'],
    AMPLIACION_CAPITAL: ['ampliación de capital', 'ampliación del capital', 'aumento de capital'],
    REDUCCION_CAPITAL: ['reducción de capital', 'reducción del capital'],
    CAMBIO_DOMICILIO: ['cambio de domicilio'],
    CAMBIO_OBJETO: ['cambio de objeto', 'modificación del objeto'],
    CAMBIO_DENOMINACION: ['cambio de denominación'],
    DISOLUCION: ['disolución'],
    LIQUIDACION: ['liquidación'],
    FUSION: ['fusión'],
    ESCISION: ['escisión'],
    TRANSFORMACION: ['transformación'],
    PODER_GENERAL: ['poder general', 'poderes generales', 'apoderamiento general'],
    PODER_ESPECIAL: ['poder especial', 'poderes especiales'],
    REVOCACION_PODER: ['revocación de poder', 'revocaciones de poder'],
    DEPOSITO_CUENTAS: ['depósito de cuentas', 'cuentas anuales'],
    NOMBRAMIENTO_AUDITOR: ['nombramiento de auditor', 'auditor'],
    CESE_AUDITOR: ['cese de auditor'],
    EMISION_OBLIGACIONES: ['emisión de obligaciones'],
    SITUACION_CONCURSAL: ['concursal', 'concurso'],
};

function detectTipoActo(text: string): string {
    const lower = text.toLowerCase();
    for (const [tipo, keywords] of Object.entries(TIPO_ACTO_KEYWORDS)) {
        for (const kw of keywords) {
            if (lower.includes(kw)) return tipo;
        }
    }
    return 'OTRO';
}

function normalizeName(name: string): string {
    return name
        .toUpperCase()
        .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
        .replace(/\b(S\.?L\.?U?\.?|S\.?A\.?|S\.?L\.?L\.?)\b/g, '')
        .replace(/[,."'()]/g, '')
        .replace(/\s+/g, ' ')
        .trim();
}

function similarity(a: string, b: string): number {
    const na = normalizeName(a);
    const nb = normalizeName(b);
    if (na === nb) return 1;

    // Simple Jaccard on words
    const wordsAArr = na.split(' ').filter(w => w.length > 2);
    const wordsBSet = new Set(nb.split(' ').filter(w => w.length > 2));
    if (wordsAArr.length === 0 || wordsBSet.size === 0) return 0;

    let intersection = 0;
    wordsAArr.forEach(w => { if (wordsBSet.has(w)) intersection++; });
    return intersection / Math.max(wordsAArr.length, wordsBSet.size);
}

export async function POST(req: NextRequest) {
    try {
        const body = await req.json();
        const { sociedad_id, date_from, date_to } = body;

        if (!sociedad_id || !date_from || !date_to) {
            return NextResponse.json(
                { error: 'sociedad_id, date_from, and date_to are required' },
                { status: 400 }
            );
        }

        // Get sociedad details
        const { data: sociedad, error: socErr } = await supabaseAdmin
            .from('sociedades')
            .select('id, denominacion, nif')
            .eq('id', sociedad_id)
            .single();

        if (socErr || !sociedad) {
            return NextResponse.json(
                { error: 'Sociedad not found' },
                { status: 404 }
            );
        }

        // Generate date range
        const from = new Date(date_from);
        const to = new Date(date_to);
        const dates: string[] = [];
        const current = new Date(from);
        while (current <= to) {
            // Skip weekends
            const day = current.getDay();
            if (day !== 0 && day !== 6) {
                const y = current.getFullYear();
                const m = String(current.getMonth() + 1).padStart(2, '0');
                const d = String(current.getDate()).padStart(2, '0');
                dates.push(`${y}${m}${d}`);
            }
            current.setDate(current.getDate() + 1);
        }

        let totalIngested = 0;
        let totalMatched = 0;
        let totalUnmatched = 0;
        const errors: string[] = [];

        // Process each date (limit concurrency)
        const batchSize = 3;
        for (let i = 0; i < dates.length; i += batchSize) {
            const batch = dates.slice(i, i + batchSize);
            const results = await Promise.allSettled(
                batch.map(async (date) => {
                    try {
                        const bormeUrl = `https://boe.es/datosabiertos/api/borme/sumario/${date}`;
                        const resp = await fetch(bormeUrl, {
                            headers: { 'Accept': 'application/json' },
                            signal: AbortSignal.timeout(10000),
                        });

                        if (!resp.ok) return { date, matched: 0, unmatched: 0 };

                        const json = await resp.json();
                        // BOE JSON structure: data.sumario.diario[] → each diario has seccion[] → each seccion has item[]
                        const diarios = json?.data?.sumario?.diario || [];
                        const diarioList = Array.isArray(diarios) ? diarios : [diarios];

                        let matched = 0;
                        let unmatched = 0;

                        for (const diario of diarioList) {
                            const sections = diario?.seccion || [];
                            const sectionList = Array.isArray(sections) ? sections : [sections];

                            for (const section of sectionList) {
                                const sectionName = section?.nombre || section?.codigo || '';
                                const items = section?.item || [];
                                const itemList = Array.isArray(items) ? items : [items];

                                for (const item of itemList) {
                                    const titulo = item.titulo || '';
                                    // Items at this level are provinces (MADRID, BARCELONA...)
                                    // Store the province PDF link as a potential source for the sociedad
                                    // Match against province where the company might be registered
                                    // Also check sub-items if they exist (Sección C has company names)
                                    const subItems = item?.item || [];
                                    const subItemList = Array.isArray(subItems) ? subItems : (subItems ? [subItems] : []);

                                    // Check sub-items for company name matches (Sección B/C)
                                    for (const sub of subItemList) {
                                        const subTitulo = sub?.titulo || '';
                                        const sim = similarity(subTitulo, sociedad.denominacion);

                                        if (sim >= 0.5 || (sociedad.nif && subTitulo.includes(sociedad.nif))) {
                                            const bormeDate = `${date.slice(0, 4)}-${date.slice(4, 6)}-${date.slice(6, 8)}`;
                                            const tipoActo = detectTipoActo(subTitulo);

                                            await supabaseAdmin
                                                .from('borme_announcements')
                                                .upsert({
                                                    sociedad_id: sociedad.id,
                                                    borme_date: bormeDate,
                                                    borme_section: sectionName,
                                                    borme_code: sub.identificador || item.identificador || `${date}-${matched}`,
                                                    tipo_acto: tipoActo,
                                                    raw_text: subTitulo,
                                                    parsed_data: {
                                                        provincia: titulo,
                                                        seccion: sectionName,
                                                        similarity_score: sim,
                                                    },
                                                    source_url: sub?.url_pdf?.texto || item?.url_pdf?.texto || '',
                                                }, {
                                                    onConflict: 'sociedad_id,borme_date,borme_code',
                                                    ignoreDuplicates: true,
                                                });

                                            matched++;
                                        } else if (subTitulo) {
                                            unmatched++;
                                        }
                                    }

                                    // Also match at the province/item level (for direct title matches)
                                    if (subItemList.length === 0) {
                                        const sim = similarity(titulo, sociedad.denominacion);
                                        if (sim >= 0.5 || (sociedad.nif && titulo.includes(sociedad.nif))) {
                                            const bormeDate = `${date.slice(0, 4)}-${date.slice(4, 6)}-${date.slice(6, 8)}`;
                                            const tipoActo = detectTipoActo(titulo);

                                            await supabaseAdmin
                                                .from('borme_announcements')
                                                .upsert({
                                                    sociedad_id: sociedad.id,
                                                    borme_date: bormeDate,
                                                    borme_section: sectionName,
                                                    borme_code: item.identificador || `${date}-${matched}`,
                                                    tipo_acto: tipoActo,
                                                    raw_text: titulo,
                                                    parsed_data: {
                                                        seccion: sectionName,
                                                        similarity_score: sim,
                                                    },
                                                    source_url: item?.url_pdf?.texto || '',
                                                }, {
                                                    onConflict: 'sociedad_id,borme_date,borme_code',
                                                    ignoreDuplicates: true,
                                                });

                                            matched++;
                                        } else {
                                            unmatched++;
                                        }
                                    }
                                }
                            }
                        }

                        return { date, matched, unmatched };
                    } catch {
                        return { date, matched: 0, unmatched: 0, error: 'fetch failed' };
                    }
                })
            );

            for (const r of results) {
                if (r.status === 'fulfilled') {
                    totalMatched += r.value.matched;
                    totalUnmatched += r.value.unmatched;
                    totalIngested++;
                    if ('error' in r.value) errors.push(`${r.value.date}: ${r.value.error}`);
                }
            }
        }

        return NextResponse.json({
            success: true,
            sociedad_id,
            dates_processed: totalIngested,
            matched: totalMatched,
            unmatched: totalUnmatched,
            errors: errors.length > 0 ? errors : undefined,
        });

    } catch (error) {
        console.error('BORME ingest error:', error);
        return NextResponse.json(
            { error: 'Internal server error during BORME ingestion' },
            { status: 500 }
        );
    }
}
