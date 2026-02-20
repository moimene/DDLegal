import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-admin';

const ALL_TABLES = [
  'dd_projects', 'dd_areas', 'dd_processes', 'dd_tasks',
  'dd_contingencies', 'dd_documents', 'dd_qa', 'dd_deliverables',
  'dd_hitl_decisions', 'dd_evidence', 'dd_skills_catalog',
  'dd_tools', 'dd_tool_executions', 'dd_tool_project_links',
  'dd_risks',
];

const API_ROUTES = [
  { path: '/api/skills', method: 'GET', description: 'Skills catalog' },
  { path: '/api/evidence', method: 'GET', description: 'Evidence items' },
  { path: '/api/tools/executions', method: 'GET', description: 'Tool execution history' },
  { path: '/api/tools/execute', method: 'POST', description: 'Execute a microtool' },
  { path: '/api/tools/link-project', method: 'POST', description: 'Link execution to project' },
  { path: '/api/harvey', method: 'POST', description: 'Harvey AI integration' },
  { path: '/api/hitl/decision', method: 'POST', description: 'HITL decisions' },
  { path: '/api/client/projects/[id]', method: 'GET', description: 'Client project view' },
  { path: '/api/system/health', method: 'GET', description: 'System health check' },
];

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const startTime = Date.now();

    // 1. Supabase connection + latency
    const dbStart = Date.now();
    const { error: pingError } = await supabaseAdmin
      .from('dd_areas')
      .select('id')
      .limit(1);
    const dbLatency = Date.now() - dbStart;

    // 2. Table row counts (parallel)
    const tableCountPromises = ALL_TABLES.map(async (table) => {
      const { count, error } = await supabaseAdmin
        .from(table)
        .select('*', { count: 'exact', head: true });
      return {
        table,
        count: count ?? 0,
        error: error?.message || null,
      };
    });
    const tableCounts = await Promise.all(tableCountPromises);

    // 3. n8n webhook connectivity
    let n8nStatus = { reachable: false, latency_ms: 0, error: null as string | null };
    const n8nUrl = process.env.N8N_WEBHOOK_BASE_URL;
    if (n8nUrl) {
      const n8nStart = Date.now();
      try {
        const n8nResp = await fetch(n8nUrl, {
          method: 'GET',
          signal: AbortSignal.timeout(5000),
        });
        n8nStatus = {
          reachable: n8nResp.ok || n8nResp.status === 404 || n8nResp.status === 405,
          latency_ms: Date.now() - n8nStart,
          error: n8nResp.ok ? null : `HTTP ${n8nResp.status}`,
        };
      } catch (e) {
        n8nStatus = {
          reachable: false,
          latency_ms: Date.now() - n8nStart,
          error: e instanceof Error ? e.message : 'Connection failed',
        };
      }
    }

    // 4. Environment variables check (masked)
    const envVars = [
      { key: 'NEXT_PUBLIC_SUPABASE_URL', configured: !!process.env.NEXT_PUBLIC_SUPABASE_URL, category: 'Supabase' },
      { key: 'NEXT_PUBLIC_SUPABASE_ANON_KEY', configured: !!process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY, category: 'Supabase' },
      { key: 'SUPABASE_SERVICE_ROLE_KEY', configured: !!process.env.SUPABASE_SERVICE_ROLE_KEY, category: 'Supabase' },
      { key: 'N8N_WEBHOOK_BASE_URL', configured: !!process.env.N8N_WEBHOOK_BASE_URL, category: 'n8n' },
      { key: 'HARVEY_API_KEY', configured: !!process.env.HARVEY_API_KEY, category: 'Harvey AI' },
    ];

    // 5. Tools & Skills summary
    const [toolsRes, skillsRes] = await Promise.all([
      supabaseAdmin.from('dd_tools').select('id, slug, name, is_active, sort_order').order('sort_order'),
      supabaseAdmin.from('dd_skills_catalog').select('id, skill_key, name, is_active, version, category, area_code').order('area_code'),
    ]);

    // 6. Execution statistics
    const { data: execStats } = await supabaseAdmin
      .from('dd_tool_executions')
      .select('tool_id, status')
      .order('created_at', { ascending: false })
      .limit(1000);

    const byStatus = (execStats || []).reduce((acc: Record<string, number>, e: { status: string }) => {
      acc[e.status] = (acc[e.status] || 0) + 1;
      return acc;
    }, {});

    // 7. Migrations
    let migrations: { version: string; name: string }[] = [];
    try {
      const { data } = await supabaseAdmin
        .from('supabase_migrations' as string)
        .select('version, name')
        .order('version', { ascending: false })
        .limit(10);
      migrations = (data as { version: string; name: string }[]) || [];
    } catch {
      // Table may not be accessible — fallback to empty
    }

    return NextResponse.json({
      success: true,
      timestamp: new Date().toISOString(),
      response_time_ms: Date.now() - startTime,
      supabase: {
        connected: !pingError,
        latency_ms: dbLatency,
        error: pingError?.message || null,
        url: process.env.NEXT_PUBLIC_SUPABASE_URL || null,
      },
      database: {
        tables: tableCounts,
        total_rows: tableCounts.reduce((sum, t) => sum + t.count, 0),
        migrations,
      },
      n8n: {
        configured: !!n8nUrl,
        url: n8nUrl || null,
        ...n8nStatus,
      },
      environment: envVars,
      api_routes: API_ROUTES,
      tools: toolsRes.data || [],
      skills: skillsRes.data || [],
      executions: {
        total: execStats?.length || 0,
        by_status: byStatus,
      },
      system: {
        node_env: process.env.NODE_ENV,
      },
    });
  } catch (error) {
    console.error('System health check error:', error);
    return NextResponse.json(
      { error: 'Health check failed', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
