# Project Navigation Redesign — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Reorganize the project sidebar from a flat 11-item list into 3 collapsible groups aligned with the DD workflow cycle (Informacion, Analisis, Decision), eliminate Deal Cockpit, remove the duplicate Negotiation tab from War Room, and add area-specific views.

**Architecture:** The sidebar component (`sidebar.tsx`) currently builds a flat `NavSection` with all project items. We'll replace the single project section with 3 collapsible `NavGroup` subsections inside it, add localStorage persistence for collapse state, and create a new area page route. Badges will use lightweight API calls to show contextual counts.

**Tech Stack:** Next.js App Router, React (client components), localStorage, Lucide icons, Supabase (existing API routes)

---

### Task 1: Refactor sidebar types and data structure

**Files:**
- Modify: `src/components/layout/sidebar.tsx:20-31` (types)
- Modify: `src/components/layout/sidebar.tsx:72-93` (buildProjectSection)

**Step 1: Add NavGroup type to sidebar.tsx**

Add below the existing `NavSection` interface (line 30):

```typescript
interface NavGroup {
    id: string;
    header: string;
    icon: typeof LayoutDashboard;
    items: NavItem[];
    separator?: { label: string; afterIndex: number };
}

interface NavSectionWithGroups extends Omit<NavSection, 'items'> {
    groups: NavGroup[];
    projectId: string;
}
```

**Step 2: Run TypeScript check**

Run: `cd /Users/moisesmenendez/Dropbox/DD_LEGAL/dd-legal-pmo && npx tsc --noEmit --pretty 2>&1 | head -30`
Expected: No new errors from types alone (they're unused so far)

**Step 3: Commit**

```bash
git add src/components/layout/sidebar.tsx
git commit -m "feat(nav): add NavGroup types for collapsible project navigation"
```

---

### Task 2: Replace buildProjectSection with grouped builder

**Files:**
- Modify: `src/components/layout/sidebar.tsx:72-93`

**Step 1: Replace buildProjectSection function**

Replace the entire `buildProjectSection` function (lines 74-93) with:

```typescript
function buildProjectGroups(projectId: string): NavGroup[] {
    const base = `/projects/${projectId}`;
    return [
        {
            id: 'informacion',
            header: 'Informacion',
            icon: Database,
            items: [
                { label: 'Vista General', icon: Eye, path: base },
                { label: 'Data Room', icon: Database, path: `${base}/vdr` },
                { label: 'Q&A', icon: MessageCircle, path: `${base}/qa` },
            ],
        },
        {
            id: 'analisis',
            header: 'Analisis',
            icon: Target,
            items: [
                { label: 'Kanban', icon: FolderKanban, path: `${base}/kanban` },
                { label: 'Workflows', icon: Workflow, path: `${base}/workflows` },
                { label: 'HITL Review', icon: UserCheck, path: `${base}/hitl` },
                { label: 'Scoring', icon: Target, path: `${base}/scoring` },
            ],
            separator: { label: 'Areas activas', afterIndex: 3 },
        },
        {
            id: 'decision',
            header: 'Decision e Informe',
            icon: Swords,
            items: [
                { label: 'War Room', icon: Swords, path: `${base}/war-room` },
                { label: 'Negociacion', icon: Handshake, path: `${base}/negotiation` },
                { label: 'Actividad', icon: Activity, path: `${base}/activity` },
            ],
        },
    ];
}
```

Note: Deal Cockpit (`{ label: 'Deal Cockpit', icon: Gauge, path: \`${base}/cockpit\` }`) is intentionally removed.

**Step 2: Update useNavSections hook to use groups**

Replace `useNavSections` (lines 99-115) with:

```typescript
interface ResolvedNav {
    sections: NavSection[];
    projectGroups: NavGroup[] | null;
    projectId: string | null;
}

function useResolvedNav(pathname: string): ResolvedNav {
    return useMemo(() => {
        const match = PROJECT_ID_RE.exec(pathname);
        const projectId = match ? match[1] : null;

        const sections: NavSection[] = [NAV_SECTION_NAVEGACION];
        // Non-project sections still use flat NavSection
        sections.push(NAV_SECTION_HERRAMIENTAS);
        sections.push(NAV_SECTION_CONFIGURACION);

        const projectGroups = projectId ? buildProjectGroups(projectId) : null;

        return { sections, projectGroups, projectId };
    }, [pathname]);
}
```

**Step 3: Run TypeScript check**

Run: `cd /Users/moisesmenendez/Dropbox/DD_LEGAL/dd-legal-pmo && npx tsc --noEmit --pretty 2>&1 | head -30`
Expected: Errors about `sections` usage in render (expected — we fix in next task)

**Step 4: Commit**

```bash
git add src/components/layout/sidebar.tsx
git commit -m "feat(nav): replace flat project section with grouped builder"
```

---

### Task 3: Build collapsible group UI component

**Files:**
- Modify: `src/components/layout/sidebar.tsx` (add CollapsibleNavGroup component + localStorage logic)

**Step 1: Add imports and collapse hook**

Add `ChevronDown` to the lucide-react imports (line 7). Add `useEffect` to the React imports (line 3). Add after the type definitions:

```typescript
import { ChevronDown } from 'lucide-react';

const STORAGE_KEY_PREFIX = 'dd-nav-collapsed-';

function useGroupCollapse(projectId: string | null, groups: NavGroup[] | null, pathname: string) {
    const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});

    // Load from localStorage on mount
    useEffect(() => {
        if (!projectId) return;
        try {
            const stored = localStorage.getItem(`${STORAGE_KEY_PREFIX}${projectId}`);
            if (stored) {
                setCollapsed(JSON.parse(stored));
            }
        } catch { /* ignore */ }
    }, [projectId]);

    // Auto-expand group containing active route
    useEffect(() => {
        if (!groups) return;
        const activeGroup = groups.find(g =>
            g.items.some(item => {
                if (item.path === '/' || (PROJECT_ID_RE.test(item.path) && item.path.replace(PROJECT_ID_RE, '').replace(/^\//, '') === '')) {
                    return pathname === item.path;
                }
                return pathname === item.path || pathname.startsWith(item.path + '/');
            })
        );
        if (activeGroup) {
            setCollapsed(prev => {
                if (prev[activeGroup.id] === true) {
                    const next = { ...prev, [activeGroup.id]: false };
                    if (projectId) {
                        try { localStorage.setItem(`${STORAGE_KEY_PREFIX}${projectId}`, JSON.stringify(next)); } catch { /* */ }
                    }
                    return next;
                }
                return prev;
            });
        }
    }, [pathname, groups, projectId]);

    const toggle = (groupId: string) => {
        setCollapsed(prev => {
            const next = { ...prev, [groupId]: !prev[groupId] };
            if (projectId) {
                try { localStorage.setItem(`${STORAGE_KEY_PREFIX}${projectId}`, JSON.stringify(next)); } catch { /* */ }
            }
            return next;
        });
    };

    return { collapsed, toggle };
}
```

**Step 2: Run TypeScript check**

Run: `cd /Users/moisesmenendez/Dropbox/DD_LEGAL/dd-legal-pmo && npx tsc --noEmit --pretty 2>&1 | head -30`

**Step 3: Commit**

```bash
git add src/components/layout/sidebar.tsx
git commit -m "feat(nav): add collapsible group hook with localStorage persistence"
```

---

### Task 4: Update Sidebar render to use collapsible groups

**Files:**
- Modify: `src/components/layout/sidebar.tsx:121-278` (Sidebar component render)

**Step 1: Rewrite the Sidebar component**

Replace the `Sidebar` component export (lines 121-314) with a version that:
1. Uses `useResolvedNav` instead of `useNavSections`
2. Renders flat `NavSection[]` for Navegacion/Herramientas/Configuracion
3. Inserts collapsible project groups between Navegacion and Herramientas
4. Each group header is clickable with a chevron that rotates on collapse
5. Group header shows an accent border when it contains the active route

The collapsible group header should look like:

```tsx
<button
    onClick={() => toggle(group.id)}
    className="w-full flex items-center gap-2 px-3 py-1.5 transition-all"
    style={{
        borderLeft: hasActiveItem ? '2px solid var(--g-brand-bright)' : '2px solid transparent',
    }}
    aria-expanded={!isCollapsed}
>
    <group.icon className="h-3.5 w-3.5 shrink-0" style={{ color: 'rgba(255,255,255,0.5)' }} />
    {!sidebarCollapsed && (
        <>
            <span style={{
                fontSize: '0.6875rem',
                fontWeight: 700,
                textTransform: 'uppercase',
                letterSpacing: '0.08em',
                color: 'rgba(255,255,255,0.5)',
                flex: 1,
                textAlign: 'left',
            }}>
                {group.header}
            </span>
            <ChevronDown
                className="h-3 w-3 transition-transform"
                style={{
                    color: 'rgba(255,255,255,0.3)',
                    transform: isCollapsed ? 'rotate(-90deg)' : 'rotate(0deg)',
                }}
            />
        </>
    )}
</button>
```

Items within a group render with the same `<Link>` styling as currently exists.

When `sidebarCollapsed` (icon mode), group headers show just the icon; hovering shows a popover with the group name and items.

**Step 2: Run the dev server and verify visually**

Run: `cd /Users/moisesmenendez/Dropbox/DD_LEGAL/dd-legal-pmo && npm run dev`
Navigate to any project URL. Verify:
- 3 collapsible groups appear in sidebar under "Proyecto"
- Clicking group header expands/collapses
- Deal Cockpit is NOT in the list
- Active route's group is auto-expanded
- Collapsing and refreshing preserves state

**Step 3: Run TypeScript check**

Run: `npx tsc --noEmit --pretty 2>&1 | head -30`
Expected: PASS

**Step 4: Commit**

```bash
git add src/components/layout/sidebar.tsx
git commit -m "feat(nav): render collapsible project navigation groups in sidebar"
```

---

### Task 5: Add badges to group headers

**Files:**
- Modify: `src/components/layout/sidebar.tsx` (add badge rendering in group headers)
- Create: `src/hooks/use-project-nav-badges.ts` (hook to fetch badge counts)

**Step 1: Create the badges hook**

Create `src/hooks/use-project-nav-badges.ts`:

```typescript
'use client';

import { useState, useEffect } from 'react';

interface NavBadges {
    informacion: string | null;
    analisis: string | null;
    decision: string | null;
}

export function useProjectNavBadges(projectId: string | null): NavBadges {
    const [badges, setBadges] = useState<NavBadges>({
        informacion: null,
        analisis: null,
        decision: null,
    });

    useEffect(() => {
        if (!projectId) return;

        async function fetchBadges() {
            try {
                const res = await fetch(`/api/projects/${projectId}/nav-badges`);
                if (res.ok) {
                    const data = await res.json();
                    setBadges({
                        informacion: data.pending_docs > 0 ? `${data.pending_docs} pendientes` : null,
                        analisis: data.pending_hitl > 0 ? `${data.pending_hitl} HITL` : null,
                        decision: data.red_flags > 0 ? `${data.red_flags} red flags` : null,
                    });
                }
            } catch { /* silent fail — badges are optional */ }
        }

        fetchBadges();
        const interval = setInterval(fetchBadges, 60_000); // refresh every 60s
        return () => clearInterval(interval);
    }, [projectId]);

    return badges;
}
```

**Step 2: Create the API endpoint**

Create `src/app/api/projects/[id]/nav-badges/route.ts`:

```typescript
import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function GET(
    _req: Request,
    { params }: { params: Promise<{ id: string }> }
) {
    const { id: projectId } = await params;
    const supabase = await createClient();

    // Count pending docs (VDR expected - uploaded)
    const { data: vdrData } = await supabase
        .from('dd_documents')
        .select('id', { count: 'exact' })
        .eq('project_id', projectId);

    const { data: expectedData } = await supabase
        .from('dd_expected_documents')
        .select('id', { count: 'exact' })
        .eq('project_id', projectId);

    const pendingDocs = Math.max(
        (expectedData?.length || 0) - (vdrData?.length || 0),
        0
    );

    // Count HITL pending tasks
    const { count: pendingHitl } = await supabase
        .from('dd_kanban_tasks')
        .select('id', { count: 'exact', head: true })
        .eq('project_id', projectId)
        .eq('state', 'hitl_review');

    // Count red flags (critical + high contingencies)
    const { count: redFlags } = await supabase
        .from('dd_contingencies')
        .select('id', { count: 'exact', head: true })
        .eq('project_id', projectId)
        .in('severity', ['critical', 'high']);

    return NextResponse.json({
        pending_docs: pendingDocs,
        pending_hitl: pendingHitl || 0,
        red_flags: redFlags || 0,
    });
}
```

**Step 3: Wire badges into sidebar group headers**

In `sidebar.tsx`, import and use the hook. Display badge next to group header:

```tsx
{badge && !sidebarCollapsed && (
    <span style={{
        fontSize: '0.5625rem',
        fontWeight: 600,
        color: 'var(--g-brand-3308)',
        backgroundColor: 'var(--g-brand-bright)',
        borderRadius: 'var(--g-radius-full)',
        padding: '1px 6px',
        lineHeight: '1.4',
        whiteSpace: 'nowrap',
    }}>
        {badge}
    </span>
)}
```

**Step 4: Run dev server and verify badges appear**

Run: `npm run dev`
Expected: Badges show counts next to group headers. If no data, badges are hidden.

**Step 5: Run TypeScript check**

Run: `npx tsc --noEmit --pretty 2>&1 | head -30`
Expected: PASS

**Step 6: Commit**

```bash
git add src/hooks/use-project-nav-badges.ts src/app/api/projects/[id]/nav-badges/route.ts src/components/layout/sidebar.tsx
git commit -m "feat(nav): add contextual badges to collapsible group headers"
```

---

### Task 6: Remove Deal Cockpit route and tab from War Room

**Files:**
- Delete: `src/app/projects/[id]/cockpit/page.tsx`
- Delete: `src/app/api/projects/[id]/cockpit/route.ts`
- Modify: `src/app/projects/[id]/war-room/page.tsx:293-301` (remove negotiation tab)

**Step 1: Delete cockpit page**

```bash
rm src/app/projects/[id]/cockpit/page.tsx
```

**Step 2: Delete cockpit API route**

```bash
rm src/app/api/projects/[id]/cockpit/route.ts
```

Check if the directory is now empty and remove it:
```bash
rmdir src/app/projects/[id]/cockpit src/app/api/projects/[id]/cockpit 2>/dev/null || true
```

**Step 3: Remove the "Negociacion" tab from War Room**

In `src/app/projects/[id]/war-room/page.tsx`, modify lines 293-301:

Change the `TabKey` type from:
```typescript
type TabKey = 'dashboard' | 'timeline' | 'negotiation' | 'spa' | 'resolutions';
```
To:
```typescript
type TabKey = 'dashboard' | 'timeline' | 'spa' | 'resolutions';
```

Remove from TABS array (line 298):
```typescript
    { key: 'negotiation', label: 'Negociacion', icon: BarChart3 },
```

Also remove the negotiation tab rendering section in the component (search for `activeTab === 'negotiation'` and remove that conditional block and its associated state/fetch logic).

**Step 4: Search for any remaining cockpit references**

Run: `grep -r "cockpit" src/ --include="*.tsx" --include="*.ts" -l`
Expected: No files should reference cockpit anymore (except maybe types that can be cleaned later).

**Step 5: Run TypeScript check**

Run: `npx tsc --noEmit --pretty 2>&1 | head -30`
Expected: PASS

**Step 6: Run dev server and verify**

- `/projects/[id]/cockpit` should return 404
- War Room should show 4 tabs (no "Negociacion")
- Sidebar should not show Deal Cockpit

**Step 7: Commit**

```bash
git add -A
git commit -m "feat(nav): remove Deal Cockpit route and Negotiation tab from War Room"
```

---

### Task 7: Create area page route

**Files:**
- Create: `src/app/projects/[id]/areas/[code]/page.tsx`

**Step 1: Create the area page**

Create `src/app/projects/[id]/areas/[code]/page.tsx`:

```typescript
'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { ArrowLeft, Loader2, AlertTriangle, Filter } from 'lucide-react';
import { useResolvedParams, AREA_COLORS, SEVERITY_CONFIG, formatDate } from '@/lib/utils';

interface AreaTask {
    id: string;
    title: string;
    state: string;
    severity: string | null;
    assigned_to: string | null;
    updated_at: string;
}

interface AreaContingency {
    id: string;
    title: string;
    severity: string;
    probability: string;
    estimated_amount: number | null;
    status: string;
    recommendation: string | null;
}

interface AreaData {
    area_code: string;
    area_name: string;
    tasks: AreaTask[];
    contingencies: AreaContingency[];
}

export default function AreaPage({ params }: { params: Promise<{ id: string; code: string }> }) {
    const { id, code } = useResolvedParams(params);
    const [data, setData] = useState<AreaData | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [severityFilter, setSeverityFilter] = useState<string>('all');

    const areaColor = AREA_COLORS[code] || AREA_COLORS.GENERAL;

    useEffect(() => {
        async function fetchArea() {
            try {
                const res = await fetch(`/api/projects/${id}/areas/${code}`);
                const json = await res.json();
                if (json.success) {
                    setData(json.data);
                } else {
                    setError(json.error || 'Error al cargar area');
                }
            } catch {
                setError('Error de conexion');
            } finally {
                setLoading(false);
            }
        }
        fetchArea();
    }, [id, code]);

    if (loading) {
        return (
            <div className="animate-fade-in flex flex-col items-center justify-center" style={{ minHeight: '60vh', gap: 'var(--g-space-4)' }}>
                <Loader2 className="h-8 w-8 animate-spin" style={{ color: 'var(--g-brand-3308)' }} />
                <p className="text-sm" style={{ color: 'var(--g-text-secondary)' }}>Cargando area {code}...</p>
            </div>
        );
    }

    if (error || !data) {
        return (
            <div className="animate-fade-in flex flex-col items-center justify-center" style={{ minHeight: '60vh', gap: 'var(--g-space-4)' }}>
                <AlertTriangle className="h-8 w-8" style={{ color: 'var(--status-error)' }} />
                <p className="text-sm" style={{ color: 'var(--g-text-secondary)' }}>{error}</p>
                <Link href={`/projects/${id}`} className="text-sm" style={{ color: 'var(--g-link)' }}>Volver al proyecto</Link>
            </div>
        );
    }

    const filteredContingencies = severityFilter === 'all'
        ? data.contingencies
        : data.contingencies.filter(c => c.severity === severityFilter);

    return (
        <div className="animate-fade-in" style={{ display: 'flex', flexDirection: 'column', gap: 'var(--g-space-6)' }}>
            {/* Header */}
            <div>
                <Link href={`/projects/${id}/kanban`} className="inline-flex items-center gap-1 text-sm mb-3" style={{ color: 'var(--g-link)' }}>
                    <ArrowLeft className="h-4 w-4" /> Kanban
                </Link>
                <div className="flex items-center gap-3">
                    <span
                        className="px-2 py-0.5 text-xs font-bold"
                        style={{
                            borderRadius: 'var(--g-radius-sm)',
                            backgroundColor: `hsla(${areaColor}, 0.12)`,
                            color: `hsla(${areaColor}, 1)`,
                        }}
                    >
                        {code}
                    </span>
                    <h1 className="font-bold" style={{ fontSize: 'var(--g-text-h1)', color: 'var(--g-text-primary)' }}>
                        {data.area_name}
                    </h1>
                </div>
            </div>

            {/* Contingencies table */}
            <div style={{
                backgroundColor: 'var(--g-surface-card)',
                borderRadius: 'var(--g-radius-lg)',
                border: '1px solid var(--g-border-default)',
                padding: 'var(--g-space-5)',
            }}>
                <div className="flex items-center justify-between mb-4">
                    <h2 className="font-bold text-sm" style={{ color: 'var(--g-text-primary)' }}>
                        Contingencias ({filteredContingencies.length})
                    </h2>
                    <div className="flex items-center gap-2">
                        <Filter className="h-3.5 w-3.5" style={{ color: 'var(--g-text-secondary)' }} />
                        <select
                            value={severityFilter}
                            onChange={e => setSeverityFilter(e.target.value)}
                            className="text-xs px-2 py-1"
                            style={{
                                borderRadius: 'var(--g-radius-sm)',
                                border: '1px solid var(--g-border-default)',
                                backgroundColor: 'var(--g-surface-card)',
                                color: 'var(--g-text-primary)',
                            }}
                        >
                            <option value="all">Todas</option>
                            <option value="critical">Critica</option>
                            <option value="high">Alta</option>
                            <option value="medium">Media</option>
                            <option value="low">Baja</option>
                        </select>
                    </div>
                </div>

                {filteredContingencies.length === 0 ? (
                    <p className="text-xs text-center py-6" style={{ color: 'var(--g-text-secondary)' }}>
                        Sin contingencias para este filtro.
                    </p>
                ) : (
                    <div style={{ overflowX: 'auto' }}>
                        <table className="w-full text-xs" style={{ borderCollapse: 'collapse' }}>
                            <thead>
                                <tr style={{ borderBottom: '1px solid var(--g-border-default)' }}>
                                    <th className="text-left py-2 px-2 font-medium" style={{ color: 'var(--g-text-secondary)' }}>Titulo</th>
                                    <th className="text-left py-2 px-2 font-medium" style={{ color: 'var(--g-text-secondary)' }}>Severidad</th>
                                    <th className="text-left py-2 px-2 font-medium" style={{ color: 'var(--g-text-secondary)' }}>Probabilidad</th>
                                    <th className="text-left py-2 px-2 font-medium" style={{ color: 'var(--g-text-secondary)' }}>Estado</th>
                                    <th className="text-left py-2 px-2 font-medium" style={{ color: 'var(--g-text-secondary)' }}>Recomendacion</th>
                                </tr>
                            </thead>
                            <tbody>
                                {filteredContingencies.map(c => {
                                    const sevCfg = SEVERITY_CONFIG[c.severity as keyof typeof SEVERITY_CONFIG];
                                    return (
                                        <tr key={c.id} style={{ borderBottom: '1px solid var(--g-border-default)' }}>
                                            <td className="py-2 px-2 font-medium" style={{ color: 'var(--g-text-primary)' }}>{c.title}</td>
                                            <td className="py-2 px-2">
                                                <span className="px-1.5 py-0.5" style={{
                                                    borderRadius: 'var(--g-radius-sm)',
                                                    backgroundColor: sevCfg?.color || 'var(--g-surface-muted)',
                                                    color: '#fff',
                                                }}>
                                                    {sevCfg?.label || c.severity}
                                                </span>
                                            </td>
                                            <td className="py-2 px-2" style={{ color: 'var(--g-text-secondary)' }}>{c.probability}</td>
                                            <td className="py-2 px-2" style={{ color: 'var(--g-text-secondary)' }}>{c.status}</td>
                                            <td className="py-2 px-2" style={{ color: 'var(--g-text-secondary)' }}>{c.recommendation || '—'}</td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>

            {/* Tasks table */}
            <div style={{
                backgroundColor: 'var(--g-surface-card)',
                borderRadius: 'var(--g-radius-lg)',
                border: '1px solid var(--g-border-default)',
                padding: 'var(--g-space-5)',
            }}>
                <h2 className="font-bold text-sm mb-4" style={{ color: 'var(--g-text-primary)' }}>
                    Tareas ({data.tasks.length})
                </h2>
                {data.tasks.length === 0 ? (
                    <p className="text-xs text-center py-6" style={{ color: 'var(--g-text-secondary)' }}>
                        Sin tareas en esta area.
                    </p>
                ) : (
                    <div style={{ overflowX: 'auto' }}>
                        <table className="w-full text-xs" style={{ borderCollapse: 'collapse' }}>
                            <thead>
                                <tr style={{ borderBottom: '1px solid var(--g-border-default)' }}>
                                    <th className="text-left py-2 px-2 font-medium" style={{ color: 'var(--g-text-secondary)' }}>Titulo</th>
                                    <th className="text-left py-2 px-2 font-medium" style={{ color: 'var(--g-text-secondary)' }}>Estado</th>
                                    <th className="text-left py-2 px-2 font-medium" style={{ color: 'var(--g-text-secondary)' }}>Asignado</th>
                                    <th className="text-left py-2 px-2 font-medium" style={{ color: 'var(--g-text-secondary)' }}>Actualizado</th>
                                </tr>
                            </thead>
                            <tbody>
                                {data.tasks.map(t => (
                                    <tr key={t.id} style={{ borderBottom: '1px solid var(--g-border-default)' }}>
                                        <td className="py-2 px-2 font-medium" style={{ color: 'var(--g-text-primary)' }}>{t.title}</td>
                                        <td className="py-2 px-2" style={{ color: 'var(--g-text-secondary)' }}>{t.state}</td>
                                        <td className="py-2 px-2" style={{ color: 'var(--g-text-secondary)' }}>{t.assigned_to || '—'}</td>
                                        <td className="py-2 px-2" style={{ color: 'var(--g-text-secondary)' }}>{formatDate(t.updated_at)}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>
        </div>
    );
}
```

**Step 2: Create the area API endpoint**

Create `src/app/api/projects/[id]/areas/[code]/route.ts`:

```typescript
import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

const AREA_NAMES: Record<string, string> = {
    MERC: 'Mercantil / Societario',
    CONT: 'Contratos',
    LAB: 'Laboral',
    FISC: 'Fiscal',
    INM: 'Inmobiliario',
    PI: 'Propiedad Industrial',
    LIT: 'Litigios',
    ADMIN: 'Administrativo',
    MA: 'M&A Transversal',
    DATOS: 'Proteccion de Datos',
    GENERAL: 'General',
};

export async function GET(
    _req: Request,
    { params }: { params: Promise<{ id: string; code: string }> }
) {
    const { id: projectId, code } = await params;
    const supabase = await createClient();

    const [tasksRes, contingenciesRes] = await Promise.all([
        supabase
            .from('dd_kanban_tasks')
            .select('id, title, state, severity, assigned_to, updated_at')
            .eq('project_id', projectId)
            .eq('area_code', code)
            .order('updated_at', { ascending: false }),
        supabase
            .from('dd_contingencies')
            .select('id, title, severity, probability, estimated_amount, status, recommendation')
            .eq('project_id', projectId)
            .eq('area_code', code)
            .order('severity', { ascending: true }),
    ]);

    return NextResponse.json({
        success: true,
        data: {
            area_code: code,
            area_name: AREA_NAMES[code] || code,
            tasks: tasksRes.data || [],
            contingencies: contingenciesRes.data || [],
        },
    });
}
```

**Step 3: Run TypeScript check**

Run: `npx tsc --noEmit --pretty 2>&1 | head -30`
Expected: PASS

**Step 4: Commit**

```bash
git add src/app/projects/[id]/areas/ src/app/api/projects/[id]/areas/
git commit -m "feat(nav): add area page with normalized tables and API endpoint"
```

---

### Task 8: Add dynamic area items to Analisis group in sidebar

**Files:**
- Modify: `src/components/layout/sidebar.tsx` (inject area items dynamically)
- Create: `src/hooks/use-project-areas.ts`

**Step 1: Create hook to fetch active areas**

Create `src/hooks/use-project-areas.ts`:

```typescript
'use client';

import { useState, useEffect } from 'react';

interface ActiveArea {
    code: string;
    name: string;
}

const AREA_NAMES: Record<string, string> = {
    MERC: 'Societario',
    CONT: 'Contratos',
    LAB: 'Laboral',
    FISC: 'Fiscal',
    INM: 'Inmobiliario',
    PI: 'Propiedad Industrial',
    LIT: 'Litigios',
    ADMIN: 'Administrativo',
    MA: 'M&A',
    DATOS: 'Datos',
    GENERAL: 'General',
};

export function useProjectAreas(projectId: string | null): ActiveArea[] {
    const [areas, setAreas] = useState<ActiveArea[]>([]);

    useEffect(() => {
        if (!projectId) return;

        async function fetchAreas() {
            try {
                const res = await fetch(`/api/projects/${projectId}/active-areas`);
                if (res.ok) {
                    const data = await res.json();
                    setAreas(data.areas || []);
                }
            } catch { /* silent */ }
        }

        fetchAreas();
    }, [projectId]);

    return areas;
}
```

**Step 2: Create the active-areas API endpoint**

Create `src/app/api/projects/[id]/active-areas/route.ts`:

```typescript
import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

const AREA_NAMES: Record<string, string> = {
    MERC: 'Societario',
    CONT: 'Contratos',
    LAB: 'Laboral',
    FISC: 'Fiscal',
    INM: 'Inmobiliario',
    PI: 'Propiedad Industrial',
    LIT: 'Litigios',
    ADMIN: 'Administrativo',
    MA: 'M&A',
    DATOS: 'Datos',
    GENERAL: 'General',
};

export async function GET(
    _req: Request,
    { params }: { params: Promise<{ id: string }> }
) {
    const { id: projectId } = await params;
    const supabase = await createClient();

    // Get distinct area_codes that have tasks in this project
    const { data } = await supabase
        .from('dd_kanban_tasks')
        .select('area_code')
        .eq('project_id', projectId)
        .not('area_code', 'is', null);

    const uniqueCodes = [...new Set((data || []).map(d => d.area_code))].filter(Boolean);
    const areas = uniqueCodes.map(code => ({
        code,
        name: AREA_NAMES[code] || code,
    }));

    return NextResponse.json({ areas });
}
```

**Step 3: In sidebar.tsx, inject area items into the Analisis group**

Import `useProjectAreas` and after building `projectGroups`, append area items to the 'analisis' group:

```typescript
// In Sidebar component, after getting projectGroups:
const activeAreas = useProjectAreas(projectId);

// Dynamically add area NavItems to the analisis group
const enrichedGroups = useMemo(() => {
    if (!projectGroups || !projectId) return projectGroups;
    return projectGroups.map(g => {
        if (g.id !== 'analisis') return g;
        const areaItems: NavItem[] = activeAreas.map(area => ({
            label: area.name,
            icon: FileText, // generic for areas
            path: `/projects/${projectId}/areas/${area.code}`,
        }));
        return { ...g, items: [...g.items, ...areaItems] };
    });
}, [projectGroups, activeAreas, projectId]);
```

**Step 4: Run dev server and verify**

- Areas with tasks should appear under a "Areas activas" separator in the Analisis group
- Clicking an area navigates to the area page with tables

**Step 5: Run TypeScript check**

Run: `npx tsc --noEmit --pretty 2>&1 | head -30`
Expected: PASS

**Step 6: Commit**

```bash
git add src/hooks/use-project-areas.ts src/app/api/projects/[id]/active-areas/ src/components/layout/sidebar.tsx
git commit -m "feat(nav): dynamically inject active area links into Analisis group"
```

---

### Task 9: Final verification and cleanup

**Files:**
- All modified files

**Step 1: Run full TypeScript check**

Run: `cd /Users/moisesmenendez/Dropbox/DD_LEGAL/dd-legal-pmo && npx tsc --noEmit --pretty`
Expected: PASS with no errors

**Step 2: Run linter**

Run: `npx next lint 2>&1 | tail -20`
Expected: No new warnings/errors

**Step 3: Search for orphaned references**

Run: `grep -r "cockpit" src/ --include="*.tsx" --include="*.ts" -l`
Expected: No results

Run: `grep -r "Deal Cockpit" src/ --include="*.tsx" --include="*.ts" -l`
Expected: No results

**Step 4: Verify all routes work**

Start dev server: `npm run dev`

Test these URLs manually:
- `/projects/[id]` — Vista General loads, sidebar shows 3 groups
- `/projects/[id]/kanban` — Analisis group auto-expanded
- `/projects/[id]/war-room` — 4 tabs (no Negociacion), Decision group expanded
- `/projects/[id]/cockpit` — 404
- `/projects/[id]/areas/CONT` — Area page loads with tables
- Collapse sidebar — groups show as icons
- Toggle group collapse — state persists after refresh

**Step 5: Commit final cleanup if any**

```bash
git add -A
git commit -m "chore(nav): final cleanup and verification of navigation redesign"
```
