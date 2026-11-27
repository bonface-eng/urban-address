'use client';

import React, { useState, useMemo, useEffect, useCallback, useRef } from 'react';
import { useTerminal } from '@/hooks/use-terminal';
import { useUser } from '@/lib/data';
import { initializeApp, deleteApp } from '@/lib/db';
import { getAuth, signInWithEmailAndPassword, signOut } from '@/lib/db';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { 
  User, 
  RefreshCcw, 
  Delete,
  Lock,
  MapPin,
  CheckCircle2,
  KeyRound,
  Hash,
  ArrowLeft,
  ChevronRight,
  ShieldAlert,
  Loader2,
  AlertTriangle
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { BusinessUnit, UserProfile } from '@/lib/types';
import { Badge } from '@/components/ui/badge';
import { toast } from '@/hooks/use-toast';
import Image from 'next/image';
import Link from 'next/link';
import { TerminalWelcome } from '@/components/pos/terminal-welcome';
import { TerminalPermissionsGate } from '@/components/pos/terminal-permissions-gate';
import { TerminalLiveAudioAgent } from '@/components/pos/terminal-live-audio-agent';

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
    clientIp
  } = useTerminal();

  const [pin, setPin] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isVerifying, setIsVerifying] = useState(false);
  const [showStaffSelector, setShowStaffSelector] = useState(false);
  const [isAddingAccount, setIsAddingAccount] = useState(false);
  const [fullSignInMode, setFullSignInMode] = useState(false);
  const [error, setError] = useState(false);
  const [pinErrorMessage, setPinErrorMessage] = useState('');
  const [disclaimerAcknowledged, setDisclaimerAcknowledged] = useState(false);
  const [disclaimerAccepted, setDisclaimerAccepted] = useState(false);
  
  const [setupStep, setSetupStep] = useState<'NEW' | 'CONFIRM'>('NEW');
  const [newPin, setNewPin] = useState('');
  const [confirmPin, setConfirmPin] = useState('');
  const [setupComplete, setSetupComplete] = useState(false);
  const [enrollPin, setEnrollPin] = useState('');
  const [confirmEnrollPin, setConfirmEnrollPin] = useState('');
  const [deviceId, setDeviceId] = useState('');
  const [selectedOperator, setSelectedOperator] = useState<UserProfile | null>(null);
  const [serverPinConfigured, setServerPinConfigured] = useState(false);
  const [pinResetMode, setPinResetMode] = useState(false);
  const [pinResetSent, setPinResetSent] = useState(false);
  const [pinResetCode, setPinResetCode] = useState('');
  const [pinResetNewPin, setPinResetNewPin] = useState('');
  const [pinResetConfirmPin, setPinResetConfirmPin] = useState('');
  const [pinResetLoading, setPinResetLoading] = useState(false);

  const [recentOperators, setRecentOperators] = useState<UserProfile[]>([]);
  const [currentTime, setCurrentTime] = useState<Date | null>(null);
  const [showWelcome, setShowWelcome] = useState(true);
  const welcomeDismissedRef = useRef(false);
  const [permissionsReadyForUid, setPermissionsReadyForUid] = useState<string | null>(null);
  const handlePermissionsReady = useCallback(() => {
    if (activeCashier?.uid) setPermissionsReadyForUid(activeCashier.uid + ':' + activeCashier.role);
  }, [activeCashier?.uid]);

  useEffect(() => {
    if (!activeCashier?.uid) setPermissionsReadyForUid(null);
  }, [activeCashier?.uid]);
  const hiddenInputRef = useRef<HTMLInputElement>(null);
  const registeredIdentityRef = useRef<string | null>(null);
  const selectedCashier = selectedOperator || activeCashier;

  useEffect(() => {
    if (isLocked) {
      if (!welcomeDismissedRef.current) setShowWelcome(true);
    } else {
      // A newly locked shift should show the welcome screen again.
      welcomeDismissedRef.current = false;
    }
  }, [isLocked]);

  const handleBeginShift = useCallback(() => {
    // Latch dismissal so a concurrent lock-state refresh cannot reopen the welcome screen.
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
        const safeOperators = parsed.filter((u: UserProfile) => u.role !== 'CLIENT').map((operator: UserProfile) => {
          const safe = { ...operator } as UserProfile & { pinConfigured?: boolean };
          delete safe.pin;
          delete (safe as any).masterKey;
          return safe;
        });
        setRecentOperators(safeOperators);
        localStorage.setItem('uax_recent_operators', JSON.stringify(safeOperators));
      } catch (e) {
        setRecentOperators([]);
      }
    }
  }, []);

  useEffect(() => {
    if (activeCashier && activeCashier.role !== 'CLIENT') {
      setRecentOperators(prev => {
        const exists = prev.find(p => p.uid === activeCashier.uid);
        if (exists) return prev;
        const safe = { ...activeCashier, pin: undefined, pinConfigured: serverPinConfigured } as UserProfile & { pinConfigured: boolean };
        delete (safe as any).masterKey;
        const updated = [safe, ...prev.filter(p => p.uid !== activeCashier.uid)].slice(0, 50);
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
          method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token },
          body: JSON.stringify({ action: 'register', targetUid: authUser.uid, deviceId }),
        });
        const payload = await response.json();
        if (!response.ok) throw new Error(payload.error || 'Could not register this staff account on the device.');
        if (cancelled) return;
        setServerPinConfigured(Boolean(payload.hasPin));
        setDisclaimerAcknowledged(Boolean(payload.disclaimerAcknowledged));
        setRecentOperators(prev => {
          const profile = { ...payload.profile, pinConfigured: Boolean(payload.hasPin) } as UserProfile;
          setSelectedOperator(current => current?.uid === profile.uid ? profile : current);
          const next = [profile, ...prev.filter(item => item.uid !== profile.uid)].slice(0, 50);
          localStorage.setItem('uax_recent_operators', JSON.stringify(next));
          return next;
        });
      } catch (error) {
        registeredIdentityRef.current = null;
        console.error('[TERMINAL] Device account registration failed:', error);
        toast({ variant: 'destructive', title: 'Device registration unavailable', description: 'Sign in again or contact an administrator.' });
      }
    })();
    return () => { cancelled = true; };
  }, [authUser, activeCashier?.uid, deviceId]);

  const needsPinSetup = useMemo(() => {
    if (!selectedCashier || setupComplete) return false;
    const configured = selectedCashier.uid === authUser?.uid
      ? serverPinConfigured
      : Boolean((selectedOperator as (UserProfile & { pinConfigured?: boolean }) | null)?.pinConfigured);
    return !configured && selectedCashier.uid === authUser?.uid;
  }, [selectedCashier, selectedOperator, serverPinConfigured, authUser?.uid, setupComplete]);

  const focusInput = () => {
    if (hiddenInputRef.current) {
      hiddenInputRef.current.focus();
    }
  };

  const submitSetup = useCallback(async (p1: string, p2: string) => {
    if (!authUser || !selectedCashier || selectedCashier.uid !== authUser.uid || !deviceId || isVerifying) return;
    if (p1 !== p2) {
      setError(true);
      setPinErrorMessage('The PIN entries do not match. Please create and confirm your PIN again.');
      setSetupStep('NEW');
      setNewPin('');
      setConfirmPin('');
      return;
    }
    setIsVerifying(true);
    try {
      const token = await authUser.getIdToken();
      const registerResponse = await fetch('/api/terminal/pin', { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token }, body: JSON.stringify({ action: 'register', targetUid: selectedCashier.uid, deviceId }) });
      if (!registerResponse.ok) throw new Error('Staff account registration must finish before PIN setup.');
      const response = await fetch('/api/terminal/pin', { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token }, body: JSON.stringify({ action: 'set-pin', targetUid: selectedCashier.uid, deviceId, pin: p1 }) });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error || 'PIN setup failed.');
      setServerPinConfigured(true);
      setSetupComplete(true);
      setSelectedOperator({ ...selectedCashier, pinConfigured: true } as UserProfile);
      setIsLocked(false);
      setRecentOperators(prev => {
        const next = [{ ...selectedCashier, pinConfigured: true } as UserProfile, ...prev.filter(item => item.uid !== selectedCashier.uid)].slice(0, 50);
        localStorage.setItem('uax_recent_operators', JSON.stringify(next));
        return next;
      });
      toast({ title: 'PIN Created', description: 'Your PIN is securely stored for this device.' });
    } catch (err) {
      setError(true);
      setPinErrorMessage(err instanceof Error ? err.message : 'PIN setup failed. Please try again.');
    } finally {
      setIsVerifying(false);
    }
  }, [authUser, selectedCashier, deviceId, isVerifying, setIsLocked]);

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
      toast({ title: 'Reset code sent', description: payload.destination ? `Check ${payload.destination} for the six-digit code.` : 'Check your staff email for the six-digit code.' });
    } catch (error) {
      toast({ variant: 'destructive', title: 'PIN reset email unavailable', description: error instanceof Error ? error.message : 'Please try again.' });
    } finally {
      setPinResetLoading(false);
    }
  }, [selectedCashier?.uid, deviceId, pinResetLoading]);

  const confirmPinReset = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!selectedCashier?.uid || !deviceId || pinResetLoading) return;
    if (!/^\d{6}$/.test(pinResetCode) || !/^\d{4}$/.test(pinResetNewPin) || pinResetNewPin !== pinResetConfirmPin) {
      toast({ variant: 'destructive', title: 'Check your entries', description: 'Enter the six-digit email code and the same new four-digit PIN twice.' });
      return;
    }
    setPinResetLoading(true);
    try {
      const response = await fetch('/api/terminal/pin-reset', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'confirm', targetUid: selectedCashier.uid, deviceId, code: pinResetCode, pin: pinResetNewPin }),
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error || 'PIN reset failed.');
      setServerPinConfigured(true);
      setSelectedOperator({ ...selectedCashier, pinConfigured: true } as UserProfile);
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
      toast({ variant: 'destructive', title: 'PIN reset failed', description: error instanceof Error ? error.message : 'Check the code and try again.' });
    } finally {
      setPinResetLoading(false);
    }
  };

  const handleKeyPress = useCallback((val: string) => {
    if (isVerifying) return;
    setError(false);
    setPinErrorMessage('');

    if (needsPinSetup) {
      if (setupStep === 'NEW') {
        setNewPin(prev => {
          const next = (prev + val).slice(0, 4);
          if (next.length === 4) {
            setSetupStep('CONFIRM');
            setConfirmPin('');
            return next;
          }
          return next;
        });
      } else {
        setConfirmPin(prev => {
          const next = (prev + val).slice(0, 4);
          if (next.length === 4) {
            submitSetup(newPin, next);
            return next;
          }
          return next;
        });
      }
    } else {
      setPin(prev => {
        const next = (prev + val).slice(0, 4);
        return next;
      });
    }
  }, [needsPinSetup, setupStep, newPin, isVerifying, submitSetup]);

  const handleDeleteKeyPress = useCallback(() => {
    if (isVerifying) return;
    if (needsPinSetup) {
      if (setupStep === 'NEW') setNewPin(prev => prev.slice(0, -1));
      else setConfirmPin(prev => prev.slice(0, -1));
    } else {
      setPin(prev => prev.slice(0, -1));
    }
    setError(false);
    setPinErrorMessage('');
  }, [needsPinSetup, setupStep, isVerifying]);

  const handleHiddenInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value.replace(/[^0-9]/g, '').slice(0, 4);
    setError(false);
    setPinErrorMessage('');
    
    if (needsPinSetup) {
      if (setupStep === 'NEW') {
        setNewPin(val);
        if (val.length === 4) {
          setSetupStep('CONFIRM');
          setConfirmPin('');
        }
      } else {
        setConfirmPin(val);
        if (val.length === 4) {
          submitSetup(newPin, val);
        }
      }
    } else {
      setPin(val);
    }
  };

  useEffect(() => {
    if (!isLocked || isAddingAccount) return;
    const handleKeyboardInput = (e: KeyboardEvent) => {
      if (document.activeElement?.tagName === 'INPUT' && (document.activeElement as HTMLInputElement).dataset.pinReset === 'true') return;
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
  }, [isLocked, isAddingAccount, handleKeyPress, handleDeleteKeyPress]);

  useEffect(() => {
    if (isLocked && selectedCashier && !needsPinSetup && pin.length === 4 && deviceId) {
      setIsVerifying(true);
      switchWithPin(selectedCashier.uid, pin, deviceId).then(success => {
        if (!success) {
          setError(true);
          setPinErrorMessage('Incorrect PIN. Check your entry and try again.');
          setPin('');
        } else {
          setPin('');
          setError(false);
          setSelectedOperator(null);
        }
        setIsVerifying(false);
      });
    }
  }, [pin, isLocked, selectedCashier?.uid, needsPinSetup, deviceId, switchWithPin]);

  const handleProfileSelect = (op: UserProfile) => {
    setError(false);
    setPinErrorMessage('');
    setPin('');
    setPinResetMode(false);
    setPinResetSent(false);
    setPinResetCode('');
    setPinResetNewPin('');
    setPinResetConfirmPin('');
    setNewPin('');
    setConfirmPin('');
    setSetupStep('NEW');
    setSetupComplete(false);
    const hasPin = Boolean((op as UserProfile & { pinConfigured?: boolean }).pinConfigured);
    if (authUser?.uid === op.uid || (hasPin && Boolean(authUser))) {
      setSelectedOperator(op);
      setShowStaffSelector(false);
      return;
    }
    setEmail(op.email || '');
    setPassword('');
    setEnrollPin('');
    setConfirmEnrollPin('');
    setFullSignInMode(false);
    setIsAddingAccount(true);
  };

  const handleCancelSwitch = () => {
    setIsAddingAccount(false);
    setFullSignInMode(false);
    setSelectedOperator(null);
    setEnrollPin('');
    setConfirmEnrollPin('');
    setEmail('');
    setPassword('');
    setPin('');
    setNewPin('');
    setConfirmPin('');
    setSetupStep('NEW');
    setSetupComplete(false);
    setError(false);
    setShowStaffSelector(true);
  };

  const handleAction = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (isVerifying || !deviceId) return;
    if (fullSignInMode) {
      setIsVerifying(true);
      const primaryAuth = getAuth();
      try {
        const credential = await signInWithEmailAndPassword(primaryAuth, email.toLowerCase().trim(), password);
        const token = await credential.user.getIdToken(true);
        const response = await fetch('/api/terminal/pin', {
          method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token },
          body: JSON.stringify({ action: 'register', targetUid: credential.user.uid, deviceId }),
        });
        const payload = await response.json();
        if (!response.ok) {
          await signOut(primaryAuth).catch(() => undefined);
          throw new Error(payload.error || 'This account is not authorized for staff access.');
        }
        setServerPinConfigured(Boolean(payload.hasPin));
        setRecentOperators(prev => {
          const profile = { ...payload.profile, pinConfigured: Boolean(payload.hasPin) } as UserProfile;
          const next = [profile, ...prev.filter(item => item.uid !== profile.uid)].slice(0, 50);
          localStorage.setItem('uax_recent_operators', JSON.stringify(next));
          return next;
        });
        setIsAddingAccount(false);
        setFullSignInMode(false);
        setSelectedOperator(null);
        setShowStaffSelector(false);
        setEmail('');
        setPassword('');
        setIsLocked(false);
        toast({ title: 'Full staff sign-in complete', description: 'Privileged actions are now available for this session.' });
      } catch (error) {
        toast({ variant: 'destructive', title: 'Full sign-in failed', description: error instanceof Error ? error.message : 'Check your password and try again.' });
      } finally {
        setIsVerifying(false);
      }
      return;
    }
    if (!fullSignInMode && !disclaimerAccepted) {
      setError(true);
      setPinErrorMessage('Please read and acknowledge the security update before setting a device PIN.');
      return;
    }
    if (!/^\d{4}$/.test(enrollPin) || enrollPin !== confirmEnrollPin) {
      setError(true);
      setPinErrorMessage('The PIN entries do not match. Enter the same 4-digit PIN twice.');
      return;
    }
    setIsVerifying(true);
    let secondaryApp: ReturnType<typeof initializeApp> | null = null;
    let secondaryAuth: ReturnType<typeof getAuth> | null = null;
    try {
      secondaryApp = initializeApp(undefined, 'terminal-enrol-' + crypto.randomUUID());
      secondaryAuth = getAuth(secondaryApp);
      const credential = await signInWithEmailAndPassword(secondaryAuth, email.toLowerCase().trim(), password);
      const token = await credential.user.getIdToken();
      const registerResponse = await fetch('/api/terminal/pin', {
        method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token },
        body: JSON.stringify({ action: 'register', targetUid: credential.user.uid, deviceId }),
      });
      const registered = await registerResponse.json();
      if (!registerResponse.ok) throw new Error(registered.error || 'This account is not authorized for staff access.');
      const ackResponse = await fetch('/api/terminal/pin', { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token }, body: JSON.stringify({ action: 'acknowledge-disclaimer', targetUid: credential.user.uid, deviceId }) });
      if (!ackResponse.ok) throw new Error('Could not save your security-update acknowledgement. Please try again.');
      const pinResponse = await fetch('/api/terminal/pin', {
        method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token },
        body: JSON.stringify({ action: 'set-pin', targetUid: credential.user.uid, deviceId, pin: enrollPin }),
      });
      const pinResult = await pinResponse.json();
      if (!pinResponse.ok) throw new Error(pinResult.error || 'Could not save the staff PIN.');
      if (!authUser) {
        // The first enrolled operator becomes the device's authenticated Supabase identity.
        await signInWithEmailAndPassword(getAuth(), email.toLowerCase().trim(), password);
      }
      const profile = { ...registered.profile, pinConfigured: true } as UserProfile;
      setRecentOperators(prev => {
        const next = [profile, ...prev.filter(item => item.uid !== profile.uid)].slice(0, 50);
        localStorage.setItem('uax_recent_operators', JSON.stringify(next));
        return next;
      });
      setIsAddingAccount(false);
      setFullSignInMode(false);
      setShowStaffSelector(true);
      setEmail('');
      setPassword('');
      setEnrollPin('');
      setConfirmEnrollPin('');
      setDisclaimerAccepted(false);
      setSelectedOperator(null);
      toast({ title: 'Staff account added', description: 'This staff member can now use their PIN on this device.' });
    } catch (error) {
      toast({ variant: 'destructive', title: 'Staff sign-in failed', description: error instanceof Error ? error.message : 'Check the credentials and try again.' });
    } finally {
      if (secondaryAuth) await signOut(secondaryAuth).catch(() => undefined);
      if (secondaryApp) await deleteApp(secondaryApp).catch(() => undefined);
      setIsVerifying(false);
    }
  };

  // Only block for physical connectivity loading. 
  // Don't block if we have an auth session but are waiting for the profile selector.
  if (loading) return (
    <div className="fixed inset-0 z-[2000] bg-black flex items-center justify-center">
       <div className="flex flex-col items-center gap-4">
          <Loader2 className="w-10 h-10 text-primary animate-spin" />
          <p className="text-[10px] font-black uppercase text-white tracking-[0.4em]">Synchronizing Station Node...</p>
       </div>
    </div>
  );

  if (showWelcome && (isLocked || !activeCashier) && !isAddingAccount) {
    return <><TerminalLiveAudioAgent terminalId={activeTerminal?.id} cashierId={activeCashier?.uid} cashierName={activeCashier?.displayName} /><TerminalWelcome onStart={handleBeginShift} currentTime={currentTime} locationName={locationName} unit={unit} /></>;
  }

  if (isLocked || !activeCashier || isAddingAccount || showStaffSelector) {
    const showSelector = showStaffSelector && !isAddingAccount || (!activeCashier && !isAddingAccount);
    const currentInputVal = needsPinSetup ? (setupStep === 'NEW' ? newPin : confirmPin) : pin;

    return (
      <div className="fixed inset-0 z-[2000] bg-black flex items-center justify-center p-0 overflow-hidden font-sans">
         <TerminalLiveAudioAgent terminalId={activeTerminal?.id} cashierId={activeCashier?.uid} cashierName={activeCashier?.displayName} />
         <Image 
           src={selectedCashier ? "/assets/hero4.png" : "/assets/hero3.png"} 
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
         
         <div className={cn("w-full min-h-0 relative z-10 p-4 sm:p-6 flex flex-1 flex-col items-center", (selectedCashier && !isAddingAccount) ? "max-w-5xl" : "max-w-lg")}>
            
            <div className="flex-1 flex flex-col items-center justify-center w-full">
              <div className="mb-4 sm:mb-8 md:mb-12 animate-in fade-in slide-in-from-top-6 duration-1000 shrink-0">
                 <div className="bg-white rounded-2xl sm:rounded-[2rem] p-3 sm:p-5 md:p-6 shadow-[0_18px_50px_rgba(0,0,0,0.28)] ring-1 ring-white/20">
                   <img src="/assets/logo.png" className="h-9 sm:h-11 w-auto object-contain" alt="Urban Express Logo" />
                 </div>
              </div>

              {isAddingAccount ? (
                 <div className="w-full max-w-sm max-h-[calc(100dvh-7rem)] overflow-y-auto bg-black/45 backdrop-blur-xl p-4 sm:p-6 space-y-4 sm:space-y-5 animate-in slide-in-from-bottom-4 rounded-2xl border border-white/10 shadow-2xl">
                    <div className="text-center space-y-1">
                      <p className="text-[10px] font-black uppercase tracking-widest text-primary">Staff Login</p>
                      <h2 className="text-xl font-black uppercase text-white tracking-tight">{fullSignInMode ? 'Full Staff Sign-in' : 'Add Staff Account'}</h2>
                      <p className="text-xs text-white/55">{fullSignInMode ? 'Confirm your password to enable privileged actions on this terminal.' : 'Sign in with your own password and create a PIN for this device.'}</p>
                    </div>
                    <form onSubmit={handleAction} className="space-y-4">
                       <div className="space-y-3">
                          <Input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="Official Email" className="h-14 bg-white/5 border-white/10 rounded-2xl text-white text-center font-bold focus:bg-white/10 focus:ring-primary/20" required />
                          <Input type="password" value={password} onChange={e => setPassword(e.target.value)} placeholder="Your password" autoComplete="current-password" className="h-14 bg-white/5 border-white/10 rounded-2xl text-white text-center font-bold focus:bg-white/10 focus:ring-primary/20" required />
                          {!fullSignInMode && <>
                            <div className="rounded-xl border border-white/10 bg-white/5 p-3 space-y-2 text-left">
                              <p className="text-[11px] font-bold text-white">Why a new device PIN?</p>
                              <p className="text-xs leading-relaxed text-white/65">The previous PIN system has been replaced with server-side PIN verification and stronger protection against repeated incorrect attempts. Your staff account and password remain unchanged; only the PIN on this device needs to be set up again.</p>
                              <label className="flex items-start gap-2 text-xs text-white/80 cursor-pointer"><input type="checkbox" checked={disclaimerAccepted} onChange={e => setDisclaimerAccepted(e.target.checked)} className="mt-0.5 accent-primary" /><span>I have read and understood this security update.</span></label>
                            </div>
                            <Input type="password" inputMode="numeric" pattern="\d*" maxLength={4} value={enrollPin} onChange={e => setEnrollPin(e.target.value.replace(/[^0-9]/g, '').slice(0, 4))} placeholder="Create 4-digit device PIN" autoComplete="new-password" className="h-14 bg-white/5 border-white/10 rounded-2xl text-white text-center font-bold tracking-[0.4em] focus:bg-white/10 focus:ring-primary/20" required />
                            <Input type="password" inputMode="numeric" pattern="\d*" maxLength={4} value={confirmEnrollPin} onChange={e => setConfirmEnrollPin(e.target.value.replace(/[^0-9]/g, '').slice(0, 4))} placeholder="Confirm device PIN" autoComplete="new-password" className="h-14 bg-white/5 border-white/10 rounded-2xl text-white text-center font-bold tracking-[0.4em] focus:bg-white/10 focus:ring-primary/20" required />
                          </>}
                       </div>
                       {error && pinErrorMessage && <p role="alert" className="text-xs leading-relaxed text-red-300 bg-red-500/10 border border-red-400/20 rounded-lg px-3 py-2">{pinErrorMessage}</p>}
                       <Button type="submit" disabled={isVerifying} className="w-full h-16 bg-white text-zinc-900 rounded-2xl font-black uppercase text-[11px] tracking-widest active:scale-95 transition-all shadow-xl hover:bg-zinc-100">{fullSignInMode ? 'Continue with full access' : 'Add account and set PIN'}</Button>
                       <button type="button" onClick={handleCancelSwitch} className="w-full text-center text-[10px] font-black uppercase text-zinc-500 hover:text-white tracking-[0.2em] pt-4 transition-colors">Cancel</button>
                    </form>
                 </div>
              ) : showSelector ? (
                 <div className="w-full max-w-2xl space-y-5 sm:space-y-8 md:space-y-10 animate-in fade-in duration-700">
                    <div className="text-center space-y-3">
                      <p className="text-[10px] font-black uppercase text-primary tracking-[0.5em] animate-pulse">Switch Account</p>
                      <h2 className="text-3xl md:text-4xl font-black font-headline uppercase text-white tracking-tighter leading-none">Select your profile.</h2>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3 sm:gap-4 max-h-[min(58dvh,620px)] md:max-h-none overflow-y-auto overscroll-contain no-scrollbar p-1 sm:p-2">
                      {recentOperators.map(op => (
                        <button 
                          key={op.uid} 
                          type="button"
                          onClick={() => handleProfileSelect(op)} 
                          className="group w-full p-5 md:p-6 bg-black/40 backdrop-blur-2xl rounded-[1.5rem] md:rounded-[2rem] flex items-center justify-between hover:bg-white/5 border border-white/5 transition-all active:scale-[0.98] shadow-2xl hover:border-primary/40 disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          <div className="flex items-center gap-5 text-left flex-1 min-w-0">
                            <Avatar className="h-12 h-12 md:h-14 md:w-14 rounded-2xl shadow-xl ring-2 ring-white/5 group-hover:ring-primary/20 transition-all shrink-0">
                               <AvatarImage src={op.photoURL || undefined} className="object-cover" />
                               <AvatarFallback className="bg-zinc-900 text-primary font-black uppercase border border-white/5">{op.displayName?.[0]}</AvatarFallback>
                            </Avatar>
                            <div className="min-w-0 flex-1">
                               <p className="text-xs md:text-sm font-black uppercase text-white leading-tight mb-1.5 truncate group-hover:text-primary transition-colors">{op.displayName}</p>
                               <Badge variant="outline" className="text-[7px] md:text-[8px] font-bold text-zinc-500 uppercase tracking-widest border-white/10 group-hover:border-primary/20">{op.role}</Badge>
                            </div>
                          </div>
                          <ChevronRight className="w-4 h-4 md:w-5 md:h-5 text-zinc-700 group-hover:text-primary transition-all group-hover:translate-x-1 shrink-0 ml-2" />
                        </button>
                      ))}
                      <Button 
                        type="button"
                        onClick={() => setIsAddingAccount(true)} 
                        className="w-full h-auto p-5 md:p-6 bg-white/5 backdrop-blur-md text-white hover:bg-white/10 border border-white/10 hover:border-white/20 rounded-[1.5rem] md:rounded-[2rem] font-black uppercase text-[10px] md:text-[11px] tracking-widest transition-all shadow-xl min-h-[70px] md:min-h-[86px]"
                      >
                        Add New Account
                      </Button>
                    </div>
                 </div>
              ) : !disclaimerAcknowledged ? (
                <div className="w-full max-w-lg max-h-[calc(100dvh-7rem)] overflow-y-auto rounded-2xl border border-white/10 bg-black/55 backdrop-blur-xl p-4 sm:p-6 md:p-7 space-y-4 shadow-2xl">
                  <div className="flex items-center gap-3"><div className="h-10 w-10 rounded-xl bg-primary/15 flex items-center justify-center shrink-0"><ShieldAlert className="h-5 w-5 text-primary" /></div><div><p className="text-[10px] uppercase tracking-widest text-primary font-bold">Terminal security update</p><h2 className="text-lg sm:text-xl font-bold text-white">A new device PIN is required</h2></div></div>
                  <p className="text-sm leading-relaxed text-white/75">We have upgraded shared-terminal sign-in to protect each staff member’s identity. Your previous PIN was created under the old system and cannot be transferred automatically.</p>
                  <div className="rounded-xl bg-white/5 border border-white/10 p-3 space-y-2"><p className="text-xs font-semibold text-white">What has changed?</p><ul className="list-disc pl-4 space-y-1 text-xs text-white/65"><li>PINs are now securely hashed and verified on the server.</li><li>Repeated incorrect attempts are rate-limited.</li><li>Your Firebase account, password and staff permissions remain unchanged.</li></ul></div>
                  <p className="text-xs leading-relaxed text-white/65">Sign in with your own account and create a new 4-digit device PIN. Administrators must still use full password authentication for privileged actions.</p>
                  <Button type="button" disabled={isVerifying} onClick={async () => { if (!authUser || !deviceId) return; setIsVerifying(true); try { const token = await authUser.getIdToken(); const response = await fetch('/api/terminal/pin', { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token }, body: JSON.stringify({ action: 'acknowledge-disclaimer', targetUid: authUser.uid, deviceId }) }); const payload = await response.json(); if (!response.ok) throw new Error(payload.error || 'Could not save acknowledgement.'); setDisclaimerAcknowledged(true); } catch (e) { setError(true); setPinErrorMessage(e instanceof Error ? e.message : 'Could not save acknowledgement.'); } finally { setIsVerifying(false); } }} className="w-full h-11 rounded-lg">I understand — continue</Button>
                </div>
              ) : (
                <div className="w-full flex flex-col md:flex-row gap-5 md:gap-10 items-center justify-center animate-in fade-in duration-700 mt-2 md:mt-0">
                   <div className="space-y-6 md:space-y-8 text-center md:text-left flex-1 max-lg">
                      <div className="inline-flex items-center gap-5 md:gap-6 bg-black/25 backdrop-blur-xl p-3 md:p-4 pr-5 md:pr-10 rounded-[2rem] md:rounded-[2.5rem] border border-white/5 shadow-2xl mx-auto md:mx-0">
                         <Avatar className="h-16 w-16 md:h-24 md:w-24 rounded-[1.5rem] md:rounded-[2rem] ring-4 ring-primary/20 shadow-2xl border-2 border-white/10 shrink-0">
                            <AvatarImage src={selectedCashier?.photoURL || undefined} className="object-cover" />
                            <AvatarFallback className="bg-zinc-900 text-primary text-xl md:text-2xl font-black uppercase border border-white/5">{selectedCashier?.displayName?.[0]}</AvatarFallback>
                         </Avatar>
                         <div className="text-left space-y-1 md:space-y-2 min-w-0">
                            <p className="text-[9px] md:text-[10px] font-black text-primary uppercase tracking-[0.4em]">Selected staff account</p>
                            <h2 className="text-2xl md:text-3xl font-black uppercase text-white tracking-tighter leading-none truncate">{selectedCashier?.displayName}</h2>
                            <Badge className="bg-white/10 text-white border-none text-[8px] md:text-[9px] font-black uppercase px-3 py-1 shadow-sm">{selectedCashier?.role}</Badge>
                         </div>
                      </div>
                      <div className="space-y-2 md:space-y-3">
                         <h2 className="text-4xl md:text-8xl font-black font-headline uppercase text-white tracking-tighter leading-none">
                           {needsPinSetup ? "Set your PIN." : "Enter your PIN."}
                         </h2>
                         <p className="text-[10px] md:text-[11px] font-black text-zinc-500 uppercase tracking-[0.6em]">Secure Staff Access</p>
                      </div>
                      <div className="flex flex-wrap items-center gap-3 justify-center md:justify-start">
                        <button type="button" onClick={handleCancelSwitch} className="text-zinc-500 hover:text-white uppercase font-black text-[9px] md:text-[11px] tracking-[0.25em] h-10 px-5 rounded-xl border border-white/10 bg-white/5 backdrop-blur-xl transition-all active:scale-95 hover:bg-primary/10 hover:border-primary/20">Switch account</button>
                        <button type="button" onClick={() => { setFullSignInMode(true); setEmail(selectedCashier?.email || ''); setPassword(''); setIsAddingAccount(true); }} className="text-primary hover:text-white uppercase font-black text-[9px] md:text-[11px] tracking-[0.2em] h-10 px-5 rounded-xl border border-primary/30 bg-primary/10 transition-all active:scale-95">Use password for full access</button>
                      </div>
                   </div>

                   <div className="flex flex-col items-center flex-1 max-w-[320px] md:max-w-[360px] w-full">
                      <div 
                        onClick={focusInput}
                        className="w-full bg-black/30 backdrop-blur-2xl p-5 sm:p-8 md:p-10 rounded-2xl sm:rounded-[2rem] md:rounded-[2.5rem] border border-white/5 shadow-[0_50px_100px_rgba(0,0,0,0.5)] relative cursor-text"
                      >
                         {/* UNIFIED INPUT NODE */}
                         <div className="space-y-6">
                            <div className="flex relative justify-center gap-4 md:gap-6 mb-2 pointer-events-none">
                               {[0, 1, 2, 3].map((idx) => {
                                 const isFilled = currentInputVal.length > idx;
                                 return (
                                   <div 
                                     key={idx} 
                                     className={cn(
                                       "w-5 h-5 md:w-6 md:h-6 rounded-full border-2 transition-all duration-300 shadow-2xl", 
                                       isFilled ? "bg-primary border-primary scale-125 shadow-[0_0_25px_rgba(255,106,0,0.8)]" : "border-white/20 bg-white/5",
                                       error && !isFilled && "border-red-500/50"
                                     )} 
                                   />
                                 );
                               })}
                            </div>

                            {/* ERROR MESSAGE NODE */}
                            <div className="h-6 flex items-center justify-center">
                               {error && (
                                 <div role="alert" className="w-full flex items-start gap-2 text-red-300 bg-red-500/10 border border-red-400/20 rounded-lg px-3 py-2 text-left">
                                    <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
                                    <span className="text-xs leading-relaxed">{pinErrorMessage || 'Please check your PIN and try again.'}</span>
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

                         {/* VISIBLE FORM ELEMENT FOR MOBILE, HIDDEN FOR DESKTOP */}
                         <div className="md:hidden mt-6">
                            <Input 
                               type="password"
                               inputMode="numeric"
                               pattern="\d*"
                               maxLength={4}
                               autoFocus
                               value={currentInputVal}
                               onChange={handleHiddenInputChange}
                               className="h-16 bg-white/5 border-white/10 rounded-[1.5rem] text-3xl font-black text-center text-white focus:bg-white/10 focus:ring-primary/20 tracking-[0.5em] placeholder:text-white/5"
                               placeholder="••••"
                            />
                         </div>

                         {/* DESKTOP KEYPAD GRID */}
                         <div className="hidden md:grid grid-cols-3 gap-3 md:gap-4 w-full mt-6">
                            {[1, 2, 3, 4, 5, 6, 7, 8, 9].map(num => (
                              <button 
                                key={num} 
                                type="button"
                                onClick={(e) => { e.stopPropagation(); handleKeyPress(num.toString()); }} 
                                className="h-16 md:h-18 bg-white/5 hover:bg-white/15 backdrop-blur-md active:scale-90 text-2xl md:text-3xl font-black text-white rounded-[1.5rem] md:rounded-[1.75rem] border border-white/5 transition-all shadow-lg"
                              >
                                {num}
                              </button>
                            ))}
                            <div />
                            <button 
                              type="button"
                              onClick={(e) => { e.stopPropagation(); handleKeyPress('0'); }} 
                              className="h-16 md:h-18 bg-white/5 hover:bg-white/15 backdrop-blur-md active:scale-90 text-2xl md:text-3xl font-black text-white rounded-[1.5rem] md:rounded-[1.75rem] border border-white/5 transition-all shadow-lg"
                            >
                              0
                            </button>
                            <button 
                              type="button"
                              onClick={(e) => { e.stopPropagation(); handleDeleteKeyPress(); }} 
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
                           value={currentInputVal}
                           onChange={handleHiddenInputChange}
                           className="opacity-0 absolute inset-0 w-full h-full cursor-default pointer-events-none"
                           tabIndex={-1}
                         />
                      </div>

                      {!needsPinSetup && selectedCashier?.email && (
                        <div className="mt-5 w-full rounded-xl border border-white/10 bg-black/35 p-4 text-left">
                          {!pinResetMode ? (
                            <button type="button" onClick={() => { setPinResetMode(true); void requestPinReset(); }} className="w-full text-center text-xs font-semibold text-primary hover:text-white">
                              Forgot your PIN? Reset by email
                            </button>
                          ) : (
                            <form onSubmit={confirmPinReset} className="space-y-3">
                              <div>
                                <p className="text-sm font-semibold text-white">Reset terminal PIN</p>
                                <p className="mt-1 text-xs text-white/60">{pinResetSent ? 'Enter the six-digit code sent to your staff email.' : 'We will send a one-time code to the email on this staff account.'}</p>
                              </div>
                              {pinResetSent && (
                                <>
                                  <Input data-pin-reset="true" inputMode="numeric" autoComplete="one-time-code" maxLength={6} value={pinResetCode} onChange={event => setPinResetCode(event.target.value.replace(/[^0-9]/g, '').slice(0, 6))} placeholder="6-digit email code" className="h-10 border-white/15 bg-white/10 text-white placeholder:text-white/40" />
                                  <Input data-pin-reset="true" type="password" inputMode="numeric" maxLength={4} value={pinResetNewPin} onChange={event => setPinResetNewPin(event.target.value.replace(/[^0-9]/g, '').slice(0, 4))} placeholder="New 4-digit PIN" className="h-10 border-white/15 bg-white/10 text-white placeholder:text-white/40" />
                                  <Input data-pin-reset="true" type="password" inputMode="numeric" maxLength={4} value={pinResetConfirmPin} onChange={event => setPinResetConfirmPin(event.target.value.replace(/[^0-9]/g, '').slice(0, 4))} placeholder="Confirm new PIN" className="h-10 border-white/15 bg-white/10 text-white placeholder:text-white/40" />
                                  <Button type="submit" disabled={pinResetLoading} className="h-10 w-full">{pinResetLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}Confirm PIN reset</Button>
                                </>
                              )}
                              <div className="flex items-center justify-between gap-3">
                                <button type="button" disabled={pinResetLoading} onClick={() => void requestPinReset()} className="text-xs font-medium text-primary hover:text-white">{pinResetSent ? 'Resend code' : 'Send reset code'}</button>
                                <button type="button" onClick={() => { setPinResetMode(false); setPinResetSent(false); setPinResetCode(''); setPinResetNewPin(''); setPinResetConfirmPin(''); }} className="text-xs text-white/55 hover:text-white">Cancel</button>
                              </div>
                            </form>
                          )}
                        </div>
                      )}

                      {needsPinSetup && (
                         <div className="mt-6 md:mt-8 px-5 py-3 md:px-6 md:py-4 bg-primary/10 backdrop-blur-xl border border-primary/20 rounded-2xl text-center animate-pulse">
                            <p className="text-[9px] md:text-[10px] font-black text-primary uppercase tracking-widest">Step: {setupStep === 'NEW' ? 'Enter a New 4-Digit PIN' : 'Repeat PIN to Confirm'}</p>
                         </div>
                      )}
                   </div>
                </div>
              )}
            </div>
            
            <div className="py-4 sm:py-6 md:py-12 text-[7px] md:text-[9px] font-black text-white/10 uppercase tracking-[1em] select-none text-center shrink-0">Urban Express Business OS v2.5</div>
         </div>
      </div>
    );
  }
  if (activeCashier && activeCashier.role !== 'CLIENT' && permissionsReadyForUid !== activeCashier.uid + ':' + activeCashier.role) {
    return (
      <TerminalPermissionsGate
        key={activeCashier.uid}
        canSkip={activeCashier.role === 'ADMIN'}
        onReady={handlePermissionsReady}
      />
    );
  }

  return <><TerminalLiveAudioAgent terminalId={activeTerminal?.id} cashierId={activeCashier?.uid} cashierName={activeCashier?.displayName} />{children}</>;
}
