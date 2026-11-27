'use client';

import { useEffect } from 'react';
import { errorEmitter } from '@/firebase/error-emitter';
import { FirestorePermissionError } from '@/firebase/errors';
import { toast } from '@/hooks/use-toast';

/**
 * FirebaseErrorListener
 * Intercepts global Firestore events and displays them as toasts.
 * Provides granular feedback for synchronization and permission nodes.
 */
export function FirebaseErrorListener() {
  useEffect(() => {
    const handlePermissionError = (error: any) => {
      console.error('[FIREBASE SYNC ERROR]', error);
      
      const isHoldAction = error?.context?.path?.includes('held_bills');
      
      toast({
        variant: "destructive",
        title: isHoldAction ? "Sync Interrupted" : "Access Restricted",
        description: isHoldAction 
          ? "The station node failed to synchronize the held bill. Please check your network or station authorization."
          : "Your account does not have sufficient permissions to view or modify this specific data node."
      });
    };

    errorEmitter.on('permission-error', handlePermissionError);
    return () => {
      errorEmitter.off('permission-error', handlePermissionError);
    };
  }, []);

  return null;
}