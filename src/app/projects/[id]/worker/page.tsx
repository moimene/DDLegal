'use client';

/**
 * Worker Dashboard Page
 *
 * Displays the DD Worker monitoring and control interface for a specific project.
 * Uses Next.js 14 async params pattern.
 */

import { use } from 'react';
import { WorkerDashboard } from '@/components/worker/worker-dashboard';

interface Props {
  params: Promise<{ id: string }>;
}

export default function WorkerPage({ params }: Props) {
  const { id } = use(params);

  return <WorkerDashboard projectId={id} />;
}
