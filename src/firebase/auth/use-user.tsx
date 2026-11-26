'use client';

import { useEffect, useState, useMemo } from 'react';
import { onAuthStateChanged, User } from 'firebase/auth';
import { useAuth } from '../provider';

/**
 * Hook to track Firebase Auth state.
 * Stabilizes return values to prevent infinite re-render loops in consumers.
 */
export function useUser() {
  const auth = useAuth();
  const [state, setState] = useState<{ user: User | null; loading: boolean }>({
    user: null,
    loading: true,
  });

  useEffect(() => {
    if (!auth) {
      setState(prev => prev.loading ? { ...prev, loading: false } : prev);
      return;
    }

    const unsubscribe = onAuthStateChanged(auth, (u) => {
      setState({ user: u, loading: false });
    });
    
    return () => unsubscribe();
  }, [auth]);

  // Memoize return object to maintain reference stability
  return useMemo(() => state, [state.user, state.loading]);
}
