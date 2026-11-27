'use client';

import { useEffect, useState, useRef } from 'react';
import {
  onSnapshot,
  type Query,
  type CollectionReference,
  type QuerySnapshot,
  type DocumentData,
  type FirestoreError,
} from '@/lib/db';
import { errorEmitter } from './error-emitter';
import { FirestorePermissionError } from './errors';
import { toPublicServiceError } from '@/lib/public-errors';

/**
 * Publishes rows only for the initial snapshot or snapshots with changes.
 */
export function shouldPublishSnapshot(isFirstSnapshot: boolean, changedDocumentCount: number) {
  return isFirstSnapshot || changedDocumentCount > 0;
}

/** Live query hook backed by Supabase Realtime (postgres_changes). */
export function useCollection<T = DocumentData>(query: Query<any> | CollectionReference<any> | null) {
  const [data, setData] = useState<T[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<FirestoreError | null>(null);
  const hasReceivedSnapshotRef = useRef(false);

  useEffect(() => {
    let active = true;

    hasReceivedSnapshotRef.current = false;
    setError(null);
    setData(null);

    if (!query) {
      setLoading(false);
      return;
    }

    setLoading(true);

    let unsubscribe: (() => void) | undefined;

    try {
      unsubscribe = onSnapshot(
        query,
        (snapshot: QuerySnapshot<T>) => {
          if (!active) return;

          const items = snapshot.docs.map((d) => ({ ...d.data(), id: d.id } as T));
          const changedDocuments = snapshot.docChanges().length;
          if (shouldPublishSnapshot(!hasReceivedSnapshotRef.current, changedDocuments)) {
            hasReceivedSnapshotRef.current = true;
            setData(items);
          }

          setLoading(false);
          setError(null);
        },
        (err) => {
          if (!active) return;

          if (err.code === 'permission-denied') {
            const segments = (query as any)._query?.path?.segments || [];
            const path = segments.length > 0 ? segments.join('/') : 'collection';
            errorEmitter.emit(
              'permission-error',
              new FirestorePermissionError({ path, operation: 'list' })
            );
          }

          hasReceivedSnapshotRef.current = false;
          setError(toPublicServiceError(err) as FirestoreError);
          setLoading(false);
          setData([]);
        }
      );
    } catch (e: any) {
      console.error('Failed to establish realtime listener:', e);
      if (active) {
        hasReceivedSnapshotRef.current = false;
        setLoading(false);
        setError(toPublicServiceError(e) as FirestoreError);
        setData([]);
      }
    }

    return () => {
      active = false;
      if (typeof unsubscribe === 'function') {
        try {
          unsubscribe();
        } catch (e) {
          console.warn('[REALTIME] Unsubscribe failed gracefully:', e);
        }
      }
    };
  }, [query]);

  return { data, loading, error };
}
