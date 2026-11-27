'use client';

import { useEffect, useState, useMemo } from 'react';
import { onAuthStateChanged, type User } from '@/lib/db';
import { useAuth } from './provider';

/**
 * Tracks the Supabase Auth session via supabase.auth.onAuthStateChange.
 * Return value is memoised to avoid re-render loops in consumers.
 */
export function useUser() {
  const auth = useAuth();
  const [state, setState] = useState<{ user: User | null; loading: boolean }>({
    user: null,
    loading: true,
  });

  useEffect(() => {
    if (!auth) {
      setState((prev) => (prev.loading ? { ...prev, loading: false } : prev));
      return;
    }
    const unsubscribe = onAuthStateChanged(auth, (u) => {
      setState({ user: u, loading: false });
    });
    return () => unsubscribe();
  }, [auth]);

  return useMemo(() => state, [state.user, state.loading]);
}
