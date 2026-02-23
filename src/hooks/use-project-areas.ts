'use client';

import { useState, useEffect } from 'react';

interface ActiveArea {
    code: string;
    name: string;
}

function getToken(): string | null {
    if (typeof window === 'undefined') return null;
    return localStorage.getItem('dd_session_token');
}

export function useProjectAreas(projectId: string | null): ActiveArea[] {
    const [areas, setAreas] = useState<ActiveArea[]>([]);

    useEffect(() => {
        if (!projectId) return;

        async function fetchAreas() {
            try {
                const token = getToken();
                const res = await fetch(`/api/projects/${projectId}/active-areas`, {
                    headers: token ? { Authorization: `Bearer ${token}` } : {},
                });
                if (res.ok) {
                    const data = await res.json();
                    setAreas(data.areas || []);
                }
            } catch { /* silent fail — areas are optional enhancement */ }
        }

        fetchAreas();
    }, [projectId]);

    return areas;
}
