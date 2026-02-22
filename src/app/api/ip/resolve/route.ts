import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { requirePermission } from '@/lib/auth/require-permission';

/**
 * IP Radar — Titular Resolution
 * POST /api/ip/resolve
 * Body: { request_id }
 *
 * Resolves the IP holder (titular) from the input denomination.
 * Creates or matches an ip_titulares record.
 */

function normalizeName(name: string): string {
    return name
        .toUpperCase()
        .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
        .replace(/\b(S\.?L\.?U?\.?|S\.?A\.?|S\.?L\.?L?\.?|S\.?C\.?|S\.?COOP\.?)\b/g, '')
        .replace(/[,."'()]/g, '')
        .replace(/\s+/g, ' ')
        .trim();
}

export async function POST(req: NextRequest) {
    try {
        const body = await req.json();
        const { request_id } = body;

        if (!request_id) {
            return NextResponse.json({ error: 'request_id is required' }, { status: 400 });
        }

        // Get the IP request
        const { data: request, error: reqErr } = await supabaseAdmin
            .from('ip_requests')
            .select('*')
            .eq('id', request_id)
            .single();

        if (reqErr || !request) {
            return NextResponse.json({ error: 'IP request not found' }, { status: 404 });
        }

        // Permission check — use project_id from the IP request record if available
        if (request.project_id) {
            const { authorized, error: authError } = await requirePermission(req, request.project_id, 'can_edit_contingencies');
            if (!authorized) return authError!;
        } else {
            // No project_id on this request — verify user is authenticated at minimum
            const userId = req.headers.get('x-user-id');
            if (!userId) {
                return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
            }
        }

        const denominacion = request.denominacion_input as string;
        const nif = request.titular_nif as string | null;
        const normalized = normalizeName(denominacion);

        // Try exact match by NIF first
        if (nif) {
            const { data: byNif } = await supabaseAdmin
                .from('ip_titulares')
                .select('*')
                .eq('nif_nie_cif', nif)
                .limit(1)
                .maybeSingle();

            if (byNif) {
                // Update request with resolved titular
                await supabaseAdmin
                    .from('ip_requests')
                    .update({
                        titular_id: byNif.id,
                        pipeline_step: 'titular_resolved',
                        status: 'running',
                        updated_at: new Date().toISOString(),
                    })
                    .eq('id', request_id);

                return NextResponse.json({
                    success: true,
                    titular_id: byNif.id,
                    match_type: 'nif_exact',
                    nombre_oficial: byNif.nombre_oficial,
                });
            }
        }

        // Try fuzzy name match
        const { data: candidates } = await supabaseAdmin
            .from('ip_titulares')
            .select('*')
            .order('created_at', { ascending: false })
            .limit(100);

        let bestMatch: { id: string; nombre_oficial: string; score: number } | null = null;

        for (const candidate of (candidates || [])) {
            const candNormalized = normalizeName(candidate.nombre_oficial as string);
            if (candNormalized === normalized) {
                bestMatch = { id: candidate.id, nombre_oficial: candidate.nombre_oficial, score: 1.0 };
                break;
            }

            // Simple Jaccard similarity
            const wordsA = normalized.split(' ').filter((w: string) => w.length > 2);
            const wordsB = new Set(candNormalized.split(' ').filter((w: string) => w.length > 2));
            if (wordsA.length === 0 || wordsB.size === 0) continue;

            let intersection = 0;
            wordsA.forEach((w: string) => { if (wordsB.has(w)) intersection++; });
            const score = intersection / Math.max(wordsA.length, wordsB.size);

            if (score >= 0.7 && (!bestMatch || score > bestMatch.score)) {
                bestMatch = { id: candidate.id, nombre_oficial: candidate.nombre_oficial, score };
            }
        }

        let titularId: string;
        let matchType: string;

        if (bestMatch && bestMatch.score >= 0.7) {
            titularId = bestMatch.id;
            matchType = bestMatch.score === 1.0 ? 'name_exact' : 'name_fuzzy';
        } else {
            // Create new titular
            const { data: newTitular, error: titErr } = await supabaseAdmin
                .from('ip_titulares')
                .insert({
                    nombre_oficial: denominacion,
                    nif_nie_cif: nif || null,
                    pais: 'ES',
                })
                .select()
                .single();

            if (titErr || !newTitular) {
                return NextResponse.json(
                    { error: `Failed to create titular: ${titErr?.message}` },
                    { status: 500 }
                );
            }

            titularId = newTitular.id;
            matchType = 'created_new';
        }

        // Update request
        await supabaseAdmin
            .from('ip_requests')
            .update({
                titular_id: titularId,
                pipeline_step: 'titular_resolved',
                status: 'running',
                updated_at: new Date().toISOString(),
            })
            .eq('id', request_id);

        return NextResponse.json({
            success: true,
            titular_id: titularId,
            match_type: matchType,
            nombre_oficial: bestMatch?.nombre_oficial || denominacion,
        });

    } catch (error) {
        console.error('IP resolve error:', error);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}
