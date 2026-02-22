'use client';

import { useState, useEffect } from 'react';

interface ActiveArea {
    code: string;
    name: string;
}

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
            } catch { /* silent fail — areas are optional enhancement */ }
        }

        fetchAreas();
    }, [projectId]);

    return areas;
}
