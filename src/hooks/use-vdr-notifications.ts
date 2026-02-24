/**
 * React hook for subscribing to VDR Realtime notifications.
 */

'use client';

import { useEffect, useState, useCallback } from 'react';
import { createClient } from '@supabase/supabase-js';
import type { VdrNotification, VdrEventType } from '@/lib/vdr/realtime-notifications';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

interface UseVdrNotificationsOptions {
  projectId: string;
  eventTypes?: VdrEventType[];
  onNotification?: (notification: VdrNotification) => void;
}

export function useVdrNotifications({
  projectId,
  eventTypes,
  onNotification,
}: UseVdrNotificationsOptions) {
  const [notifications, setNotifications] = useState<VdrNotification[]>([]);
  const [isConnected, setIsConnected] = useState(false);

  const handleNotification = useCallback((notification: VdrNotification) => {
    // Filter by event type if specified
    if (eventTypes && !eventTypes.includes(notification.type)) {
      return;
    }

    setNotifications(prev => [notification, ...prev].slice(0, 50)); // Keep last 50
    onNotification?.(notification);
  }, [eventTypes, onNotification]);

  useEffect(() => {
    const supabase = createClient(supabaseUrl, supabaseAnonKey);
    const channel = supabase.channel(`vdr-events:${projectId}`);

    channel
      .on('broadcast', { event: '*' }, ({ payload }) => {
        handleNotification(payload as VdrNotification);
      })
      .subscribe((status) => {
        setIsConnected(status === 'SUBSCRIBED');
      });

    return () => {
      channel.unsubscribe();
    };
  }, [projectId, handleNotification]);

  const clearNotifications = useCallback(() => {
    setNotifications([]);
  }, []);

  return {
    notifications,
    isConnected,
    clearNotifications,
  };
}
