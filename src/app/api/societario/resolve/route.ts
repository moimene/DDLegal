import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-admin';

/**
 * Identity Resolution
 * POST /api/societario/resolve
 * Body: { request_id, selected_candidate_id? }
 *
 * Resolves the sociedad identity for a request.
 * If selected_candidate_id is provided, uses that candidate.
 * Otherwise, searches existing sociedades and creates candidates.
 */

function normalizeName(name: string): string {
    return name
        .toUpperCase()
        .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
        .replace(/\b(S\.?L\.?U?\.?|S\.?A\.?|S\.?L\.?L\.?)\b/g, '')
        .replace(/[,."'()]/g, '')
        .replace(/\s+/g, ' ')
        .trim();
}

function wordSimilarity(a: string, b: string): number {
    const na = normalizeName(a);
    const nb = normalizeName(b);
    if (na === nb) return 1;

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
        const { request_id, selected_candidate_id } = body;

        if (!request_id) {
            return NextResponse.json({ error: 'request_id is required' }, { status: 400 });
        }

        // Get the request
        const { data: request, error: reqErr } = await supabaseAdmin
            .from('dd_requests')
            .select('*')
            .eq('id', request_id)
            .single();

        if (reqErr || !request) {
            return NextResponse.json({ error: 'Request not found' }, { status: 404 });
        }

        // If a candidate was selected, use it
        if (selected_candidate_id) {
            const { data: candidate } = await supabaseAdmin
                .from('sociedad_candidates')
                .select('*')
                .eq('id', selected_candidate_id)
                .eq('request_id', request_id)
                .single();

            if (!candidate) {
                return NextResponse.json({ error: 'Candidate not found' }, { status: 404 });
            }

            // Mark candidate as selected
            await supabaseAdmin
                .from('sociedad_candidates')
                .update({ is_selected: true })
                .eq('id', selected_candidate_id);

            // Find or create sociedad
            let sociedadId: string;
            if (candidate.nif_candidato) {
                const { data: existing } = await supabaseAdmin
                    .from('sociedades')
                    .select('id')
                    .eq('nif', candidate.nif_candidato)
                    .single();

                if (existing) {
                    sociedadId = existing.id;
                } else {
                    const { data: newSoc } = await supabaseAdmin
                        .from('sociedades')
                        .insert({
                            denominacion: candidate.denominacion_candidata,
                            nif: candidate.nif_candidato,
                        })
                        .select('id')
                        .single();
                    sociedadId = newSoc!.id;
                }
            } else {
                const { data: newSoc } = await supabaseAdmin
                    .from('sociedades')
                    .insert({
                        denominacion: candidate.denominacion_candidata,
                    })
                    .select('id')
                    .single();
                sociedadId = newSoc!.id;
            }

            // Update request
            await supabaseAdmin
                .from('dd_requests')
                .update({
                    sociedad_id: sociedadId,
                    status: 'running',
                    pipeline_step: 'identity_resolved',
                    updated_at: new Date().toISOString(),
                })
                .eq('id', request_id);

            return NextResponse.json({
                success: true,
                sociedad_id: sociedadId,
                status: 'running',
                pipeline_step: 'identity_resolved',
            });
        }

        // ---- Auto-resolution logic ----

        // Update to running
        await supabaseAdmin
            .from('dd_requests')
            .update({ status: 'running', updated_at: new Date().toISOString() })
            .eq('id', request_id);

        // Step 1: Exact NIF match
        if (request.nif_hint) {
            const { data: exactMatch } = await supabaseAdmin
                .from('sociedades')
                .select('id, denominacion, nif')
                .eq('nif', request.nif_hint)
                .single();

            if (exactMatch) {
                await supabaseAdmin
                    .from('dd_requests')
                    .update({
                        sociedad_id: exactMatch.id,
                        pipeline_step: 'identity_resolved',
                        updated_at: new Date().toISOString(),
                    })
                    .eq('id', request_id);

                return NextResponse.json({
                    success: true,
                    sociedad_id: exactMatch.id,
                    status: 'running',
                    pipeline_step: 'identity_resolved',
                    match_type: 'exact_nif',
                });
            }
        }

        // Step 2: Fuzzy name match against existing sociedades
        const { data: allSociedades } = await supabaseAdmin
            .from('sociedades')
            .select('id, denominacion, nif')
            .limit(500);

        const candidates: Array<{
            denominacion_candidata: string;
            nif_candidato: string | null;
            similarity_score: number;
            source: string;
            sociedad_id?: string;
        }> = [];

        if (allSociedades) {
            for (const soc of allSociedades) {
                const score = wordSimilarity(request.sociedad_input, soc.denominacion);
                if (score >= 0.5) {
                    candidates.push({
                        denominacion_candidata: soc.denominacion,
                        nif_candidato: soc.nif,
                        similarity_score: score,
                        source: 'database',
                        sociedad_id: soc.id,
                    });
                }
            }
        }

        // Sort by score descending
        candidates.sort((a, b) => b.similarity_score - a.similarity_score);

        // Step 3: High-confidence auto-select
        if (candidates.length === 1 && candidates[0].similarity_score >= 0.9) {
            const best = candidates[0];
            await supabaseAdmin
                .from('dd_requests')
                .update({
                    sociedad_id: best.sociedad_id!,
                    pipeline_step: 'identity_resolved',
                    updated_at: new Date().toISOString(),
                })
                .eq('id', request_id);

            return NextResponse.json({
                success: true,
                sociedad_id: best.sociedad_id,
                status: 'running',
                pipeline_step: 'identity_resolved',
                match_type: 'auto_fuzzy',
                similarity_score: best.similarity_score,
            });
        }

        // Step 4: No match — create new sociedad
        if (candidates.length === 0) {
            const { data: newSoc } = await supabaseAdmin
                .from('sociedades')
                .insert({
                    denominacion: request.sociedad_input,
                    nif: request.nif_hint || null,
                })
                .select('id')
                .single();

            await supabaseAdmin
                .from('dd_requests')
                .update({
                    sociedad_id: newSoc!.id,
                    pipeline_step: 'identity_resolved',
                    updated_at: new Date().toISOString(),
                })
                .eq('id', request_id);

            return NextResponse.json({
                success: true,
                sociedad_id: newSoc!.id,
                status: 'running',
                pipeline_step: 'identity_resolved',
                match_type: 'new_entity',
            });
        }

        // Step 5: Ambiguous — store candidates and mark needs_review
        const candidateRows = candidates.slice(0, 5).map(c => ({
            request_id,
            denominacion_candidata: c.denominacion_candidata,
            nif_candidato: c.nif_candidato,
            similarity_score: c.similarity_score,
            source: c.source,
        }));

        await supabaseAdmin
            .from('sociedad_candidates')
            .insert(candidateRows);

        await supabaseAdmin
            .from('dd_requests')
            .update({
                status: 'needs_review',
                pipeline_step: 'needs_review',
                updated_at: new Date().toISOString(),
            })
            .eq('id', request_id);

        return NextResponse.json({
            success: true,
            status: 'needs_review',
            pipeline_step: 'needs_review',
            candidates: candidateRows,
        });

    } catch (error) {
        console.error('Resolve error:', error);
        return NextResponse.json(
            { error: 'Internal server error' },
            { status: 500 }
        );
    }
}
