import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { requirePermission } from '@/lib/auth/require-permission';

/**
 * POST /api/reports/compare
 * Body: { report_id_a: string, report_id_b: string }
 *
 * Compara dos versiones de un informe y genera un resumen de diferencias.
 */

interface ChangeRecord {
    field: string;
    old_value: unknown;
    new_value: unknown;
    change_type: 'added' | 'removed' | 'modified';
}

function compareObjects(
    objA: Record<string, unknown>,
    objB: Record<string, unknown>,
    prefix: string
): ChangeRecord[] {
    const changes: ChangeRecord[] = [];
    const allKeys = Array.from(new Set([...Object.keys(objA), ...Object.keys(objB)]));

    for (const key of allKeys) {
        const fieldPath = prefix ? `${prefix}.${key}` : key;
        const valA = objA[key];
        const valB = objB[key];

        if (valA === undefined && valB !== undefined) {
            changes.push({
                field: fieldPath,
                old_value: null,
                new_value: valB,
                change_type: 'added',
            });
        } else if (valA !== undefined && valB === undefined) {
            changes.push({
                field: fieldPath,
                old_value: valA,
                new_value: null,
                change_type: 'removed',
            });
        } else if (typeof valA === 'object' && typeof valB === 'object' && valA !== null && valB !== null && !Array.isArray(valA) && !Array.isArray(valB)) {
            const nested = compareObjects(
                valA as Record<string, unknown>,
                valB as Record<string, unknown>,
                fieldPath
            );
            changes.push(...nested);
        } else {
            const strA = JSON.stringify(valA);
            const strB = JSON.stringify(valB);
            if (strA !== strB) {
                changes.push({
                    field: fieldPath,
                    old_value: valA,
                    new_value: valB,
                    change_type: 'modified',
                });
            }
        }
    }

    return changes;
}

function compareSections(
    responseA: Record<string, unknown>,
    responseB: Record<string, unknown>
): ChangeRecord[] {
    if (!responseA || !responseB) return [];
    return compareObjects(responseA, responseB, 'content');
}

function compareEvidenceSources(
    packA: Record<string, unknown>,
    packB: Record<string, unknown>
): ChangeRecord[] {
    const changes: ChangeRecord[] = [];
    const sourcesA = ((packA?.sources || []) as Array<Record<string, unknown>>).map(s => s.id as string);
    const sourcesB = ((packB?.sources || []) as Array<Record<string, unknown>>).map(s => s.id as string);

    const setA = new Set(sourcesA);
    const setB = new Set(sourcesB);

    const addedSources = Array.from(setB).filter(id => !setA.has(id));
    const removedSources = Array.from(setA).filter(id => !setB.has(id));

    if (addedSources.length > 0) {
        changes.push({
            field: 'evidence_sources',
            old_value: null,
            new_value: addedSources,
            change_type: 'added',
        });
    }

    if (removedSources.length > 0) {
        changes.push({
            field: 'evidence_sources',
            old_value: removedSources,
            new_value: null,
            change_type: 'removed',
        });
    }

    return changes;
}

function generateSummary(
    reportA: Record<string, unknown>,
    reportB: Record<string, unknown>,
    changes: ChangeRecord[]
): string {
    const parts: string[] = [];
    const versionA = reportA.version_number || 1;
    const versionB = reportB.version_number || 1;

    parts.push(`Comparacion entre v${versionA} y v${versionB}.`);

    const added = changes.filter(c => c.change_type === 'added').length;
    const removed = changes.filter(c => c.change_type === 'removed').length;
    const modified = changes.filter(c => c.change_type === 'modified').length;

    if (added > 0) parts.push(`${added} campo(s) anadido(s).`);
    if (removed > 0) parts.push(`${removed} campo(s) eliminado(s).`);
    if (modified > 0) parts.push(`${modified} campo(s) modificado(s).`);

    const scoreA = (reportA.grounding_score as number) || 0;
    const scoreB = (reportB.grounding_score as number) || 0;
    if (scoreA !== scoreB) {
        const diff = scoreB - scoreA;
        const direction = diff > 0 ? 'aumento' : 'disminuyo';
        parts.push(`Grounding score ${direction} de ${scoreA} a ${scoreB} (${diff > 0 ? '+' : ''}${diff}).`);
    }

    if (reportA.is_frozen !== reportB.is_frozen) {
        parts.push(
            reportB.is_frozen
                ? `v${versionB} esta congelada.`
                : `v${versionB} fue descongelada.`
        );
    }

    if (changes.length === 0) {
        parts.push('No se detectaron diferencias significativas entre las versiones.');
    }

    return parts.join(' ');
}

export async function POST(req: NextRequest) {
    try {
        const body = await req.json();
        const { report_id_a, report_id_b, project_id } = body as {
            report_id_a: string;
            report_id_b: string;
            project_id?: string;
        };

        // Permission check — require can_view_reports when project_id is provided
        if (project_id) {
            const { authorized, error: authError } = await requirePermission(req, project_id, 'can_view_reports');
            if (!authorized) return authError!;
        }

        if (!report_id_a || !report_id_b) {
            return NextResponse.json(
                { error: 'Se requieren report_id_a y report_id_b' },
                { status: 400 }
            );
        }

        if (report_id_a === report_id_b) {
            return NextResponse.json(
                { error: 'No se puede comparar un informe consigo mismo' },
                { status: 400 }
            );
        }

        // Obtener ambos informes
        const [resultA, resultB] = await Promise.all([
            supabaseAdmin.from('dd_reports').select('*').eq('id', report_id_a).single(),
            supabaseAdmin.from('dd_reports').select('*').eq('id', report_id_b).single(),
        ]);

        if (resultA.error || !resultA.data) {
            return NextResponse.json(
                { error: `Informe A no encontrado: ${report_id_a}` },
                { status: 404 }
            );
        }

        if (resultB.error || !resultB.data) {
            return NextResponse.json(
                { error: `Informe B no encontrado: ${report_id_b}` },
                { status: 404 }
            );
        }

        const reportA = resultA.data;
        const reportB = resultB.data;

        // Comparar metadatos
        const metadataChanges: ChangeRecord[] = [];
        const metaFields = ['status', 'report_category', 'visibility', 'is_frozen'] as const;

        for (const field of metaFields) {
            if (reportA[field] !== reportB[field]) {
                metadataChanges.push({
                    field: `metadata.${field}`,
                    old_value: reportA[field],
                    new_value: reportB[field],
                    change_type: reportA[field] === null || reportA[field] === undefined ? 'added' : reportB[field] === null || reportB[field] === undefined ? 'removed' : 'modified',
                });
            }
        }

        // Comparar grounding score
        if (reportA.grounding_score !== reportB.grounding_score) {
            metadataChanges.push({
                field: 'grounding_score',
                old_value: reportA.grounding_score,
                new_value: reportB.grounding_score,
                change_type: 'modified',
            });
        }

        // Comparar secciones del contenido
        const contentChanges = compareSections(
            (reportA.harvey_response || {}) as Record<string, unknown>,
            (reportB.harvey_response || {}) as Record<string, unknown>
        );

        // Comparar fuentes de evidencia
        const evidenceChanges = compareEvidenceSources(
            (reportA.evidence_pack || {}) as Record<string, unknown>,
            (reportB.evidence_pack || {}) as Record<string, unknown>
        );

        const allChanges = [...metadataChanges, ...contentChanges, ...evidenceChanges];

        // Generar resumen
        const summary = generateSummary(reportA, reportB, allChanges);

        return NextResponse.json({
            success: true,
            report_a: {
                id: reportA.id,
                version_number: reportA.version_number || 1,
                created_at: reportA.created_at,
                grounding_score: reportA.grounding_score || 0,
                status: reportA.status,
                is_frozen: reportA.is_frozen || false,
            },
            report_b: {
                id: reportB.id,
                version_number: reportB.version_number || 1,
                created_at: reportB.created_at,
                grounding_score: reportB.grounding_score || 0,
                status: reportB.status,
                is_frozen: reportB.is_frozen || false,
            },
            changes: allChanges,
            stats: {
                total: allChanges.length,
                added: allChanges.filter(c => c.change_type === 'added').length,
                removed: allChanges.filter(c => c.change_type === 'removed').length,
                modified: allChanges.filter(c => c.change_type === 'modified').length,
            },
            summary,
        });
    } catch (error) {
        console.error('Compare error:', error);
        return NextResponse.json(
            { error: 'Error interno al comparar informes' },
            { status: 500 }
        );
    }
}
