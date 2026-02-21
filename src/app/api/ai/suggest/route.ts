import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-admin';

/**
 * Smart Suggestions API
 * POST /api/ai/suggest
 *
 * Input:  { project_id, context: 'dashboard' | 'vdr' | 'qa' | 'tasks' }
 * Output: { suggestions: Suggestion[] }
 *
 * Generates contextual, prioritized suggestions based on real project data:
 * - Missing critical documents
 * - SLA breaches
 * - Low grounding scores
 * - Stale tasks
 * - Incomplete areas
 */

// ────────────────────────────────────────────────────────────
// Types
// ────────────────────────────────────────────────────────────

interface Suggestion {
  id: string;
  priority: 'P0' | 'P1' | 'P2' | 'P3';
  title: string;
  description: string;
  action_url: string;
  icon: string;
  category: string;
}

type SuggestContext = 'dashboard' | 'vdr' | 'qa' | 'tasks';

// ────────────────────────────────────────────────────────────
// Suggestion generators
// ────────────────────────────────────────────────────────────

async function getSLASuggestions(projectId: string): Promise<Suggestion[]> {
  const suggestions: Suggestion[] = [];

  // Check for SLA-breached Q&A threads
  const { data: breachedThreads, error } = await supabaseAdmin
    .from('qa_threads')
    .select('id, subject, priority, updated_at')
    .eq('project_id', projectId)
    .eq('sla_breached', true)
    .in('status', ['sent', 'pending_response', 'follow_up', 'escalated'])
    .order('updated_at', { ascending: true })
    .limit(10);

  if (error || !breachedThreads) return suggestions;

  if (breachedThreads.length > 0) {
    const criticalCount = breachedThreads.filter(t => t.priority === 'critical').length;

    suggestions.push({
      id: `sla_breach_${projectId}`,
      priority: criticalCount > 0 ? 'P0' : 'P1',
      title: `${breachedThreads.length} hilos Q&A con SLA incumplido`,
      description: criticalCount > 0
        ? `${criticalCount} de prioridad critica requieren atencion inmediata`
        : `Hilos pendientes de respuesta fuera de plazo`,
      action_url: `/proyectos/${projectId}/qa?filter=sla_breached`,
      icon: 'AlertTriangle',
      category: 'qa',
    });
  }

  return suggestions;
}

async function getPendingQASuggestions(projectId: string): Promise<Suggestion[]> {
  const suggestions: Suggestion[] = [];

  // Count pending Q&A threads by priority
  const { data: pendingThreads } = await supabaseAdmin
    .from('qa_threads')
    .select('id, priority')
    .eq('project_id', projectId)
    .in('status', ['sent', 'pending_response'])
    .limit(50);

  if (!pendingThreads || pendingThreads.length === 0) return suggestions;

  const byPriority: Record<string, number> = {};
  for (const t of pendingThreads) {
    byPriority[t.priority] = (byPriority[t.priority] || 0) + 1;
  }

  if (pendingThreads.length >= 5) {
    const breakdown = Object.entries(byPriority)
      .map(([p, c]) => `${c} ${p}`)
      .join(', ');

    suggestions.push({
      id: `pending_qa_${projectId}`,
      priority: byPriority['critical'] ? 'P1' : 'P2',
      title: `${pendingThreads.length} preguntas Q&A sin responder`,
      description: `Distribucion: ${breakdown}`,
      action_url: `/proyectos/${projectId}/qa?filter=pending`,
      icon: 'MessageSquare',
      category: 'qa',
    });
  }

  return suggestions;
}

async function getStaleTasksSuggestions(projectId: string): Promise<Suggestion[]> {
  const suggestions: Suggestion[] = [];

  // Tasks not updated in 7+ days
  const sevenDaysAgo = new Date();
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

  const { data: staleTasks } = await supabaseAdmin
    .from('dd_tasks')
    .select('id, status, priority, updated_at')
    .eq('project_id', projectId)
    .in('status', ['pending', 'in_progress', 'review'])
    .lt('updated_at', sevenDaysAgo.toISOString())
    .limit(50);

  if (!staleTasks || staleTasks.length === 0) return suggestions;

  const blockedCount = staleTasks.filter(t => t.status === 'review').length;

  suggestions.push({
    id: `stale_tasks_${projectId}`,
    priority: staleTasks.length >= 10 ? 'P1' : 'P2',
    title: `${staleTasks.length} tareas sin actualizar en 7+ dias`,
    description: blockedCount > 0
      ? `${blockedCount} en estado de revision pendiente`
      : 'Considerar revisar y actualizar el estado de estas tareas',
    action_url: `/proyectos/${projectId}/tareas?filter=stale`,
    icon: 'Clock',
    category: 'tasks',
  });

  return suggestions;
}

async function getHITLSuggestions(projectId: string): Promise<Suggestion[]> {
  const suggestions: Suggestion[] = [];

  // Tasks awaiting HITL review
  const { data: hitlTasks } = await supabaseAdmin
    .from('dd_tasks')
    .select('id, ai_status, ai_output, priority')
    .eq('project_id', projectId)
    .eq('ai_status', 'completed')
    .eq('status', 'review')
    .is('hitl_reviewed_at', null)
    .limit(20);

  if (!hitlTasks || hitlTasks.length === 0) return suggestions;

  suggestions.push({
    id: `hitl_pending_${projectId}`,
    priority: 'P1',
    title: `${hitlTasks.length} salidas IA pendientes de revision HITL`,
    description: 'Resultados de herramientas IA esperan validacion humana',
    action_url: `/proyectos/${projectId}/tareas?filter=hitl_pending`,
    icon: 'Brain',
    category: 'tasks',
  });

  return suggestions;
}

async function getVDRCoverageSuggestions(projectId: string): Promise<Suggestion[]> {
  const suggestions: Suggestion[] = [];

  // Get all areas and their document counts
  const { data: areas } = await supabaseAdmin
    .from('dd_areas')
    .select('id, code, name')
    .order('sort_order');

  if (!areas || areas.length === 0) return suggestions;

  const { data: docs } = await supabaseAdmin
    .from('vdr_documents')
    .select('area_code')
    .eq('project_id', projectId)
    .not('status', 'in', '("archived","error")');

  const docsByArea: Record<string, number> = {};
  if (docs) {
    for (const d of docs) {
      if (d.area_code) {
        docsByArea[d.area_code] = (docsByArea[d.area_code] || 0) + 1;
      }
    }
  }

  // Also get total tasks per area for coverage calculation
  const { data: tasks } = await supabaseAdmin
    .from('dd_tasks')
    .select('area_id, status')
    .eq('project_id', projectId);

  const tasksByArea: Record<string, { total: number; completed: number }> = {};
  if (tasks) {
    for (const t of tasks) {
      if (t.area_id) {
        if (!tasksByArea[t.area_id]) tasksByArea[t.area_id] = { total: 0, completed: 0 };
        tasksByArea[t.area_id].total++;
        if (t.status === 'completed') tasksByArea[t.area_id].completed++;
      }
    }
  }

  // Find areas with low coverage
  const lowCoverageAreas: Array<{ code: string; name: string; pct: number }> = [];

  for (const area of areas) {
    const areaTaskInfo = tasksByArea[area.id];
    if (!areaTaskInfo || areaTaskInfo.total === 0) continue;

    const pct = Math.round((areaTaskInfo.completed / areaTaskInfo.total) * 100);
    if (pct < 50) {
      lowCoverageAreas.push({ code: area.code, name: area.name, pct });
    }
  }

  if (lowCoverageAreas.length > 0) {
    // Sort by coverage ascending (worst first)
    lowCoverageAreas.sort((a, b) => a.pct - b.pct);

    const worst = lowCoverageAreas[0];
    const description = lowCoverageAreas.length > 1
      ? `${worst.name} al ${worst.pct}% y ${lowCoverageAreas.length - 1} areas mas por debajo del 50%`
      : `${worst.name} al ${worst.pct}% de cobertura`;

    suggestions.push({
      id: `low_coverage_${projectId}`,
      priority: worst.pct < 20 ? 'P1' : 'P2',
      title: `${lowCoverageAreas.length} areas con cobertura baja (<50%)`,
      description,
      action_url: `/proyectos/${projectId}/tareas`,
      icon: 'BarChart3',
      category: 'tasks',
    });
  }

  // Check for areas with zero documents
  const emptyDocAreas = areas.filter(a => !docsByArea[a.code] || docsByArea[a.code] === 0);

  if (emptyDocAreas.length > 0 && emptyDocAreas.length < areas.length) {
    const areaNames = emptyDocAreas.slice(0, 3).map(a => a.name).join(', ');
    const moreCount = emptyDocAreas.length > 3 ? ` y ${emptyDocAreas.length - 3} mas` : '';

    suggestions.push({
      id: `empty_vdr_areas_${projectId}`,
      priority: 'P2',
      title: `${emptyDocAreas.length} areas sin documentos en VDR`,
      description: `Faltan documentos en: ${areaNames}${moreCount}`,
      action_url: `/proyectos/${projectId}/vdr`,
      icon: 'FolderOpen',
      category: 'vdr',
    });
  }

  return suggestions;
}

async function getGroundingSuggestions(projectId: string): Promise<Suggestion[]> {
  const suggestions: Suggestion[] = [];

  // Check for low grounding scores in recent tool executions
  const { data: recentExecs } = await supabaseAdmin
    .from('dd_tool_executions')
    .select('id, tool_id, output_data, completed_at')
    .eq('project_id', projectId)
    .eq('status', 'completed')
    .order('completed_at', { ascending: false })
    .limit(20);

  if (!recentExecs || recentExecs.length === 0) return suggestions;

  const lowGrounding: string[] = [];
  for (const exec of recentExecs) {
    const output = exec.output_data as Record<string, unknown> | null;
    if (output && typeof output.grounding_score === 'number' && output.grounding_score < 70) {
      lowGrounding.push(exec.id);
    }
  }

  if (lowGrounding.length > 0) {
    suggestions.push({
      id: `low_grounding_${projectId}`,
      priority: 'P1',
      title: `${lowGrounding.length} salidas IA con grounding bajo (<70%)`,
      description: 'Revisar manualmente los resultados con puntuacion baja de fundamentacion',
      action_url: `/proyectos/${projectId}/herramientas?filter=low_grounding`,
      icon: 'ShieldAlert',
      category: 'tasks',
    });
  }

  return suggestions;
}

async function getContingencySuggestions(projectId: string): Promise<Suggestion[]> {
  const suggestions: Suggestion[] = [];

  // Check for unresolved critical/high contingencies
  const { data: contingencies } = await supabaseAdmin
    .from('dd_contingencies')
    .select('id, severity, status, title')
    .eq('project_id', projectId)
    .in('status', ['identified', 'confirmed'])
    .in('severity', ['critical', 'high'])
    .limit(20);

  if (!contingencies || contingencies.length === 0) return suggestions;

  const criticalCount = contingencies.filter(c => c.severity === 'critical').length;

  suggestions.push({
    id: `contingencies_${projectId}`,
    priority: criticalCount > 0 ? 'P0' : 'P1',
    title: `${contingencies.length} contingencias criticas/altas sin resolver`,
    description: criticalCount > 0
      ? `${criticalCount} contingencias criticas requieren atencion inmediata`
      : `${contingencies.length} contingencias de alta severidad abiertas`,
    action_url: `/proyectos/${projectId}/contingencias`,
    icon: 'Shield',
    category: 'tasks',
  });

  return suggestions;
}

// ────────────────────────────────────────────────────────────
// Priority ordering
// ────────────────────────────────────────────────────────────

const PRIORITY_ORDER: Record<string, number> = { P0: 0, P1: 1, P2: 2, P3: 3 };

function sortSuggestions(suggestions: Suggestion[]): Suggestion[] {
  return suggestions.sort((a, b) => {
    const pa = PRIORITY_ORDER[a.priority] ?? 99;
    const pb = PRIORITY_ORDER[b.priority] ?? 99;
    return pa - pb;
  });
}

// ────────────────────────────────────────────────────────────
// Context-based filtering
// ────────────────────────────────────────────────────────────

function filterByContext(suggestions: Suggestion[], context: SuggestContext): Suggestion[] {
  if (context === 'dashboard') return suggestions; // Show all on dashboard

  const contextCategories: Record<SuggestContext, string[]> = {
    dashboard: [],
    vdr: ['vdr'],
    qa: ['qa'],
    tasks: ['tasks'],
  };

  const allowedCategories = contextCategories[context];
  if (!allowedCategories || allowedCategories.length === 0) return suggestions;

  // Always include P0 regardless of context
  return suggestions.filter(
    s => s.priority === 'P0' || allowedCategories.includes(s.category)
  );
}

// ────────────────────────────────────────────────────────────
// API Route
// ────────────────────────────────────────────────────────────

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { project_id, context } = body as {
      project_id?: string;
      context?: SuggestContext;
    };

    if (!project_id) {
      return NextResponse.json(
        { error: 'project_id es requerido' },
        { status: 400 }
      );
    }

    const validContexts: SuggestContext[] = ['dashboard', 'vdr', 'qa', 'tasks'];
    const effectiveContext: SuggestContext = validContexts.includes(context as SuggestContext)
      ? (context as SuggestContext)
      : 'dashboard';

    // Run all suggestion generators in parallel
    const [
      slaSuggestions,
      pendingQA,
      staleTasks,
      hitlSuggestions,
      coverageSuggestions,
      groundingSuggestions,
      contingencySuggestions,
    ] = await Promise.all([
      getSLASuggestions(project_id),
      getPendingQASuggestions(project_id),
      getStaleTasksSuggestions(project_id),
      getHITLSuggestions(project_id),
      getVDRCoverageSuggestions(project_id),
      getGroundingSuggestions(project_id),
      getContingencySuggestions(project_id),
    ]);

    const allSuggestions = [
      ...slaSuggestions,
      ...pendingQA,
      ...staleTasks,
      ...hitlSuggestions,
      ...coverageSuggestions,
      ...groundingSuggestions,
      ...contingencySuggestions,
    ];

    const filtered = filterByContext(allSuggestions, effectiveContext);
    const sorted = sortSuggestions(filtered);

    return NextResponse.json({
      suggestions: sorted,
      total: sorted.length,
      context: effectiveContext,
    });
  } catch (error) {
    console.error('[AI Suggest] Error:', error);
    return NextResponse.json(
      { error: 'Error interno al generar sugerencias' },
      { status: 500 }
    );
  }
}
