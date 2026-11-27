'use client';

import { useEffect } from 'react';
import { errorEmitter } from '@/firebase/error-emitter';
import { toast } from '@/hooks/use-toast';

/**
 * FirebaseErrorListener
 * Intercepts global Firestore events and displays them as toasts.
 * Provides granular feedback for synchronization and permission nodes.
 */
export function FirebaseErrorListener() {
  useEffect(() => {
    const handlePermissionError = (error: any) => {
      const rawPath = error?.context?.path;
      // Only expose an allowlisted collection name, never a document ID/email or request data.
      const collectionName = typeof rawPath === 'string' ? rawPath.split('/').filter(Boolean)[0] : '';
      const known = ['users', 'admins', 'system', 'inventory', 'orders', 'carwash_jobs', 'audit_logs', 'suppliers', 'petty_cash', 'reconciliations', 'salary_advances', 'pos_terminals', 'register_sessions', 'notifications', 'settings', 'vehicles', 'held_bills'];
      const source = known.includes(collectionName) ? collectionName : 'protected-data';
      const operation = ['get', 'list', 'create', 'update', 'delete', 'write'].includes(error?.context?.operation) ? error.context.operation : 'access';
      const reference = `ACCESS_${source.toUpperCase()}_${operation.toUpperCase()}`;
      console.error('[FIREBASE ACCESS DENIED]', reference);
      
      const isHoldAction = error?.context?.path?.includes('held_bills');
      
      toast({
        variant: "destructive",
        title: isHoldAction ? "Sync Interrupted" : "Access Restricted",
        description: isHoldAction 
          ? "The station node failed to synchronize the held bill. Please check your network or station authorization."
          : `Database access was denied for ${source} (${operation}). Ref: ${reference}. Your account role has not been changed.`
      });
    };

    errorEmitter.on('permission-error', handlePermissionError);
    return () => {
      errorEmitter.off('permission-error', handlePermissionError);
    };
  }, []);

  return null;
}