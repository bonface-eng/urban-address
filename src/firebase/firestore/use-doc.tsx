'use client';

import { useEffect, useState, useRef } from 'react';
import { 
  DocumentReference, 
  onSnapshot, 
  DocumentSnapshot, 
  DocumentData,
  FirestoreError 
} from 'firebase/firestore';
import { errorEmitter } from '../error-emitter';
import { FirestorePermissionError } from '../errors';
import { toPublicServiceError } from '@/lib/public-errors';

/**
 * Hook to listen to a single Firestore document.
 * Handles permission errors gracefully without triggering hard crashes.
 */
export function useDoc<T = DocumentData>(docRef: DocumentReference<T> | null) {
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<FirestoreError | null>(null);
  const prevDataRef = useRef<string>('');

  useEffect(() => {
    let active = true;

    // Reset comparison state whenever the document source changes.
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
          
          const newData = snapshot.exists() ? { ...snapshot.data(), id: snapshot.id } as T : null;
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
            const permissionError = new FirestorePermissionError({
              path: docRef.path || 'document',
              operation: 'get',
            });
            errorEmitter.emit('permission-error', permissionError);
          }

          prevDataRef.current = '';
          setError(toPublicServiceError(err) as FirestoreError);
          setLoading(false);
          setData(null);
        }
      );
    } catch (e: any) {
      console.error('Failed to establish document snapshot listener:', e);
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