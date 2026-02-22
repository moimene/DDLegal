import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { requirePermission } from '@/lib/auth/require-permission';

interface ProgressByArea {
    area_id: string;
    area_name: string;
    area_color: string | null;
    completed: number;
    total: number;
    pct: number;
}

export async function GET(
    _req: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const { id } = await params;

        // Permission check
        const { authorized, error: authError } = await requirePermission(_req, id, 'can_view_reports');
        if (!authorized) return authError!;

        const [projectRes, areasRes, tasksRes, contingenciesRes] = await Promise.all([
            supabaseAdmin.from('dd_projects').select('*').eq('id', id).single(),
            supabaseAdmin.from('dd_areas').select('*').order('sort_order'),
            supabaseAdmin.from('dd_tasks').select('*').eq('project_id', id),
            supabaseAdmin.from('dd_contingencies').select('*').eq('project_id', id),
        ]);

        if (projectRes.error || !projectRes.data) {
            return NextResponse.json({ error: 'Project not found.' }, { status: 404 });
        }

        const project = projectRes.data;
        const areas = areasRes.data || [];

        let tasks = tasksRes.data || [];
        let contingencies = contingenciesRes.data || [];

        // Visibility filter on tasks/contingencies when columns exist.
        // If columns are not available yet, fallback to a safe subset.
        const taskHasClientVisible =
            tasks.length === 0 || Object.prototype.hasOwnProperty.call(tasks[0], 'client_visible');
        const contingencyHasClientVisible =
            contingencies.length === 0 || Object.prototype.hasOwnProperty.call(contingencies[0], 'client_visible');

        if (taskHasClientVisible) {
            tasks = tasks.filter((t: Record<string, unknown>) => t.client_visible === true);
        } else {
            tasks = tasks.filter((t: Record<string, unknown>) => t.status === 'blocked' || t.status === 'completed');
        }

        if (contingencyHasClientVisible) {
            contingencies = contingencies.filter((c: Record<string, unknown>) => c.client_visible === true);
        }

        const confirmedFlags = contingencies.filter(
            (c: Record<string, unknown>) => c.status === 'confirmed' || c.status === 'identified'
        );
        const blockers = tasks.filter((t: Record<string, unknown>) => t.status === 'blocked');
        const nextMilestones = tasks
            .filter((t: Record<string, unknown>) => t.due_date)
            .sort((a: Record<string, unknown>, b: Record<string, unknown>) => {
                const aDate = new Date(String(a.due_date)).getTime();
                const bDate = new Date(String(b.due_date)).getTime();
                return aDate - bDate;
            })
            .slice(0, 5);

        const progressByArea: ProgressByArea[] = areas
            .map((area: Record<string, unknown>) => {
                const areaTasks = tasks.filter((t: Record<string, unknown>) => t.area_id === area.id);
                const total = areaTasks.length;
                const completed = areaTasks.filter((t: Record<string, unknown>) => t.status === 'completed').length;
                const pct = total > 0 ? Math.round((completed / total) * 100) : 0;
                return {
                    area_id: String(area.id),
                    area_name: String(area.name),
                    area_color: (area.color as string | null) || null,
                    completed,
                    total,
                    pct,
                };
            })
            .filter((row) => row.total > 0);

        return NextResponse.json({
            success: true,
            project: {
                id: project.id,
                name: project.name,
                target_company: project.target_company,
                status: project.status,
                deadline: project.deadline,
            },
            progress_by_area: progressByArea,
            confirmed_flags: confirmedFlags,
            blockers,
            next_milestones: nextMilestones,
        });
    } catch (error) {
        console.error('Client project API error:', error);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}

