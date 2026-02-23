'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useResolvedParams } from '@/lib/utils';

/**
 * Deal Cockpit has been removed.
 * This page redirects to the project page for backwards compatibility.
 */
export default function CockpitRedirect({ params }: { params: Promise<{ id: string }> }) {
    const { id } = useResolvedParams(params);
    const router = useRouter();

    useEffect(() => {
        router.replace(`/projects/${id}`);
    }, [id, router]);

    return null;
}
