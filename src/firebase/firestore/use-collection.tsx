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

/**
 * Hook to listen to a Firestore collection.
 * Uses deep-comparison stringification to prevent re-render cascades.
 * Handles errors gracefully to prevent UI crashes.
 */
export function useCollection<T = DocumentData>(query: Query<T> | null) {
  const [data, setData] = useState<T[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<FirestoreError | null>(null);
  const prevDataRef = useRef<string>('');

  useEffect(() => {
    let active = true;

    if (!query) {
      if (active) {
        setLoading(false);
        setData(null);
      }
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

          const itemsString = JSON.stringify(items);

          if (itemsString !== prevDataRef.current) {
            prevDataRef.current = itemsString;
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

          setError(err);
          setLoading(false);
          setData([]); // Fallback to empty list on error to keep UI alive
        }
      );
    } catch (e: any) {
      console.error('Failed to establish snapshot listener:', e);
      if (active) {
        setLoading(false);
        setError(e);
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