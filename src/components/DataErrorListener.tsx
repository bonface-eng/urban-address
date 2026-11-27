'use client';

import { useEffect } from 'react';
import { addDoc, collection } from '@/lib/db';
import { useDb, useUser } from '@/lib/data';
import { errorEmitter } from '@/lib/data';
import { FirestorePermissionError } from '@/lib/data';
import { toast } from '@/hooks/use-toast';

function safeSummary(value: unknown) {
  let raw: string;
  try {
    raw =
      value instanceof Error
        ? value.message
        : typeof value === 'string'
          ? value
          : JSON.stringify(value ?? 'Unexpected application error') || String(value);
  } catch {
    raw = String(value ?? 'Unexpected application error');
  }
  return raw
    .replace(/https?:\/\/\S+/gi, '[url]')
    .replace(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi, '[email]')
    .replace(/(?:\+?\d[\d ()-]{7,}\d)/g, '[phone]')
    .replace(/(token|authorization|password|secret|api[_-]?key)\s*[:=]\s*[^\s,;]+/gi, '$1=[redacted]')
    .slice(0, 1000);
}

export function DataErrorListener() {
  const firestore = useDb();
  const { user } = useUser();

  useEffect(() => {
    let lastReportAt = 0;
    const report = async (category: string, value: unknown) => {
      const now = Date.now();
      if (!firestore || now - lastReportAt < 5000) return;
      lastReportAt = now;
      const incidentId = typeof crypto !== 'undefined' && 'randomUUID' in crypto
        ? crypto.randomUUID() : 'incident-' + now;
      const message = safeSummary(value);
      console.error('[SYSTEM INCIDENT]', { incidentId, category, message });
      try {
        await addDoc(collection(firestore, 'system_incidents'), {
          incidentId,
          category,
          message,
          route: typeof window !== 'undefined' ? window.location.pathname.slice(0, 160) : '/',
          status: 'OPEN',
          createdAt: now,
          userId: user?.uid || null,
          userAgent: typeof navigator !== 'undefined' ? navigator.userAgent.slice(0, 180) : 'unknown',
        });
      } catch (writeError) {
        console.warn('[SYSTEM INCIDENT] Report could not be persisted.', writeError);
      }
    };

    const handleError = (event: ErrorEvent) => { void report('CLIENT_ERROR', event.error || event.message); };
    const handleRejection = (event: PromiseRejectionEvent) => { void report('UNHANDLED_REJECTION', event.reason); };
    const handlePermissionError = (error: FirestorePermissionError) => {
      const isHoldAction = error?.context?.path?.includes('held_bills');
      void report('FIRESTORE_PERMISSION', {
        operation: error?.context?.operation,
        path: error?.context?.path,
      });
      toast({
        variant: 'destructive',
        title: 'Access Restricted',
        description: isHoldAction
          ? 'The held bill could not be synchronized. Check your connection and station access, then try again.'
          : 'This action is not permitted for your account. If you believe this is an error, contact an administrator.',
      });
    };

    window.addEventListener('error', handleError);
    window.addEventListener('unhandledrejection', handleRejection);
    errorEmitter.on('permission-error', handlePermissionError);
    return () => {
      window.removeEventListener('error', handleError);
      window.removeEventListener('unhandledrejection', handleRejection);
      errorEmitter.off('permission-error', handlePermissionError);
    };
  }, [firestore, user?.uid]);

  return null;
}
