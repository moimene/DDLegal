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
        const interval = setInterval(fetchBadges, 60_000);
        return () => clearInterval(interval);
    }, [projectId]);

    return badges;
}
