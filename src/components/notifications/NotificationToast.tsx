'use client';

import { useEffect, useRef, useCallback } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { toast } from 'sonner';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface SSEEvent {
    id: string;
    type:
        | 'tool_completed'
        | 'tool_failed'
        | 'document_uploaded'
        | 'qa_new'
        | 'qa_answer'
        | 'qa_sla_breached'
        | 'hitl_required'
        | 'report_ready'
        | 'milestone';
    title: string;
    description: string;
    action_url: string | null;
    project_id: string;
    created_at: string;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function extractProjectId(pathname: string): string | null {
    const match = pathname.match(/\/projects\/([^/]+)/);
    return match ? match[1] : null;
}

const MAX_DEDUP_IDS = 20;

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

/**
 * NotificationToast
 *
 * Invisible client component that connects to the SSE stream when the user
 * is viewing a project page, and surfaces real-time toast notifications via
 * sonner.  Includes deduplication of the last 20 event IDs.
 */
export default function NotificationToast() {
    const pathname = usePathname();
    const router = useRouter();
    const projectId = extractProjectId(pathname);

    // Dedup ring buffer
    const seenIdsRef = useRef<string[]>([]);

    const addSeenId = useCallback((id: string) => {
        const seen = seenIdsRef.current;
        if (seen.length >= MAX_DEDUP_IDS) {
            seen.shift();
        }
        seen.push(id);
    }, []);

    const isSeen = useCallback((id: string): boolean => {
        return seenIdsRef.current.includes(id);
    }, []);

    // Show toast mapped to event type
    const showToast = useCallback(
        (event: SSEEvent) => {
            const navigateAction = event.action_url
                ? {
                      label: 'Ver detalle',
                      onClick: () => router.push(event.action_url!),
                  }
                : undefined;

            switch (event.type) {
                case 'tool_completed':
                    toast.success(event.title, {
                        description: event.description,
                        action: navigateAction,
                        duration: 5000,
                    });
                    break;

                case 'tool_failed':
                    toast.error(event.title, {
                        description: event.description,
                        action: navigateAction,
                        duration: 8000,
                    });
                    break;

                case 'qa_sla_breached':
                    toast.warning(event.title, {
                        description: event.description,
                        action: navigateAction,
                        duration: 8000,
                    });
                    break;

                case 'document_uploaded':
                    toast.info(event.title, {
                        description: event.description,
                        action: navigateAction,
                        duration: 4000,
                    });
                    break;

                case 'hitl_required':
                    toast.warning(event.title, {
                        description: event.description,
                        action: event.action_url
                            ? {
                                  label: 'Revisar',
                                  onClick: () => router.push(event.action_url!),
                              }
                            : undefined,
                        duration: 10000,
                    });
                    break;

                case 'qa_new':
                case 'qa_answer':
                    toast.info(event.title, {
                        description: event.description,
                        action: navigateAction,
                        duration: 5000,
                    });
                    break;

                case 'report_ready':
                    toast.success(event.title, {
                        description: event.description,
                        action: navigateAction,
                        duration: 6000,
                    });
                    break;

                case 'milestone':
                    toast.success(event.title, {
                        description: event.description,
                        action: navigateAction,
                        duration: 6000,
                    });
                    break;

                default:
                    toast(event.title, {
                        description: event.description,
                        action: navigateAction,
                        duration: 5000,
                    });
            }
        },
        [router]
    );

    // SSE Connection
    useEffect(() => {
        if (!projectId) return;

        let eventSource: EventSource | null = null;
        let retryTimeout: ReturnType<typeof setTimeout> | null = null;
        let retryCount = 0;
        const maxRetries = 5;
        let unmounted = false;

        function connect() {
            if (unmounted) return;

            eventSource = new EventSource(`/api/events/stream?project_id=${projectId}`);

            eventSource.onopen = () => {
                retryCount = 0;
            };

            eventSource.onmessage = (msgEvent) => {
                if (unmounted) return;
                try {
                    const data: SSEEvent = JSON.parse(msgEvent.data);
                    if (!data.id || isSeen(data.id)) return;
                    addSeenId(data.id);
                    showToast(data);
                } catch {
                    // Ignore malformed messages
                }
            };

            eventSource.onerror = () => {
                if (unmounted) return;
                eventSource?.close();
                eventSource = null;

                if (retryCount < maxRetries) {
                    retryCount++;
                    const delay = Math.min(1000 * Math.pow(2, retryCount), 30000);
                    retryTimeout = setTimeout(connect, delay);
                }
            };
        }

        connect();

        return () => {
            unmounted = true;
            eventSource?.close();
            eventSource = null;
            if (retryTimeout) {
                clearTimeout(retryTimeout);
                retryTimeout = null;
            }
        };
    }, [projectId, isSeen, addSeenId, showToast]);

    // This component renders nothing visually
    return null;
}
