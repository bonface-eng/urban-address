'use client';
import { useEffect, useState, useCallback } from 'react';
import { useUser } from '@/firebase';

/** Fixed resource types only; endpoint never accepts arbitrary collection paths or target UIDs. */
export function usePosReads<T>(resource: 'customers' | 'own-tabs', unit = '', enabled = true) {
  const { user } = useUser();
  const [retry, setRetry] = useState(0);
  const key = `${resource}:${unit}:${retry}`;
  const [state, setState] = useState<{ uid: string; key: string; data: T[] | null; loading: boolean; error: string | null }>({ uid: '', key: '', data: null, loading: true, error: null });
  const refresh = useCallback(() => setRetry(value => value + 1), []);
  useEffect(() => {
    if (!enabled || !user) return;
    const controller = new AbortController();
    const uid = user.uid;
    setState({ uid, key, data: null, loading: true, error: null });
    (async () => {
      try {
        const token = await user.getIdToken(true);
        const records: T[] = [];
        let cursor: string | null = null;
        const seen = new Set<string>();
        do {
          const params = new URLSearchParams({ resource });
          if (unit) params.set('unit',unit);
          if (cursor) params.set('cursor',cursor);
          const response = await fetch('/api/pos-reads?' + params.toString(), { headers: { Authorization: `Bearer ${token}` }, cache: 'no-store', signal: AbortSignal.any([controller.signal, AbortSignal.timeout(15000)]) });
          const data = await response.json();
          if (!response.ok || !Array.isArray(data.records)) throw new Error(['POS_AUTH_REQUIRED','POS_STAFF_REQUIRED','POS_READ_INVALID'].includes(data.code) ? data.code : 'POS_READ_UNAVAILABLE');
          records.push(...data.records);
          cursor = typeof data.nextCursor === 'string' ? data.nextCursor : null;
          if (cursor && seen.has(cursor)) throw new Error('POS_READ_UNAVAILABLE');
          if (cursor) seen.add(cursor);
        } while (cursor);
        if (!controller.signal.aborted) setState({ uid, key, data: records, loading: false, error: null });
      } catch (error) {
        if (!controller.signal.aborted) {
          const message = error instanceof Error ? error.message : '';
          setState({ uid, key, data: null, loading: false, error: ['POS_AUTH_REQUIRED','POS_STAFF_REQUIRED','POS_READ_INVALID'].includes(message) ? message : 'POS_READ_UNAVAILABLE' });
        }
      }
    })();
    return () => controller.abort();
  },[resource,unit,enabled,user,key]);
  useEffect(() => {
    if (!enabled || resource !== 'own-tabs' || !user) return;
    const timer = setInterval(() => { if (document.visibilityState === 'visible') refresh(); },30000);
    return () => clearInterval(timer);
  },[enabled,resource,user,refresh]);
  if (!enabled) return { data: null, loading: false, error: null, refresh };
  if (!user) return { data: null, loading: false, error: 'POS_AUTH_REQUIRED', refresh };
  if (state.uid !== user.uid || state.key !== key) return { data: null, loading: true, error: null, refresh };
  return { ...state, refresh };
}
