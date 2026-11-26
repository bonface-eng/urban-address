'use client';

import { useEffect, useState, useRef } from 'react';
import { 
  Query, 
  onSnapshot, 
  QuerySnapshot, 
  DocumentData,
  FirestoreError 
} from 'firebase/firestore';
import { errorEmitter } from '../error-emitter';
import { FirestorePermissionError } from '../errors';
import { toPublicServiceError } from '@/lib/public-errors';

/**
 * Hook to listen to a Firestore collection.
 * Publishes rows only for the initial snapshot or snapshots with document changes.
 * This avoids serializing the full collection on every Firestore update.
 * Handles errors gracefully to prevent UI crashes.
 */
export function shouldPublishSnapshot(isFirstSnapshot: boolean, changedDocumentCount: number) {
  return isFirstSnapshot || changedDocumentCount > 0;
}

export function useCollection<T = DocumentData>(query: Query<T> | null) {
  const [data, setData] = useState<T[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<FirestoreError | null>(null);
  const hasReceivedSnapshotRef = useRef(false);

  useEffect(() => {
    let active = true;

    // A new query is a new data source. Never carry the previous query's
    // comparison token or rows into the new subscription.
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
          
          const items = snapshot.docs.map(doc => ({
            ...doc.data(),
            id: doc.id
          } as T));

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
          
          // Emit contextual error for UI display
          if (err.code === 'permission-denied') {
            // Attempt to extract path from internal segments for better debugging
            const segments = (query as any)._query?.path?.segments || [];
            const path = segments.length > 0 ? segments.join('/') : 'collection';

            const permissionError = new FirestorePermissionError({
              path: path,
              operation: 'list',
            });
            errorEmitter.emit('permission-error', permissionError);
          }

          // Reset the equality token so the first successful snapshot after
          // recovery always repopulates the view, even if rows are unchanged.
          hasReceivedSnapshotRef.current = false;
          setError(toPublicServiceError(err) as FirestoreError);
          setLoading(false);
          setData([]); // Keep the UI safe while exposing the subscription error
        }
      );
    } catch (e: any) {
      console.error('Failed to establish snapshot listener:', e);
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
          console.warn('[FIRESTORE] Unsubscribe failed gracefully:', e);
        }
      }
    };
  }, [query]);

  return { data, loading, error };
}