import { useRef, useCallback, useEffect } from 'react';
import apiClient from '@/api/client';
import type { DissectionEvent } from './types';

const BATCH_INTERVAL_MS = 5000;

/**
 * Hook that collects dissection interaction events and sends them
 * to the API in batches every 5 seconds.
 *
 * Usage:
 *   const { trackEvent, flush } = useEventBatcher(attemptId);
 *   trackEvent({ eventType: 'click', structureId: '...', payload: { x, y } });
 */
export function useEventBatcher(attemptId: string | null) {
  const buffer = useRef<DissectionEvent[]>([]);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const flush = useCallback(async () => {
    if (!attemptId || buffer.current.length === 0) return;

    const events = [...buffer.current];
    buffer.current = [];

    try {
      await apiClient.post(`/attempts/${attemptId}/events`, { events });
    } catch (error) {
      // On failure, put events back in the buffer to retry next cycle
      buffer.current = [...events, ...buffer.current];
      console.warn('[EventBatcher] Failed to flush events, will retry:', error);
    }
  }, [attemptId]);

  const trackEvent = useCallback((event: DissectionEvent) => {
    buffer.current.push(event);
  }, []);

  // Set up the interval timer
  useEffect(() => {
    if (!attemptId) return;

    timerRef.current = setInterval(flush, BATCH_INTERVAL_MS);

    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
      // Flush remaining events on unmount
      flush();
    };
  }, [attemptId, flush]);

  return { trackEvent, flush };
}
