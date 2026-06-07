import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-admin';

// ---------------------------------------------------------------------------
// GET /api/dashboard/aggregate
// Aggregates cross-project data for the dashboard: KPIs, per-project metrics,
// user's pending tasks, and alerts (blockers + stale tasks).
// ---------------------------------------------------------------------------

export async function GET(req: NextRequest) {
  const userId = req.headers.get('x-user-id');
  if (!userId) {
    return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
  }

  try {
    // 1. Get user's active roles across all projects
    const { data: roles } = await supabaseAdmin
      .from('dd_project_user_roles')
      .select('project_id, role')
      .eq('user_id', userId)
      .eq('is_active', true);

    const projectIds = Array.from(new Set((roles || []).map(r => r.project_id)));
    const roleMap = new Map((roles || []).map(r => [r.project_id, r.role]));

    // 2. If user has no projects, return empty dashboard
    if (projectIds.length === 0) {
      return NextResponse.json({
        success: true,
        kpis: {
          total_projects: 0,
          active_projects: 0,
          my_pending_tasks: 0,
          total_blockers: 0,
          hitl_pending: 0,
        },
        projects: [],
        my_tasks: [],
        alerts: [],
      });
    }

    // 3. Batch all queries in parallel
    const [projectsRes, tasksRes, scoresRes, workflowsRes] = await Promise.all([
      // Projects metadata
      supabaseAdmin
        .from('dd_projects')
        .select('id, name, target_company, deal_type, status, deadline')
        .in('id', projectIds),
      // All kanban tasks for these projects
      supabaseAdmin
        .from('dd_kanban_tasks')
        .select('id, project_id, title, state, priority, area_code, assigned_to, hitl_required, ai_status, entered_state_at')
        .in('project_id', projectIds),
      // Latest risk scores (ordered by created_at DESC so first match per project is latest)
      supabaseAdmin
        .from('dd_deal_risk_scores')
        .select('project_id, overall_score, recommendation')
        .in('project_id', projectIds)
        .order('created_at', { ascending: false }),
      // Active workflow instances
      supabaseAdmin
        .from('dd_workflow_instances')
        .select('project_id, status')
        .in('project_id', projectIds),
    ]);

    const allTasks = tasksRes.data || [];
    const allScores = scoresRes.data || [];
    const allWorkflows = workflowsRes.data || [];

    // Pre-process O(N) structures for faster O(1) lookups
    const projectsData = projectsRes.data || [];
    const projectsMap = new Map(projectsData.map(p => [p.id, p]));

    const scoresMap = new Map<string, any>();
    for (const score of allScores) {
      if (!scoresMap.has(score.project_id)) {
        scoresMap.set(score.project_id, score);
      }
    }

    const workflowsCountMap = new Map<string, number>();
    for (const wf of allWorkflows) {
      if (wf.status === 'in_progress') {
        workflowsCountMap.set(wf.project_id, (workflowsCountMap.get(wf.project_id) || 0) + 1);
      }
    }

    const tasksByProject = new Map<string, any[]>();
    for (const task of allTasks) {
      if (!tasksByProject.has(task.project_id)) {
        tasksByProject.set(task.project_id, []);
      }
      tasksByProject.get(task.project_id)!.push(task);
    }

    // 4. Look up the user's email for assigned_to matching
    let userEmail = '';
    try {
      const { data: { user: authUser } } = await supabaseAdmin.auth.admin.getUserById(userId);
      userEmail = authUser?.email || '';
    } catch {
      // getUserById may fail if user was created outside Supabase Auth — gracefully fall back
      userEmail = '';
    }

    // 5. Build per-project metrics
    const projects = projectsData.map(p => {
      const pTasks = tasksByProject.get(p.id) || [];
      const completed = pTasks.filter(t => t.state === 'done' || t.state === 'closed').length;
      const blocked = pTasks.filter(t => t.state === 'blocked').length;
      const pending = pTasks.filter(t => !['done', 'closed', 'blocked'].includes(t.state)).length;

      // Latest score for this project (scores are ordered by created_at DESC)
      const score = scoresMap.get(p.id);

      // Active workflows for this project
      const activeWf = workflowsCountMap.get(p.id) || 0;

      return {
        id: p.id,
        name: p.name,
        target_company: p.target_company,
        deal_type: p.deal_type,
        status: p.status,
        deadline: p.deadline,
        user_role: roleMap.get(p.id) || 'unknown',
        metrics: {
          total_tasks: pTasks.length,
          pending_tasks: pending,
          blocked_tasks: blocked,
          completed_tasks: completed,
          completion_pct: pTasks.length > 0 ? Math.round((completed / pTasks.length) * 100) : 0,
        },
        risk_score: score?.overall_score ?? null,
        risk_recommendation: score?.recommendation ?? null,
        active_workflows: activeWf,
      };
    });

    // 6. Build "my tasks" list (assigned to current user, not done/closed, sorted by priority)
    const priorityOrder: Record<string, number> = { critical: 0, high: 1, medium: 2, low: 3 };

    const myTasks = allTasks
      .filter(t => t.assigned_to === userEmail && !['done', 'closed'].includes(t.state))
      .sort((a, b) => (priorityOrder[a.priority] ?? 4) - (priorityOrder[b.priority] ?? 4))
      .slice(0, 20)
      .map(t => {
        const proj = projectsMap.get(t.project_id);
        return {
          id: t.id,
          title: t.title,
          project_id: t.project_id,
          project_name: proj?.name || 'Proyecto',
          area_code: t.area_code,
          state: t.state,
          priority: t.priority,
          entered_state_at: t.entered_state_at,
        };
      });

    // 7. Build alerts (blockers + stale tasks)
    const now = Date.now();

    const alerts = allTasks
      .filter(t => {
        if (t.state === 'blocked') return true;
        const daysInState = Math.floor((now - new Date(t.entered_state_at).getTime()) / 86400000);
        return daysInState > 3 && !['done', 'closed'].includes(t.state);
      })
      .slice(0, 10)
      .map(t => {
        const proj = projectsMap.get(t.project_id);
        const daysInState = Math.floor((now - new Date(t.entered_state_at).getTime()) / 86400000);
        return {
          type: t.state === 'blocked' ? 'blocker' : 'stale_task',
          project_id: t.project_id,
          project_name: proj?.name || 'Proyecto',
          title: t.title,
          detail: t.state === 'blocked'
            ? `Bloqueada desde hace ${daysInState}d`
            : `${daysInState} dias en estado ${t.state}`,
          severity: daysInState > 7 ? 'critical' : daysInState > 3 ? 'high' : 'medium',
        };
      });

    // 8. Aggregate KPIs
    const kpis = {
      total_projects: projects.length,
      active_projects: projects.filter(p => p.status === 'active').length,
      my_pending_tasks: myTasks.length,
      total_blockers: allTasks.filter(t => t.state === 'blocked').length,
      hitl_pending: allTasks.filter(t => t.hitl_required && t.state === 'hitl_revision').length,
    };

    return NextResponse.json({
      success: true,
      kpis,
      projects,
      my_tasks: myTasks,
      alerts,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Internal server error';
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
