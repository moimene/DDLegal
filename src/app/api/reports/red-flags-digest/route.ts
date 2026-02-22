import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { requirePermission } from '@/lib/auth/require-permission';

/**
 * Red Flags Digest
 * GET  /api/reports/red-flags-digest?request_id=xxx&since=YYYY-MM-DD
 * POST /api/reports/red-flags-digest
 * Body: { request_id, project_id?, since? }
 *
 * Aggregates red flags from snapshots and generates a consolidated digest.
 */

interface RedFlag {
    tipo: string;
    severidad: string;
    descripcion: string;
    source: string;
    sociedad?: string;
    fecha_deteccion?: string;
    evidence_refs?: string[];
}

export async function GET(req: NextRequest) {
    const { searchParams } = new URL(req.url);
    const requestId = searchParams.get('request_id');
    const since = searchParams.get('since');

    if (!requestId) {
        return NextResponse.json({ error: 'request_id is required' }, { status: 400 });
    }

    return handleDigest(requestId, undefined, since || undefined);
}

export async function POST(req: NextRequest) {
    try {
        const body = await req.json();
        const { request_id, project_id, since } = body;

        if (!request_id && !project_id) {
            return NextResponse.json(
                { error: 'request_id or project_id is required' },
                { status: 400 }
            );
        }

        // Permission check — require can_view_reports when project_id is provided
        if (project_id) {
            const { authorized, error: authError } = await requirePermission(req, project_id, 'can_view_reports');
            if (!authorized) return authError!;
        }

        return handleDigest(request_id, project_id, since);
    } catch (error) {
        console.error('Red Flags Digest error:', error);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}

async function handleDigest(
    requestId?: string,
    projectId?: string,
    since?: string
): Promise<NextResponse> {
    const allFlags: RedFlag[] = [];

    // Collect from DD snapshots
    let snapshotQuery = supabaseAdmin
        .from('dd_snapshots')
        .select('id, sociedad_id, red_flags, datos_generales, snapshot_date, request_id');

    if (requestId) {
        snapshotQuery = snapshotQuery.eq('request_id', requestId);
    }

    if (since) {
        snapshotQuery = snapshotQuery.gte('snapshot_date', since);
    }

    const { data: snapshots } = await snapshotQuery.order('snapshot_date', { ascending: false });

    for (const snap of (snapshots || [])) {
        const datosGen = snap.datos_generales as Record<string, unknown>;
        const sociedad = (datosGen?.denominacion as string) || 'Desconocida';

        const redFlags = (snap.red_flags as Array<Record<string, unknown>>) || [];
        for (const flag of redFlags) {
            allFlags.push({
                tipo: (flag.tipo as string) || 'unknown',
                severidad: (flag.severidad as string) || 'medium',
                descripcion: (flag.descripcion as string) || '',
                source: 'snapshot_societario',
                sociedad,
                fecha_deteccion: snap.snapshot_date,
                evidence_refs: (flag.evidence_refs as string[]) || [],
            });
        }
    }

    // Collect from IP snapshots
    let ipSnapshotQuery = supabaseAdmin
        .from('ip_snapshots')
        .select('id, data, created_at, ip_request_id');

    if (requestId) {
        ipSnapshotQuery = ipSnapshotQuery.eq('ip_request_id', requestId);
    }

    const { data: ipSnapshots } = await ipSnapshotQuery.order('created_at', { ascending: false });

    for (const ipSnap of (ipSnapshots || [])) {
        const data = ipSnap.data as Record<string, unknown>;
        const ipRedFlags = (data?.red_flags as Array<Record<string, unknown>>) || [];
        const titular = (data?.titular as Record<string, unknown>);

        for (const flag of ipRedFlags) {
            allFlags.push({
                tipo: (flag.tipo as string) || 'unknown',
                severidad: (flag.severidad as string) || 'medium',
                descripcion: (flag.descripcion as string) || '',
                source: 'snapshot_ip',
                sociedad: (titular?.nombre as string) || undefined,
                fecha_deteccion: ipSnap.created_at,
            });
        }
    }

    // Collect from negotiation alerts
    let alertQuery = supabaseAdmin
        .from('dd_negotiation_alerts')
        .select('*');

    if (requestId) {
        alertQuery = alertQuery.eq('request_id', requestId);
    }

    const { data: alerts } = await alertQuery.order('created_at', { ascending: false });

    for (const alert of (alerts || [])) {
        allFlags.push({
            tipo: alert.alert_type || 'negotiation',
            severidad: alert.severity || 'high',
            descripcion: alert.titulo || alert.description || '',
            source: 'negotiation_alert',
            fecha_deteccion: alert.created_at,
            evidence_refs: alert.evidencia || [],
        });
    }

    // Sort by severity (critical first)
    const severityOrder: Record<string, number> = { critical: 0, high: 1, medium: 2, low: 3 };
    allFlags.sort((a, b) => (severityOrder[a.severidad] || 4) - (severityOrder[b.severidad] || 4));

    // Group by severity
    const bySeverity: Record<string, RedFlag[]> = {};
    for (const flag of allFlags) {
        const sev = flag.severidad || 'medium';
        if (!bySeverity[sev]) bySeverity[sev] = [];
        bySeverity[sev].push(flag);
    }

    return NextResponse.json({
        success: true,
        digest: {
            generated_at: new Date().toISOString(),
            since: since || null,
            request_id: requestId || null,
            project_id: projectId || null,
            total_flags: allFlags.length,
            by_severity: {
                critical: bySeverity['critical']?.length || 0,
                high: bySeverity['high']?.length || 0,
                medium: bySeverity['medium']?.length || 0,
                low: bySeverity['low']?.length || 0,
            },
            flags: allFlags,
        },
    });
}
