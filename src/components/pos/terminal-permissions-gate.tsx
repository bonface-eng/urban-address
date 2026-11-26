'use client';

import React, { useEffect, useRef, useState } from 'react';
import { Bell, Mic, ShieldCheck, RefreshCw, AlertTriangle, CheckCircle2 } from 'lucide-react';
import { Button } from '@/components/ui/button';

type PermissionState = 'unknown' | 'granted' | 'denied';

type TerminalPermissionsGateProps = {
  onReady: () => void;
  /** Only an administrator may enter the staff workspace without granting device permissions. */
  canSkip?: boolean;
};

export function TerminalPermissionsGate({ onReady, canSkip = false }: TerminalPermissionsGateProps) {
  const [checking, setChecking] = useState(false);
  const [error, setError] = useState('');
  const [notificationState, setNotificationState] = useState<PermissionState>('unknown');
  const completedRef = useRef(false);

  useEffect(() => {
    let cancelled = false;

    const checkExistingPermissions = async () => {
      const notificationsSupported = typeof window !== 'undefined' && 'Notification' in window;
      const notificationsGranted = notificationsSupported && Notification.permission === 'granted';

      if (!notificationsSupported) {
        if (!cancelled) setNotificationState('denied');
      } else if (!cancelled) {
        setNotificationState(Notification.permission === 'denied' ? 'denied' : notificationsGranted ? 'granted' : 'unknown');
      }

      if (cancelled) return;
      if (notificationsGranted && !completedRef.current) {
        completedRef.current = true;
        onReady();
      }
    };

    void checkExistingPermissions();
    const refreshWhenVisible = () => {
      if (document.visibilityState === 'visible') void checkExistingPermissions();
    };
    document.addEventListener('visibilitychange', refreshWhenVisible);

    return () => {
      cancelled = true;
      document.removeEventListener('visibilitychange', refreshWhenVisible);
    };
  }, [onReady]);

  const requestAccess = async () => {
    if (checking || completedRef.current) return;
    setChecking(true);
    setError('');

    try {
      if (!('Notification' in window)) {
        throw new Error('This browser does not support notifications. Use an up-to-date browser or contact an administrator.');
      }

      let notificationPermission = Notification.permission;
      if (notificationPermission === 'default') {
        notificationPermission = await Notification.requestPermission();
      }
      setNotificationState(notificationPermission === 'granted' ? 'granted' : notificationPermission === 'denied' ? 'denied' : 'unknown');
      if (notificationPermission !== 'granted') {
        throw new Error(notificationPermission === 'denied'
          ? 'Notifications are blocked for this site. Enable them in your browser or device settings, then select Try again.'
          : 'The notification request was dismissed. Select Allow when your browser asks for permission.');
      }

      // Microphone access is optional and is requested only when an administrator
      // starts a staff-consented live-audio support session.
      completedRef.current = true;
      onReady();
    } catch (err: any) {
      if (err?.name === 'NotAllowedError' || err?.name === 'PermissionDeniedError') {
        setError('Microphone access was denied. Allow microphone access in your browser or device settings, then select Try again.');
      } else {
        setError(err?.message || 'Could not verify device permissions. Check your browser settings and try again.');
      }
    } finally {
      setChecking(false);
    }
  };

  const statusLabel = (state: PermissionState) => state === 'granted' ? 'Granted' : state === 'denied' ? 'Blocked' : 'Required';

  const continueAsAdmin = () => {
    if (!canSkip || checking || completedRef.current) return;
    completedRef.current = true;
    onReady();
  };

  return (
    <div className="fixed inset-0 z-[5000] flex items-center justify-center bg-zinc-950 p-4">
      <section
        role="dialog"
        aria-modal="true"
        aria-labelledby="terminal-permissions-title"
        aria-describedby="terminal-permissions-description"
        className="w-full max-w-xl space-y-6 rounded-2xl border border-zinc-200 bg-white p-5 text-zinc-900 shadow-2xl sm:p-8"
      >
        <div className="flex items-start gap-4">
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-orange-50 text-orange-600">
            <ShieldCheck className="h-6 w-6" />
          </div>
          <div>
            <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-orange-600">Station setup · Access check</p>
            <h1 id="terminal-permissions-title" className="mt-1 text-2xl font-black tracking-tight">Enable device permissions</h1>
            <p id="terminal-permissions-description" className="mt-2 text-sm leading-relaxed text-zinc-500">
              Allow notifications for important station alerts. Microphone access is optional and is requested only if you accept an announced live-audio support session.
              {!canSkip && ' Notifications are required before staff can enter the POS.'}
            </p>
          </div>
        </div>

        <div className="divide-y divide-zinc-100 border-y border-zinc-100">
          <div className="flex items-center gap-3 py-4">
            <Bell className="h-5 w-5 text-zinc-500" />
            <div className="min-w-0 flex-1">
              <p className="text-sm font-bold">Notifications</p>
              <p className="text-xs text-zinc-500">Receive important POS and session alerts.</p>
            </div>
            <span className={notificationState === 'granted' ? 'text-[10px] font-bold uppercase text-emerald-700' : 'text-[10px] font-bold uppercase text-zinc-500'}>
              {notificationState === 'granted' && <CheckCircle2 className="mr-1 inline h-3 w-3" />}
              {statusLabel(notificationState)}
            </span>
          </div>
          <div className="flex items-center gap-3 py-4">
            <Mic className="h-5 w-5 text-zinc-500" />
            <div className="min-w-0 flex-1">
              <p className="text-sm font-bold">Microphone</p>
              <p className="text-xs text-zinc-500">Optional; requested only when you accept a live-audio support session.</p>
            </div>
            <span className="text-[10px] font-bold uppercase text-zinc-500">
              Optional
            </span>
          </div>
        </div>

        {error && (
          <div role="alert" className="flex gap-2 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
            <p>{error}</p>
          </div>
        )}

        <div className="space-y-3">
          <Button onClick={requestAccess} disabled={checking} className="h-12 w-full rounded-xl bg-orange-600 font-bold text-white hover:bg-orange-700">
            {checking ? <><RefreshCw className="mr-2 h-4 w-4 animate-spin" />Checking permissions</> : 'Enable notifications and continue'}
          </Button>
          {canSkip && (
            <Button type="button" variant="outline" onClick={continueAsAdmin} disabled={checking} className="h-11 w-full rounded-xl border-zinc-300 font-semibold text-zinc-700">
              Continue without permissions (Admin)
            </Button>
          )}
        </div>

        <p className="text-center text-[11px] leading-relaxed text-zinc-400">
          {canSkip
            ? 'Administrators may continue without notifications. Staff must enable notifications to use the POS.'
            : 'This screen cannot be dismissed. If access was blocked, open this site’s browser settings, allow Notifications, return here, and try again.'}
        </p>
      </section>
    </div>
  );
}
