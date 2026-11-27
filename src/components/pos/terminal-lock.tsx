'use client';

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useTerminal } from '@/hooks/use-terminal';
import { useUser } from '@/lib/data';
import { initializeApp, deleteApp, getAuth, signInWithEmailAndPassword, signOut } from '@/lib/db';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import {
  Delete,
  ArrowLeft,
  ChevronRight,
  Loader2,
  AlertTriangle,
  KeyRound,
  X,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { BusinessUnit, UserProfile } from '@/lib/types';
import { Badge } from '@/components/ui/badge';
import { toast } from '@/hooks/use-toast';
import Image from 'next/image';
import Link from 'next/link';
import { TerminalWelcome } from '@/components/pos/terminal-welcome';
import { TerminalLiveAudioAgent } from '@/components/pos/terminal-live-audio-agent';
import { clearObsoleteTerminalStorage } from '@/lib/role-routing';

const QUICK_PIN_BANNER_DISMISSED_KEY = 'uax_quick_pin_banner_dismissed';

export function TerminalLock({ children, unit }: { children: React.ReactNode; unit?: BusinessUnit }) {
  const { user: authUser } = useUser();
  const {
    activeCashier,
    activeTerminal,
    loading,
    isLocked,
    switchWithPin,
    setIsLocked,
    locationName,
  } = useTerminal();

  const [pin, setPin] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [optionalPin, setOptionalPin] = useState('');
  const [isVerifying, setIsVerifying] = useState(false);
  const [showStaffSelector, setShowStaffSelector] = useState(false);
  const [isSigningInWithPassword, setIsSigningInWithPassword] = useState(false);
  const [error, setError] = useState(false);
  const [pinErrorMessage, setPinErrorMessage] = useState('');

  const [deviceId, setDeviceId] = useState('');
  const [selectedOperator, setSelectedOperator] = useState<UserProfile | null>(null);
  const [serverPinConfigured, setServerPinConfigured] = useState(false);
  const [pinBannerDismissed, setPinBannerDismissed] = useState(false);
  const [pinResetMode, setPinResetMode] = useState(false);
  const [pinResetSent, setPinResetSent] = useState(false);
  const [pinResetCode, setPinResetCode] = useState('');
  const [pinResetNewPin, setPinResetNewPin] = useState('');
  const [pinResetConfirmPin, setPinResetConfirmPin] = useState('');
  const [pinResetLoading, setPinResetLoading] = useState(false);

  const [recentOperators, setRecentOperators] = useState<UserProfile[]>([]);
  const [currentTime, setCurrentTime] = useState<Date | null>(null);
  const [showWelcome, setShowWelcome] = useState(false);
  const welcomeDismissedRef = useRef(false);

  const hiddenInputRef = useRef<HTMLInputElement>(null);
  const registeredIdentityRef = useRef<string | null>(null);
  const selectedCashier = selectedOperator || activeCashier;

  const isAdminUser = Boolean(
    activeCashier && (activeCashier.role === 'ADMIN' || activeCashier.isSuperAdmin === true)
  );
  const isRemotelyDisabled = Boolean(
    !isAdminUser &&
      activeTerminal &&
      ((activeTerminal as any).disabled === true || (activeTerminal as any).locked === true)
  );

  // Administrators bypass station locks automatically unless explicitly switching accounts.
  useEffect(() => {
    if (isAdminUser && isLocked && !showStaffSelector && !isSigningInWithPassword) {
      setIsLocked(false);
    }
  }, [isAdminUser, isLocked, showStaffSelector, isSigningInWithPassword, setIsLocked]);

  useEffect(() => {
    if (isLocked && !authUser) {
      if (!welcomeDismissedRef.current) setShowWelcome(true);
    } else if (!isLocked) {
      welcomeDismissedRef.current = false;
      setShowWelcome(false);
    }
  }, [isLocked, authUser]);

  const handleBeginShift = useCallback(() => {
    welcomeDismissedRef.current = true;
    setShowWelcome(false);
    setShowStaffSelector(true);
  }, []);

  useEffect(() => {
    setCurrentTime(new Date());
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    clearObsoleteTerminalStorage();

    try {
      if (sessionStorage.getItem(QUICK_PIN_BANNER_DISMISSED_KEY) === 'true') {
        setPinBannerDismissed(true);
      }
    } catch {
      // Ignore sessionStorage errors
    }

    let savedDeviceId = localStorage.getItem('uax_terminal_device_id');
    if (!savedDeviceId) {
      savedDeviceId = crypto.randomUUID();
      localStorage.setItem('uax_terminal_device_id', savedDeviceId);
    }
    setDeviceId(savedDeviceId);

    const saved = localStorage.getItem('uax_recent_operators');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        const safeOperators = parsed
          .filter((u: UserProfile) => u && u.role !== 'CLIENT')
          .map((operator: UserProfile) => {
            const safe = { ...operator } as Record<string, unknown>;
            delete safe.pin;
            delete safe.masterKey;
            for (const key of Object.keys(safe)) {
              if (key.toLowerCase().startsWith('disclaim')) {
                delete safe[key];
              }
            }
            return safe as unknown as UserProfile;
          });
        setRecentOperators(safeOperators);
        localStorage.setItem('uax_recent_operators', JSON.stringify(safeOperators));
      } catch {
        setRecentOperators([]);
      }
    }
  }, []);

  useEffect(() => {
    if (activeCashier && activeCashier.role !== 'CLIENT') {
      setRecentOperators((prev) => {
        const hasPinFlag = serverPinConfigured || Boolean(activeCashier.hasPin);
        const safe = {
          ...activeCashier,
          pin: undefined,
          hasPin: hasPinFlag,
          pinConfigured: hasPinFlag,
        } as UserProfile & { pinConfigured: boolean };
        delete (safe as any).masterKey;
        const updated = [safe, ...prev.filter((p) => p.uid !== activeCashier.uid)].slice(0, 50);
        localStorage.setItem('uax_recent_operators', JSON.stringify(updated));
        return updated;
      });
    }
  }, [activeCashier, serverPinConfigured]);

  useEffect(() => {
    if (!authUser || !activeCashier || !deviceId || authUser.uid !== activeCashier.uid) return;
    const identityKey = authUser.uid + ':' + deviceId;
    if (registeredIdentityRef.current === identityKey) return;
    registeredIdentityRef.current = identityKey;
    let cancelled = false;
    (async () => {
      try {
        const token = await authUser.getIdToken();
        const response = await fetch('/api/terminal/pin', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token },
          body: JSON.stringify({ action: 'register', targetUid: authUser.uid, deviceId }),
        });
        const payload = await response.json();
        if (!response.ok || cancelled) return;
        const hasPin = Boolean(payload.hasPin);
        setServerPinConfigured(hasPin);
        setRecentOperators((prev) => {
          const profile = { ...payload.profile, hasPin, pinConfigured: hasPin } as UserProfile;
          setSelectedOperator((current) => (current?.uid === profile.uid ? profile : current));
          const next = [profile, ...prev.filter((item) => item.uid !== profile.uid)].slice(0, 50);
          localStorage.setItem('uax_recent_operators', JSON.stringify(next));
          return next;
        });
      } catch {
        registeredIdentityRef.current = null;
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [authUser, activeCashier?.uid, deviceId]);

  const dismissPinBanner = useCallback(() => {
    setPinBannerDismissed(true);
    try {
      sessionStorage.setItem(QUICK_PIN_BANNER_DISMISSED_KEY, 'true');
    } catch {
      // Ignore storage errors
    }
  }, []);

  const focusInput = () => {
    hiddenInputRef.current?.focus();
  };

  const requestPinReset = useCallback(async () => {
    if (!selectedCashier?.uid || !deviceId || pinResetLoading) return;
    setPinResetLoading(true);
    try {
      const response = await fetch('/api/terminal/pin-reset', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'request', targetUid: selectedCashier.uid, deviceId }),
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error || 'Could not send the PIN reset email.');
      setPinResetSent(true);
      toast({
        title: 'Reset code sent',
        description: payload.destination
          ? `Check ${payload.destination} for the six-digit code.`
          : 'Check your staff email for the six-digit code.',
      });
    } catch (error) {
      toast({
        variant: 'destructive',
        title: 'PIN reset email unavailable',
        description: error instanceof Error ? error.message : 'Please sign in with your password instead.',
      });
    } finally {
      setPinResetLoading(false);
    }
  }, [selectedCashier?.uid, deviceId, pinResetLoading]);

  const confirmPinReset = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!selectedCashier?.uid || !deviceId || pinResetLoading) return;
    if (!/^\d{6}$/.test(pinResetCode) || !/^\d{4}$/.test(pinResetNewPin) || pinResetNewPin !== pinResetConfirmPin) {
      toast({
        variant: 'destructive',
        title: 'Check your entries',
        description: 'Enter the six-digit email code and the same new four-digit PIN twice.',
      });
      return;
    }
    setPinResetLoading(true);
    try {
      const response = await fetch('/api/terminal/pin-reset', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'confirm',
          targetUid: selectedCashier.uid,
          deviceId,
          code: pinResetCode,
          pin: pinResetNewPin,
        }),
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error || 'PIN reset failed.');
      setServerPinConfigured(true);
      setSelectedOperator({ ...selectedCashier, hasPin: true, pinConfigured: true } as UserProfile);
      setPin('');
      setPinResetMode(false);
      setPinResetSent(false);
      setPinResetCode('');
      setPinResetNewPin('');
      setPinResetConfirmPin('');
      setError(false);
      setPinErrorMessage('');
      toast({ title: 'PIN reset successfully', description: 'Use your new PIN to unlock this terminal.' });
    } catch (error) {
      toast({
        variant: 'destructive',
        title: 'PIN reset failed',
        description: error instanceof Error ? error.message : 'Check the code and try again.',
      });
    } finally {
      setPinResetLoading(false);
    }
  };

  const handleKeyPress = useCallback(
    (val: string) => {
      if (isVerifying) return;
      setError(false);
      setPinErrorMessage('');
      setPin((prev) => (prev + val).slice(0, 4));
    },
    [isVerifying]
  );

  const handleDeleteKeyPress = useCallback(() => {
    if (isVerifying) return;
    setPin((prev) => prev.slice(0, -1));
    setError(false);
    setPinErrorMessage('');
  }, [isVerifying]);

  const handleHiddenInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value.replace(/[^0-9]/g, '').slice(0, 4);
    setError(false);
    setPinErrorMessage('');
    setPin(val);
  };

  useEffect(() => {
    if (!isLocked || isSigningInWithPassword) return;
    const handleKeyboardInput = (e: KeyboardEvent) => {
      if (document.activeElement?.tagName === 'INPUT' && (document.activeElement as HTMLInputElement).dataset.pinReset === 'true') {
        return;
      }
      if (e.key >= '0' && e.key <= '9') {
        e.preventDefault();
        handleKeyPress(e.key);
      } else if (e.key === 'Backspace') {
        e.preventDefault();
        handleDeleteKeyPress();
      }
    };
    window.addEventListener('keydown', handleKeyboardInput);
    return () => window.removeEventListener('keydown', handleKeyboardInput);
  }, [isLocked, isSigningInWithPassword, handleKeyPress, handleDeleteKeyPress]);

  useEffect(() => {
    if (isLocked && selectedCashier && pin.length === 4 && deviceId) {
      setIsVerifying(true);
      switchWithPin(selectedCashier.uid, pin, deviceId).then((success) => {
        if (!success) {
          setError(true);
          setPinErrorMessage('Incorrect PIN. Check your entry and try again, or sign in with password.');
          setPin('');
        } else {
          setPin('');
          setError(false);
          setSelectedOperator(null);
        }
        setIsVerifying(false);
      });
    }
  }, [pin, isLocked, selectedCashier?.uid, deviceId, switchWithPin]);

  const handleProfileSelect = (op: UserProfile) => {
    setError(false);
    setPinErrorMessage('');
    setPin('');
    setPinResetMode(false);
    setPinResetSent(false);
    setPinResetCode('');
    setPinResetNewPin('');
    setPinResetConfirmPin('');

    const hasPin = Boolean((op as UserProfile & { pinConfigured?: boolean }).pinConfigured || op.hasPin);
    if (hasPin && Boolean(authUser)) {
      setSelectedOperator(op);
      setShowStaffSelector(false);
      return;
    }

    setEmail(op.email || '');
    setPassword('');
    setOptionalPin('');
    setIsSigningInWithPassword(true);
  };

  const handleCancelSwitch = () => {
    setIsSigningInWithPassword(false);
    setSelectedOperator(null);
    setOptionalPin('');
    setEmail('');
    setPassword('');
    setPin('');
    setError(false);
    setPinErrorMessage('');
    setShowStaffSelector(true);
  };

  const handleResumeCurrentSession = () => {
    if (!authUser || isRemotelyDisabled) return;
    setIsSigningInWithPassword(false);
    setSelectedOperator(null);
    setShowStaffSelector(false);
    setShowWelcome(false);
    setPin('');
    setError(false);
    setPinErrorMessage('');
    setIsLocked(false);
  };

  const handlePasswordSignIn = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (isVerifying || !deviceId) return;

    const trimmedPin = optionalPin.trim();
    if (trimmedPin && !/^\d{4}$/.test(trimmedPin)) {
      setError(true);
      setPinErrorMessage('Optional PIN must be exactly 4 digits (or leave blank).');
      return;
    }

    setIsVerifying(true);
    setError(false);
    setPinErrorMessage('');
    let secondaryApp: ReturnType<typeof initializeApp> | null = null;
    let secondaryAuth: ReturnType<typeof getAuth> | null = null;

    try {
      const normalizedEmail = email.toLowerCase().trim();
      const primaryAuth = getAuth();

      // Sign in directly as the active Supabase session
      const credential = await signInWithEmailAndPassword(primaryAuth, normalizedEmail, password);
      const token = await credential.user.getIdToken(true);

      const registerResponse = await fetch('/api/terminal/pin', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token },
        body: JSON.stringify({ action: 'register', targetUid: credential.user.uid, deviceId }),
      });
      const registered = await registerResponse.json();
      if (!registerResponse.ok) {
        await signOut(primaryAuth).catch(() => undefined);
        throw new Error(registered.error || 'This account is not authorized for staff terminal access.');
      }

      let hasPin = Boolean(registered.hasPin);
      if (trimmedPin) {
        const pinResponse = await fetch('/api/terminal/pin', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token },
          body: JSON.stringify({ action: 'set-pin', targetUid: credential.user.uid, deviceId, pin: trimmedPin }),
        });
        const pinResult = await pinResponse.json();
        if (!pinResponse.ok) throw new Error(pinResult.error || 'Could not save optional PIN.');
        hasPin = true;
      }

      setServerPinConfigured(hasPin);
      const profile = { ...registered.profile, hasPin, pinConfigured: hasPin } as UserProfile;
      setRecentOperators((prev) => {
        const next = [profile, ...prev.filter((item) => item.uid !== profile.uid)].slice(0, 50);
        localStorage.setItem('uax_recent_operators', JSON.stringify(next));
        return next;
      });

      setIsSigningInWithPassword(false);
      setSelectedOperator(null);
      setShowStaffSelector(false);
      setEmail('');
      setPassword('');
      setOptionalPin('');
      setIsLocked(false);
      toast({
        title: 'Signed in',
        description: `Welcome, ${profile.displayName || normalizedEmail}.`,
      });
    } catch (err) {
      setError(true);
      setPinErrorMessage(err instanceof Error ? err.message : 'Check your email and password and try again.');
    } finally {
      if (secondaryAuth) await signOut(secondaryAuth).catch(() => undefined);
      if (secondaryApp) await deleteApp(secondaryApp).catch(() => undefined);
      setIsVerifying(false);
    }
  };

  const shouldShowOverlay = Boolean(
    isRemotelyDisabled ||
      isLocked ||
      isSigningInWithPassword ||
      showStaffSelector ||
      !authUser
  );

  if (shouldShowOverlay && loading) {
    return (
      <div className="fixed inset-0 z-[2000] bg-black flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="w-10 h-10 text-primary animate-spin" />
          <p className="text-[10px] font-black uppercase text-white tracking-[0.4em]">Synchronizing Station Node...</p>
        </div>
      </div>
    );
  }

  if (showWelcome && shouldShowOverlay && !isSigningInWithPassword) {
    return (
      <>
        <TerminalLiveAudioAgent terminalId={activeTerminal?.id} cashierId={activeCashier?.uid} cashierName={activeCashier?.displayName} />
        <TerminalWelcome onStart={handleBeginShift} currentTime={currentTime} locationName={locationName} unit={unit} />
      </>
    );
  }

  if (shouldShowOverlay) {
    const selectedHasPin = Boolean(
      selectedCashier &&
        ((selectedCashier as UserProfile & { pinConfigured?: boolean }).pinConfigured ||
          selectedCashier.hasPin ||
          (selectedCashier.uid === activeCashier?.uid && serverPinConfigured))
    );
    const showSelector =
      (showStaffSelector && !isSigningInWithPassword) ||
      ((!selectedCashier || !selectedHasPin) && !isSigningInWithPassword);

    return (
      <div className="fixed inset-0 z-[2000] bg-black flex items-center justify-center p-0 overflow-hidden font-sans">
        <TerminalLiveAudioAgent terminalId={activeTerminal?.id} cashierId={activeCashier?.uid} cashierName={activeCashier?.displayName} />
        <Image
          src={selectedCashier ? '/assets/hero4.png' : '/assets/hero3.png'}
          alt="Cinematic Background"
          fill
          className="object-cover brightness-[0.52] saturate-[0.78] transition-all duration-1000"
          priority
        />

        <Link
          href="/"
          className="absolute top-3 left-3 sm:top-6 sm:left-6 md:top-12 md:left-12 z-[2100] flex items-center gap-3 py-2 px-5 bg-white/5 backdrop-blur-xl rounded-full border border-white/10 text-[10px] font-black uppercase tracking-[0.3em] text-zinc-100 hover:text-white hover:bg-primary/20 hover:border-primary/40 transition-all shadow-2xl active:scale-95"
        >
          <ArrowLeft className="w-4 h-4" />
          <span className="hidden sm:inline">Exit to Home</span>
        </Link>

        {currentTime && (
          <div className="absolute top-3 right-3 sm:top-6 sm:right-6 md:top-12 md:right-12 z-[2100] text-right animate-in fade-in duration-1000 space-y-2">
            <div className="px-4 py-2 bg-black/20 backdrop-blur-xl rounded-2xl border border-white/5 inline-block">
              <h2 className="text-2xl md:text-5xl font-black font-mono text-white tracking-tighter drop-shadow-2xl leading-none">
                {currentTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
              </h2>
            </div>
            <div className="flex items-center justify-end gap-3 px-1">
              <div className="flex items-center gap-2 text-green-400 drop-shadow-lg">
                <div className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" />
                <p className="text-[9px] font-black uppercase tracking-[0.2em]">{locationName}</p>
              </div>
            </div>
          </div>
        )}

        <div
          className={cn(
            'w-full min-h-0 relative z-10 p-4 sm:p-6 flex flex-1 flex-col items-center',
            selectedCashier && !isSigningInWithPassword ? 'max-w-5xl' : 'max-w-lg'
          )}
        >
          <div className="flex-1 flex flex-col items-center justify-center w-full">
            <div className="mb-4 sm:mb-8 md:mb-12 animate-in fade-in slide-in-from-top-6 duration-1000 shrink-0">
              <div className="bg-white rounded-2xl sm:rounded-[2rem] p-3 sm:p-5 md:p-6 shadow-[0_18px_50px_rgba(0,0,0,0.28)] ring-1 ring-white/20">
                <img src="/assets/logo.png" className="h-9 sm:h-11 w-auto object-contain" alt="Urban Express Logo" />
              </div>
            </div>

            {isSigningInWithPassword ? (
              <div className="w-full max-w-sm max-h-[calc(100dvh-7rem)] overflow-y-auto bg-black/45 backdrop-blur-xl p-4 sm:p-6 space-y-4 sm:space-y-5 animate-in slide-in-from-bottom-4 rounded-2xl border border-white/10 shadow-2xl">
                <div className="text-center space-y-1">
                  <p className="text-[10px] font-black uppercase tracking-widest text-primary">Staff Login</p>
                  <h2 className="text-xl font-black uppercase text-white tracking-tight">Sign in to Terminal</h2>
                  <p className="text-xs text-white/60">Enter your staff email and password. Setting a 4-digit quick-switch PIN is optional.</p>
                </div>
                <form onSubmit={handlePasswordSignIn} className="space-y-4">
                  <div className="space-y-3">
                    <Input
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="Staff Email"
                      className="h-14 bg-white/5 border-white/10 rounded-2xl text-white text-center font-bold focus:bg-white/10 focus:ring-primary/20"
                      required
                    />
                    <Input
                      type="password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="Password"
                      autoComplete="current-password"
                      className="h-14 bg-white/5 border-white/10 rounded-2xl text-white text-center font-bold focus:bg-white/10 focus:ring-primary/20"
                      required
                    />
                    <Input
                      type="password"
                      inputMode="numeric"
                      pattern="\d*"
                      maxLength={4}
                      value={optionalPin}
                      onChange={(e) => setOptionalPin(e.target.value.replace(/[^0-9]/g, '').slice(0, 4))}
                      placeholder="Optional 4-digit PIN (for fast switching)"
                      autoComplete="new-password"
                      className="h-12 bg-white/5 border-white/10 rounded-2xl text-white text-center font-bold tracking-[0.2em] placeholder:tracking-normal placeholder:font-medium placeholder:text-xs focus:bg-white/10 focus:ring-primary/20"
                    />
                  </div>
                  {error && pinErrorMessage && (
                    <p role="alert" className="text-xs leading-relaxed text-red-300 bg-red-500/10 border border-red-400/20 rounded-lg px-3 py-2">
                      {pinErrorMessage}
                    </p>
                  )}
                  <Button
                    type="submit"
                    disabled={isVerifying}
                    className="w-full h-14 bg-white text-zinc-900 rounded-2xl font-black uppercase text-[11px] tracking-widest active:scale-95 transition-all shadow-xl hover:bg-zinc-100"
                  >
                    {isVerifying ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
                    Sign in to Station
                  </Button>
                  <button
                    type="button"
                    onClick={handleCancelSwitch}
                    className="w-full text-center text-[10px] font-black uppercase text-zinc-400 hover:text-white tracking-[0.2em] pt-2 transition-colors"
                  >
                    Cancel
                  </button>
                </form>
              </div>
            ) : showSelector ? (
              <div className="w-full max-w-2xl space-y-5 sm:space-y-8 md:space-y-10 animate-in fade-in duration-700">
                <div className="text-center space-y-3">
                  <p className="text-[10px] font-black uppercase text-primary tracking-[0.5em] animate-pulse">Switch Account</p>
                  <h2 className="text-3xl md:text-4xl font-black font-headline uppercase text-white tracking-tighter leading-none">
                    Select your profile.
                  </h2>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 sm:gap-4 max-h-[min(58dvh,620px)] md:max-h-none overflow-y-auto overscroll-contain no-scrollbar p-1 sm:p-2">
                  {recentOperators.map((op) => (
                    <button
                      key={op.uid}
                      type="button"
                      onClick={() => handleProfileSelect(op)}
                      className="group w-full p-5 md:p-6 bg-black/40 backdrop-blur-2xl rounded-[1.5rem] md:rounded-[2rem] flex items-center justify-between hover:bg-white/5 border border-white/5 transition-all active:scale-[0.98] shadow-2xl hover:border-primary/40"
                    >
                      <div className="flex items-center gap-5 text-left flex-1 min-w-0">
                        <Avatar className="h-12 w-12 md:h-14 md:w-14 rounded-2xl shadow-xl ring-2 ring-white/5 group-hover:ring-primary/20 transition-all shrink-0">
                          <AvatarImage src={op.photoURL || undefined} className="object-cover" />
                          <AvatarFallback className="bg-zinc-900 text-primary font-black uppercase border border-white/5">
                            {op.displayName?.[0]}
                          </AvatarFallback>
                        </Avatar>
                        <div className="min-w-0 flex-1">
                          <p className="text-xs md:text-sm font-black uppercase text-white leading-tight mb-1.5 truncate group-hover:text-primary transition-colors">
                            {op.displayName}
                          </p>
                          <Badge variant="outline" className="text-[7px] md:text-[8px] font-bold text-zinc-500 uppercase tracking-widest border-white/10 group-hover:border-primary/20">
                            {op.role}
                          </Badge>
                        </div>
                      </div>
                      <ChevronRight className="w-4 h-4 md:w-5 md:h-5 text-zinc-700 group-hover:text-primary transition-all group-hover:translate-x-1 shrink-0 ml-2" />
                    </button>
                  ))}
                  <Button
                    type="button"
                    onClick={() => {
                      setEmail('');
                      setPassword('');
                      setOptionalPin('');
                      setError(false);
                      setPinErrorMessage('');
                      setIsSigningInWithPassword(true);
                    }}
                    className="w-full h-auto p-5 md:p-6 bg-white/5 backdrop-blur-md text-white hover:bg-white/10 border border-white/10 hover:border-white/20 rounded-[1.5rem] md:rounded-[2rem] font-black uppercase text-[10px] md:text-[11px] tracking-widest transition-all shadow-xl min-h-[70px] md:min-h-[86px]"
                  >
                    Sign in with Email & Password
                  </Button>
                </div>
                {authUser && activeCashier && !isRemotelyDisabled && (
                  <div className="text-center">
                    <button
                      type="button"
                      onClick={handleResumeCurrentSession}
                      className="text-xs font-black uppercase tracking-widest text-zinc-300 hover:text-white underline underline-offset-4"
                    >
                      Continue as {activeCashier.displayName || activeCashier.email}
                    </button>
                  </div>
                )}
              </div>
            ) : (
              <div className="w-full flex flex-col md:flex-row gap-5 md:gap-10 items-center justify-center animate-in fade-in duration-700 mt-2 md:mt-0">
                <div className="space-y-6 md:space-y-8 text-center md:text-left flex-1 max-lg">
                  <div className="inline-flex items-center gap-5 md:gap-6 bg-black/25 backdrop-blur-xl p-3 md:p-4 pr-5 md:pr-10 rounded-[2rem] md:rounded-[2.5rem] border border-white/5 shadow-2xl mx-auto md:mx-0">
                    <Avatar className="h-16 w-16 md:h-24 md:w-24 rounded-[1.5rem] md:rounded-[2.5rem] ring-4 ring-primary/20 shadow-2xl border-2 border-white/10 shrink-0">
                      <AvatarImage src={selectedCashier?.photoURL || undefined} className="object-cover" />
                      <AvatarFallback className="bg-zinc-900 text-primary text-xl md:text-2xl font-black uppercase border border-white/5">
                        {selectedCashier?.displayName?.[0]}
                      </AvatarFallback>
                    </Avatar>
                    <div className="text-left space-y-1 md:space-y-2 min-w-0">
                      <p className="text-[9px] md:text-[10px] font-black text-primary uppercase tracking-[0.4em]">Selected staff account</p>
                      <h2 className="text-2xl md:text-3xl font-black uppercase text-white tracking-tighter leading-none truncate">
                        {selectedCashier?.displayName}
                      </h2>
                      <Badge className="bg-white/10 text-white border-none text-[8px] md:text-[9px] font-black uppercase px-3 py-1 shadow-sm">
                        {selectedCashier?.role}
                      </Badge>
                    </div>
                  </div>
                  <div className="space-y-2 md:space-y-3">
                    <h2 className="text-4xl md:text-8xl font-black font-headline uppercase text-white tracking-tighter leading-none">
                      Enter your PIN.
                    </h2>
                    <p className="text-[10px] md:text-[11px] font-black text-zinc-500 uppercase tracking-[0.6em]">Secure Staff Access</p>
                  </div>
                  <div className="flex flex-wrap items-center gap-3 justify-center md:justify-start">
                    <button
                      type="button"
                      onClick={handleCancelSwitch}
                      className="text-zinc-400 hover:text-white uppercase font-black text-[9px] md:text-[11px] tracking-[0.25em] h-10 px-5 rounded-xl border border-white/10 bg-white/5 backdrop-blur-xl transition-all active:scale-95 hover:bg-primary/10 hover:border-primary/20"
                    >
                      Switch account
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setEmail(selectedCashier?.email || '');
                        setPassword('');
                        setOptionalPin('');
                        setError(false);
                        setPinErrorMessage('');
                        setIsSigningInWithPassword(true);
                      }}
                      className="text-primary hover:text-white uppercase font-black text-[9px] md:text-[11px] tracking-[0.2em] h-10 px-5 rounded-xl border border-primary/30 bg-primary/10 transition-all active:scale-95"
                    >
                      Use password instead
                    </button>
                    {authUser && activeCashier && selectedCashier?.uid === activeCashier.uid && !isRemotelyDisabled && (
                      <button
                        type="button"
                        onClick={handleResumeCurrentSession}
                        className="text-zinc-300 hover:text-white uppercase font-black text-[9px] md:text-[11px] tracking-[0.2em] h-10 px-5 rounded-xl border border-white/10 bg-white/5 transition-all active:scale-95"
                      >
                        Return to workspace
                      </button>
                    )}
                  </div>
                </div>

                <div className="flex flex-col items-center flex-1 max-w-[320px] md:max-w-[360px] w-full">
                  <div
                    onClick={focusInput}
                    className="w-full bg-black/30 backdrop-blur-2xl p-5 sm:p-8 md:p-10 rounded-2xl sm:rounded-[2rem] md:rounded-[2.5rem] border border-white/5 shadow-[0_50px_100px_rgba(0,0,0,0.5)] relative cursor-text"
                  >
                    <div className="space-y-6">
                      <div className="flex relative justify-center gap-4 md:gap-6 mb-2 pointer-events-none">
                        {[0, 1, 2, 3].map((idx) => {
                          const isFilled = pin.length > idx;
                          return (
                            <div
                              key={idx}
                              className={cn(
                                'w-5 h-5 md:w-6 md:h-6 rounded-full border-2 transition-all duration-300 shadow-2xl',
                                isFilled
                                  ? 'bg-primary border-primary scale-125 shadow-[0_0_25px_rgba(255,106,0,0.8)]'
                                  : 'border-white/20 bg-white/5',
                                error && !isFilled && 'border-red-500/50'
                              )}
                            />
                          );
                        })}
                      </div>

                      <div className="min-h-6 flex items-center justify-center">
                        {error && (
                          <div role="alert" className="w-full flex items-start gap-2 text-red-300 bg-red-500/10 border border-red-400/20 rounded-lg px-3 py-2 text-left">
                            <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
                            <span className="text-xs leading-relaxed">{pinErrorMessage || 'Incorrect PIN. Check your entry and try again.'}</span>
                          </div>
                        )}
                        {!error && isVerifying && (
                          <div className="flex items-center gap-2 text-primary">
                            <Loader2 className="w-3 h-3 animate-spin" />
                            <span className="text-[9px] font-black uppercase tracking-widest">Verifying...</span>
                          </div>
                        )}
                      </div>
                    </div>

                    <div className="md:hidden mt-6">
                      <Input
                        type="password"
                        inputMode="numeric"
                        pattern="\d*"
                        maxLength={4}
                        autoFocus
                        value={pin}
                        onChange={handleHiddenInputChange}
                        className="h-16 bg-white/5 border-white/10 rounded-[1.5rem] text-3xl font-black text-center text-white focus:bg-white/10 focus:ring-primary/20 tracking-[0.5em] placeholder:text-white/5"
                        placeholder="••••"
                      />
                    </div>

                    <div className="hidden md:grid grid-cols-3 gap-3 md:gap-4 w-full mt-6">
                      {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((num) => (
                        <button
                          key={num}
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleKeyPress(num.toString());
                          }}
                          className="h-16 md:h-18 bg-white/5 hover:bg-white/15 backdrop-blur-md active:scale-90 text-2xl md:text-3xl font-black text-white rounded-[1.5rem] md:rounded-[1.75rem] border border-white/5 transition-all shadow-lg"
                        >
                          {num}
                        </button>
                      ))}
                      <div />
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleKeyPress('0');
                        }}
                        className="h-16 md:h-18 bg-white/5 hover:bg-white/15 backdrop-blur-md active:scale-90 text-2xl md:text-3xl font-black text-white rounded-[1.5rem] md:rounded-[1.75rem] border border-white/5 transition-all shadow-lg"
                      >
                        0
                      </button>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDeleteKeyPress();
                        }}
                        className="h-16 md:h-18 bg-red-500/10 hover:bg-red-500/20 text-red-500 rounded-[1.5rem] md:rounded-[1.75rem] border border-red-500/20 flex items-center justify-center transition-all shadow-lg active:scale-90"
                      >
                        <Delete className="w-6 h-6 md:w-8 md:h-8" />
                      </button>
                    </div>

                    <input
                      ref={hiddenInputRef}
                      type="password"
                      inputMode="numeric"
                      pattern="\d*"
                      maxLength={4}
                      value={pin}
                      onChange={handleHiddenInputChange}
                      className="opacity-0 absolute inset-0 w-full h-full cursor-default pointer-events-none"
                      tabIndex={-1}
                    />
                  </div>

                  {selectedCashier?.email && (
                    <div className="mt-5 w-full rounded-xl border border-white/10 bg-black/35 p-4 text-left">
                      {!pinResetMode ? (
                        <button
                          type="button"
                          onClick={() => {
                            setPinResetMode(true);
                            void requestPinReset();
                          }}
                          className="w-full text-center text-xs font-semibold text-primary hover:text-white"
                        >
                          Forgot your PIN? Reset by email
                        </button>
                      ) : (
                        <form onSubmit={confirmPinReset} className="space-y-3">
                          <div>
                            <p className="text-sm font-semibold text-white">Reset terminal PIN</p>
                            <p className="mt-1 text-xs text-white/60">
                              {pinResetSent
                                ? 'Enter the six-digit code sent to your staff email.'
                                : 'We will send a one-time code to the email on this staff account.'}
                            </p>
                          </div>
                          {pinResetSent && (
                            <>
                              <Input
                                data-pin-reset="true"
                                inputMode="numeric"
                                autoComplete="one-time-code"
                                maxLength={6}
                                value={pinResetCode}
                                onChange={(event) => setPinResetCode(event.target.value.replace(/[^0-9]/g, '').slice(0, 6))}
                                placeholder="6-digit email code"
                                className="h-10 border-white/15 bg-white/10 text-white placeholder:text-white/40"
                              />
                              <Input
                                data-pin-reset="true"
                                type="password"
                                inputMode="numeric"
                                maxLength={4}
                                value={pinResetNewPin}
                                onChange={(event) => setPinResetNewPin(event.target.value.replace(/[^0-9]/g, '').slice(0, 4))}
                                placeholder="New 4-digit PIN"
                                className="h-10 border-white/15 bg-white/10 text-white placeholder:text-white/40"
                              />
                              <Input
                                data-pin-reset="true"
                                type="password"
                                inputMode="numeric"
                                maxLength={4}
                                value={pinResetConfirmPin}
                                onChange={(event) => setPinResetConfirmPin(event.target.value.replace(/[^0-9]/g, '').slice(0, 4))}
                                placeholder="Confirm new PIN"
                                className="h-10 border-white/15 bg-white/10 text-white placeholder:text-white/40"
                              />
                              <Button type="submit" disabled={pinResetLoading} className="h-10 w-full">
                                {pinResetLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                                Confirm PIN reset
                              </Button>
                            </>
                          )}
                          <div className="flex items-center justify-between gap-3">
                            <button
                              type="button"
                              disabled={pinResetLoading}
                              onClick={() => void requestPinReset()}
                              className="text-xs font-medium text-primary hover:text-white"
                            >
                              {pinResetSent ? 'Resend code' : 'Send reset code'}
                            </button>
                            <button
                              type="button"
                              onClick={() => {
                                setPinResetMode(false);
                                setPinResetSent(false);
                                setPinResetCode('');
                                setPinResetNewPin('');
                                setPinResetConfirmPin('');
                              }}
                              className="text-xs text-white/55 hover:text-white"
                            >
                              Cancel
                            </button>
                          </div>
                        </form>
                      )}
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>

          <div className="py-4 sm:py-6 md:py-12 text-[7px] md:text-[9px] font-black text-white/10 uppercase tracking-[1em] select-none text-center shrink-0">
            Urban Express Business OS v2.8
          </div>
        </div>
      </div>
    );
  }

  const showInlinePinPrompt = Boolean(
    unit &&
      activeCashier &&
      activeCashier.role !== 'CLIENT' &&
      !isAdminUser &&
      !activeCashier.hasPin &&
      !serverPinConfigured &&
      !pinBannerDismissed
  );

  return (
    <>
      <TerminalLiveAudioAgent terminalId={activeTerminal?.id} cashierId={activeCashier?.uid} cashierName={activeCashier?.displayName} />
      {showInlinePinPrompt && (
        <div
          role="region"
          aria-label="Optional quick PIN setup"
          className="bg-zinc-900 text-white px-4 py-2 text-xs flex items-center justify-between gap-3 border-b border-zinc-800"
        >
          <div className="flex items-center gap-2 min-w-0">
            <KeyRound className="w-3.5 h-3.5 text-primary shrink-0" />
            <span className="truncate text-[11px] font-medium text-zinc-200">
              Shared POS tip: set an optional 4-digit PIN for fast operator switching.
            </span>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <Link
              href="/settings"
              className="px-2.5 py-1 rounded-md bg-primary text-white text-[10px] font-black uppercase tracking-wider hover:bg-primary/90 transition-colors"
            >
              Set up quick PIN
            </Link>
            <button
              type="button"
              onClick={dismissPinBanner}
              aria-label="Dismiss quick PIN tip"
              className="p-1 text-zinc-400 hover:text-white transition-colors"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      )}
      {children}
    </>
  );
}
