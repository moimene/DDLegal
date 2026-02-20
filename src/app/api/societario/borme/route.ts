import { NextRequest, NextResponse } from 'next/server';

/**
 * BORME Summary Fetcher
 * GET /api/societario/borme?date=YYYYMMDD
 *
 * Fetches and parses the BORME daily summary from the BOE open data API.
 * Public endpoint, no auth required from BOE side.
 */

interface BormeEntry {
    titulo: string;
    seccion: string;
    departamento: string;
    urlPdf: string;
    urlHtml: string;
    identificador: string;
}

// Simple in-memory cache to avoid re-fetching same date
const cache = new Map<string, { data: BormeEntry[]; ts: number }>();
const CACHE_TTL = 1000 * 60 * 30; // 30 minutes

function normalizeDenominacion(name: string): string {
    return name
        .toUpperCase()
        .normalize('NFD').replace(/[\u0300-\u036f]/g, '') // strip accents
        .replace(/\b(S\.?L\.?U?\.?|S\.?A\.?|S\.?L\.?L\.?|S\.?C\.?O?\.?O?\.?P\.?)\b/g, '') // strip legal forms
        .replace(/[,."'()]/g, '')
        .replace(/\s+/g, ' ')
        .trim();
}

export async function GET(req: NextRequest) {
    try {
        const { searchParams } = new URL(req.url);
        const date = searchParams.get('date');

        if (!date || !/^\d{8}$/.test(date)) {
            return NextResponse.json(
                { error: 'date parameter required in YYYYMMDD format' },
                { status: 400 }
            );
        }

        // Check cache
        const cached = cache.get(date);
        if (cached && Date.now() - cached.ts < CACHE_TTL) {
            return NextResponse.json({
                success: true,
                date,
                entries: cached.data,
                cached: true,
            });
        }

        // Fetch from BOE open data API
        const bormeUrl = `https://boe.es/datosabiertos/api/borme/sumario/${date}`;
        const resp = await fetch(bormeUrl, {
            headers: { 'Accept': 'application/json' },
            signal: AbortSignal.timeout(15000),
        });

        if (!resp.ok) {
            if (resp.status === 404) {
                return NextResponse.json({
                    success: true,
                    date,
                    entries: [],
                    message: 'No BORME summary found for this date (may be weekend/holiday)',
                });
            }
            return NextResponse.json(
                { error: `BOE API returned ${resp.status}` },
                { status: 502 }
            );
        }

        const contentType = resp.headers.get('content-type') || '';
        let entries: BormeEntry[] = [];

        if (contentType.includes('json')) {
            // JSON response
            const json = await resp.json();
            const items = json?.data?.sumario_borme?.diario?.seccion || [];

            // Parse sections
            const allItems: BormeEntry[] = [];
            const sections = Array.isArray(items) ? items : [items];

            for (const section of sections) {
                const departamentos = section?.departamento;
                if (!departamentos) continue;
                const deptList = Array.isArray(departamentos) ? departamentos : [departamentos];

                for (const dept of deptList) {
                    const items_in_dept = dept?.item;
                    if (!items_in_dept) continue;
                    const itemList = Array.isArray(items_in_dept) ? items_in_dept : [items_in_dept];

                    for (const item of itemList) {
                        allItems.push({
                            titulo: item.titulo || '',
                            seccion: section['@nombre'] || section.nombre || '',
                            departamento: dept['@nombre'] || dept.nombre || '',
                            urlPdf: item.url_pdf?.texto || item.urlPdf || '',
                            urlHtml: item.url_html?.texto || item.urlHtml || '',
                            identificador: item.identificador || '',
                        });
                    }
                }
            }
            entries = allItems;
        } else {
            // XML response — basic regex parsing as fallback
            const text = await resp.text();
            const itemRegex = /<item>([\s\S]*?)<\/item>/g;
            let match;
            while ((match = itemRegex.exec(text)) !== null) {
                const block = match[1];
                const getTag = (tag: string) => {
                    const m = block.match(new RegExp(`<${tag}>(.*?)</${tag}>`));
                    return m ? m[1].trim() : '';
                };
                entries.push({
                    titulo: getTag('titulo'),
                    seccion: '',
                    departamento: '',
                    urlPdf: getTag('urlPdf') || getTag('url_pdf'),
                    urlHtml: getTag('urlHtml') || getTag('url_html'),
                    identificador: getTag('identificador'),
                });
            }
        }

        // Normalize entries
        const normalized = entries.map(e => ({
            ...e,
            denominacion_normalizada: normalizeDenominacion(e.titulo),
        }));

        // Cache
        cache.set(date, { data: entries, ts: Date.now() });

        return NextResponse.json({
            success: true,
            date,
            entries: normalized,
            count: normalized.length,
        });

    } catch (error) {
        console.error('BORME fetch error:', error);
        return NextResponse.json(
            { error: 'Failed to fetch BORME data' },
            { status: 500 }
        );
    }
}
