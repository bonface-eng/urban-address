'use client';
import { useEffect, useState } from 'react';
import { useUser } from '@/firebase';
import type { Product } from '@/lib/types';

type State = { loading: boolean; data: Product[] | null; error: { code: string } | null; uid: string; key: unknown };
export function useInventoryFallback(error: { code?: string } | null, retry: number) {
  const { user } = useUser();
  const [state, setState] = useState<State>({ loading: false, data: null, error: null, uid: '', key: null });
  const eligible = !!error && error.code !== 'permission-denied';
  useEffect(() => {
    if (!eligible || !user) return;
    const controller = new AbortController();
    const uid = user.uid;
    setState({ loading: true, data: null, error: null, uid, key: error });
    (async () => {
      try {
        const token = await user.getIdToken();
        const products: Product[] = [];
        let cursor: string | null = null;
        const seen = new Set<string>();
        do {
          const response = await fetch('/api/staff-inventory' + (cursor ? '?cursor=' + encodeURIComponent(cursor) : ''), {
            headers: { Authorization: `Bearer ${token}` }, cache: 'no-store', signal: AbortSignal.any([controller.signal, AbortSignal.timeout(15000)]),
          });
          const body = await response.json();
          if (!response.ok) throw new Error(typeof body.code === 'string' ? body.code : 'INVENTORY_SERVER_UNAVAILABLE');
          if (!Array.isArray(body.products)) throw new Error('INVENTORY_SERVER_UNAVAILABLE');
          products.push(...body.products);
          cursor = typeof body.nextCursor === 'string' ? body.nextCursor : null;
          if (cursor && seen.has(cursor)) throw new Error('INVENTORY_SERVER_UNAVAILABLE');
          if (cursor) seen.add(cursor);
        } while (cursor);
        if (!controller.signal.aborted) setState({ loading: false, data: products, error: null, uid, key: error });
      } catch (failure) {
        if (!controller.signal.aborted) {
          const candidate = failure instanceof Error ? failure.message : '';
          const allowed = ['INVENTORY_AUTH_REQUIRED', 'INVENTORY_STAFF_REQUIRED', 'INVENTORY_SERVER_ACCESS', 'INVENTORY_DATABASE_CONFIGURATION'];
          setState({ loading: false, data: null, error: { code: allowed.includes(candidate) ? candidate : 'INVENTORY_SERVER_UNAVAILABLE' }, uid, key: error });
        }
      }
    })();
    return () => controller.abort();
  }, [eligible, error, user, retry]);
  if (!eligible) return { loading: false, data: null, error: null };
  if (!user) return { loading: false, data: null, error: { code: 'INVENTORY_AUTH_REQUIRED' } };
  if (state.uid !== user.uid || state.key !== error) return { loading: true, data: null, error: null };
  return state;
}
