'use client';

import { useRef } from 'react';

/**
 * A custom hook to stabilize Firestore references and queries.
 * It only updates the returned value if the dependencies change, 
 * ensuring that the Firestore listener hooks (useCollection, useDoc) 
 * don't re-subscribe unnecessarily.
 */
export function useMemoFirebase<T>(factory: () => T, deps: any[]): T {
  const ref = useRef<T | null>(null);
  const depsRef = useRef<any[]>([]);

  const changed = 
    deps.length !== depsRef.current.length || 
    deps.some((dep, i) => dep !== depsRef.current[i]);

  if (changed) {
    ref.current = factory();
    depsRef.current = deps;
  }

  return ref.current as T;
}
