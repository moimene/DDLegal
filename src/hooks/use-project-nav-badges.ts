'use client';

import { useState, useEffect } from 'react';

interface NavBadges {
    informacion: string | null;
    analisis: string | null;
    decision: string | null;
}

function getToken(): string | null {
    if (typeof window === 'undefined') return null;
    return localStorage.getItem('dd_session_token');
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
                const token = getToken();
                const res = await fetch(`/api/projects/${projectId}/nav-badges`, {
                    headers: token ? { Authorization: `Bearer ${token}` } : {},
                });
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
