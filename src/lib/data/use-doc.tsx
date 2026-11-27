'use client';

import { useEffect, useState, useRef } from 'react';
import {
  onSnapshot,
  type DocumentReference,
  type DocumentSnapshot,
  type DocumentData,
  type FirestoreError,
} from '@/lib/db';
import { errorEmitter } from './error-emitter';
import { FirestorePermissionError } from './errors';
import { toPublicServiceError } from '@/lib/public-errors';

/** Live single-row hook backed by Supabase Realtime. */
export function useDoc<T = DocumentData>(docRef: DocumentReference<any> | null) {
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<FirestoreError | null>(null);
  const prevDataRef = useRef<string>('');

  useEffect(() => {
    let active = true;

    prevDataRef.current = '';
    setError(null);
    setData(null);

    if (!docRef) {
      setLoading(false);
      return;
    }

    setLoading(true);

    let unsubscribe: () => void;
    try {
      unsubscribe = onSnapshot(
        docRef,
        (snapshot: DocumentSnapshot<T>) => {
          if (!active) return;

          const newData = snapshot.exists()
            ? ({ ...snapshot.data(), id: snapshot.id } as T)
            : null;
          const dataString = JSON.stringify(newData);

          if (dataString !== prevDataRef.current) {
            prevDataRef.current = dataString;
            setData(newData);
          }

          setLoading(false);
          setError(null);
        },
        (err) => {
          if (!active) return;

          if (err.code === 'permission-denied') {
            errorEmitter.emit(
              'permission-error',
              new FirestorePermissionError({ path: docRef.path || 'document', operation: 'get' })
            );
          }

          prevDataRef.current = '';
          setError(toPublicServiceError(err) as FirestoreError);
          setLoading(false);
          setData(null);
        }
      );
    } catch (e: any) {
      console.error('Failed to establish realtime listener:', e);
      if (active) {
        prevDataRef.current = '';
        setLoading(false);
        setError(toPublicServiceError(e) as FirestoreError);
        setData(null);
      }
      return;
    }

    return () => {
      active = false;
      if (unsubscribe) unsubscribe();
    };
  }, [docRef?.path]);

  return { data, loading, error };
}
