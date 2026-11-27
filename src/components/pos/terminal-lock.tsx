'use client';

import React, { useState, useMemo, useEffect, useCallback, useRef } from 'react';
import { useTerminal } from '@/hooks/use-terminal';
import { useUser, useAuth } from '@/firebase';
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

export function TerminalLock({ children, unit }: { children: React.ReactNode; unit?: BusinessUnit }) {
  const { user: authUser } = useUser();
  const auth = useAuth();
  const signInAgain = async () => { await auth?.signOut(); window.location.assign('/login'); };
  const { 
    activeCashier, 
    loading, 
    isLocked, 
    unlockTerminal, 
    pinLoading, pinEnrolled, pinError, retryPinStatus, enrollPin,
    swapIdentity,
    loginAndSwitch,
    clearActiveCashier,
    locationName,
    clientIp
  } = useTerminal();

  const [pin, setPin] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isVerifying, setIsVerifying] = useState(false);
  const [isSwapping, setIsSwapping] = useState(false);
  const [isAddingAccount, setIsAddingAccount] = useState(false);
  const [error, setError] = useState(false);
  
  const [setupStep, setSetupStep] = useState<'NEW' | 'CONFIRM'>('NEW');
  const [newPin, setNewPin] = useState('');
  const [confirmPin, setConfirmPin] = useState('');
  useEffect(() => {
    setPin(''); setNewPin(''); setConfirmPin(''); setSetupStep('NEW'); setError(false);
  }, [activeCashier?.uid]);

  const [recentOperators, setRecentOperators] = useState<Pick<UserProfile, 'uid' | 'email' | 'displayName' | 'photoURL' | 'role'>[]>([]);
  const [currentTime, setCurrentTime] = useState<Date | null>(null);
  const hiddenInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setCurrentTime(new Date());
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    const saved = localStorage.getItem('uax_recent_operators');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        const safe = parsed.filter((u: UserProfile) => u.role !== 'CLIENT').map((u: UserProfile) => ({ uid: u.uid, email: u.email, displayName: u.displayName, photoURL: u.photoURL, role: u.role }));
        setRecentOperators(safe);
        localStorage.setItem('uax_recent_operators', JSON.stringify(safe));
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
        const { uid, email, displayName, photoURL, role } = activeCashier;
        const updated = [{ uid, email, displayName, photoURL, role }, ...prev].slice(0, 5);
        localStorage.setItem('uax_recent_operators', JSON.stringify(updated));
        return updated;
      });
    }
  }, [activeCashier]);

  const needsPinSetup = !!activeCashier && !pinLoading && !pinError && !pinEnrolled;

  const focusInput = () => {
    if (hiddenInputRef.current) {
      hiddenInputRef.current.focus();
    }
  };

  const submitSetup = useCallback(async (p1: string, p2: string) => {
    if (!activeCashier || activeCashier.uid !== authUser?.uid || isVerifying) return;
    if (!/^\d{4}$/.test(p1) || p1 !== p2) {
      setError(true);
      toast({ variant: "destructive", title: "PIN Mismatch", description: "Entries do not match. Restarting setup." });
      setSetupStep('NEW');
      setNewPin('');
      setConfirmPin('');
      return;
    }
    setIsVerifying(true);
    try {
      await enrollPin(p1, p2);
      setNewPin(''); setConfirmPin(''); setSetupStep('NEW');
      toast({ title: "PIN Created", description: "Your code has been synchronized." });
    } catch (err) {
      setNewPin(''); setConfirmPin(''); setSetupStep('NEW');
      toast({ variant: "destructive", title: "PIN setup failed", description: err instanceof Error ? err.message : "Please retry." });
    } finally {
      setIsVerifying(false);
    }
  }, [activeCashier, authUser?.uid, isVerifying, enrollPin]);

  const handleKeyPress = useCallback((val: string) => {
    if (isVerifying || !/^\d$/.test(val)) return;
    setError(false);

    if (needsPinSetup) {
      if (setupStep === 'NEW') {
        const next = (newPin + val).slice(0, 4);
        setNewPin(next);
        if (next.length === 4) { setSetupStep('CONFIRM'); setConfirmPin(''); }
      } else {
        const next = (confirmPin + val).slice(0, 4);
        setConfirmPin(next);
        if (next.length === 4) void submitSetup(newPin, next);
      }
    } else {
      setPin(prev => (prev + val).slice(0, 4));
    }
  }, [needsPinSetup, setupStep, newPin, confirmPin, isVerifying, submitSetup]);

  const handleDeleteKeyPress = useCallback(() => {
    if (isVerifying) return;
    if (needsPinSetup) {
      if (setupStep === 'NEW') setNewPin(prev => prev.slice(0, -1));
      else setConfirmPin(prev => prev.slice(0, -1));
    } else {
      setPin(prev => prev.slice(0, -1));
    }
    setError(false);
  }, [needsPinSetup, setupStep, isVerifying]);

  const handleHiddenInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value.replace(/[^0-9]/g, '').slice(0, 4);
    setError(false);
    
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
    if (!isLocked || isAddingAccount || isSwapping) return;
    const handleKeyboardInput = (e: KeyboardEvent) => {
      if (document.activeElement?.tagName === 'INPUT' && !isLocked) return;
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
  }, [isLocked, isAddingAccount, isSwapping, handleKeyPress, handleDeleteKeyPress]);

  useEffect(() => {
    if (isLocked && activeCashier && !needsPinSetup && pin.length === 4) {
      setIsVerifying(true);
      unlockTerminal(pin).then(success => {
        if (!success) {
          setError(true);
          setPin('');
          toast({ variant: "destructive", title: "Invalid PIN" });
        } else {
          setPin('');
          setError(false);
        }
        setIsVerifying(false);
      });
    }
  }, [pin, isLocked, activeCashier, needsPinSetup, unlockTerminal]);

  const handleProfileSelect = async (op: Pick<UserProfile, 'uid' | 'email' | 'displayName' | 'photoURL' | 'role'>) => {
    if (isSwapping) return;
    setIsSwapping(true);
    setError(false);
    try {
      const success = await swapIdentity(op as UserProfile);
      if (!success) {
        toast({ variant: "destructive", title: "Identity Handshake Failed", description: "Manual sign-in required for this account." });
      }
    } finally {
      setIsSwapping(false);
    }
  };

  const handleCancelSwitch = () => {
    setIsAddingAccount(false);
    setIsSwapping(false);
    setPin('');
    setNewPin('');
    setConfirmPin('');
    setSetupStep('NEW');
    setError(false);
    clearActiveCashier();
  };

  const handleAction = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (isVerifying) return;
    setIsVerifying(true);
    try {
      const success = await loginAndSwitch(email, password);
      if (success) {
        setIsAddingAccount(false);
        setEmail('');
        setPassword('');
      } else {
        toast({ variant: "destructive", title: "Auth Error" });
      }
    } finally {
      setIsVerifying(false);
    }
  };

  // Only block for physical connectivity loading. 
  // Don't block if we have an auth session but are waiting for the profile selector.
  if (loading || pinLoading) return (
    <div className="fixed inset-0 z-[2000] bg-black flex items-center justify-center">
       <div className="flex flex-col items-center gap-4">
          <Loader2 className="w-10 h-10 text-primary animate-spin" />
          <p className="text-[10px] font-black uppercase text-white tracking-[0.4em]">Synchronizing Station Node...</p>
       </div>
    </div>
  );

  if (pinError) return (
    <div className="min-h-screen flex flex-col items-center justify-center gap-4 p-6 text-center" role="alert">
      <h2 className="text-xl font-bold">Staff PIN setup unavailable</h2>
      <p>{pinError}</p>
      <Button onClick={retryPinStatus}>Retry PIN service</Button>
      <Button variant="outline" onClick={signInAgain}>Sign out and sign in again</Button>
      <p>For a new PIN, sign out and sign in again if your session is older than 15 minutes.</p>
    </div>
  );

  if (isLocked || needsPinSetup || !activeCashier || isAddingAccount) {
    const showSelector = !activeCashier && !isAddingAccount;
    const currentInputVal = needsPinSetup ? (setupStep === 'NEW' ? newPin : confirmPin) : pin;

    return (
      <div className="fixed inset-0 z-[2000] bg-black flex items-center justify-center p-0 overflow-hidden font-sans">
         <Image 
           src={activeCashier ? "/assets/hero4.png" : "/assets/hero3.png"} 
           alt="Cinematic Background" 
           fill 
           className="object-cover brightness-[0.2] saturate-[0.5] transition-all duration-1000" 
           priority 
         />
         
         <Link 
           href="/" 
           className="absolute top-8 left-8 md:top-12 md:left-12 z-[2100] flex items-center gap-3 py-2 px-5 bg-white/5 backdrop-blur-xl rounded-full border border-white/10 text-[10px] font-black uppercase tracking-[0.3em] text-zinc-100 hover:text-white hover:bg-primary/20 hover:border-primary/40 transition-all shadow-2xl active:scale-95"
         >
           <ArrowLeft className="w-4 h-4" />
           <span className="hidden sm:inline">Exit to Home</span>
         </Link>

         {currentTime && (
           <div className="absolute top-8 right-8 md:top-12 md:right-12 z-[2100] text-right animate-in fade-in duration-1000 space-y-2">
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
         
         <div className={cn("w-full relative z-10 p-6 flex flex-1 flex-col items-center", (activeCashier && !isAddingAccount) ? "max-w-5xl" : "max-w-lg")}>
            
            <div className="flex-1 flex flex-col items-center justify-center w-full">
              <div className="mb-8 md:mb-12 animate-in fade-in slide-in-from-top-6 duration-1000 hidden md:block">
                 <div className="bg-white rounded-[2.5rem] p-6 md:p-8 shadow-[0_30px_100px_rgba(0,0,0,0.6)] ring-1 ring-white/10">
                   <img src="/assets/logo.png" className="h-12 w-auto object-contain" alt="Urban Express Logo" />
                 </div>
              </div>

              {isAddingAccount ? (
                 <div className="w-full max-sm bg-black/40 backdrop-blur-2xl p-10 space-y-8 animate-in slide-in-from-bottom-4 rounded-[3rem] border border-white/10 shadow-2xl">
                    <div className="text-center space-y-1">
                      <p className="text-[10px] font-black uppercase tracking-widest text-primary">Staff Login</p>
                      <h2 className="text-xl font-black uppercase text-white tracking-tight">Add New Account</h2>
                    </div>
                    <form onSubmit={handleAction} className="space-y-4">
                       <div className="space-y-3">
                          <Input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="Official Email" className="h-14 bg-white/5 border-white/10 rounded-2xl text-white text-center font-bold focus:bg-white/10 focus:ring-primary/20" required />
                          <Input type="password" value={password} onChange={e => setPassword(e.target.value)} placeholder="Master Password" className="h-14 bg-white/5 border-white/10 rounded-2xl text-white text-center font-bold focus:bg-white/10 focus:ring-primary/20" required />
                       </div>
                       <Button type="submit" disabled={isVerifying} className="w-full h-16 bg-white text-zinc-900 rounded-2xl font-black uppercase text-[11px] tracking-widest active:scale-95 transition-all shadow-xl hover:bg-zinc-100">Sign In</Button>
                       <button type="button" onClick={handleCancelSwitch} className="w-full text-center text-[10px] font-black uppercase text-zinc-500 hover:text-white tracking-[0.2em] pt-4 transition-colors">Cancel</button>
                    </form>
                 </div>
              ) : showSelector ? (
                 <div className="w-full max-w-2xl space-y-8 md:space-y-10 animate-in fade-in duration-700">
                    <div className="text-center space-y-3">
                      <p className="text-[10px] font-black uppercase text-primary tracking-[0.5em] animate-pulse">Switch Account</p>
                      <h2 className="text-3xl md:text-4xl font-black font-headline uppercase text-white tracking-tighter leading-none">Select your profile.</h2>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 max-h-[60vh] md:max-h-none overflow-y-auto no-scrollbar p-2">
                      {recentOperators.map(op => (
                        <button 
                          key={op.uid} 
                          type="button"
                          onClick={() => handleProfileSelect(op)} 
                          disabled={isSwapping}
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
                          {isSwapping ? (
                            <Loader2 className="w-5 h-5 text-primary animate-spin" />
                          ) : (
                            <ChevronRight className="w-4 h-4 md:w-5 md:h-5 text-zinc-700 group-hover:text-primary transition-all group-hover:translate-x-1 shrink-0 ml-2" />
                          )}
                        </button>
                      ))}
                      <Button 
                        type="button"
                        onClick={() => setIsAddingAccount(true)} 
                        disabled={isSwapping}
                        className="w-full h-auto p-5 md:p-6 bg-white/5 backdrop-blur-md text-white hover:bg-white/10 border border-white/10 hover:border-white/20 rounded-[1.5rem] md:rounded-[2rem] font-black uppercase text-[10px] md:text-[11px] tracking-widest transition-all shadow-xl min-h-[70px] md:min-h-[86px]"
                      >
                        Add New Account
                      </Button>
                    </div>
                 </div>
              ) : (
                <div className="w-full flex flex-col md:flex-row gap-8 md:gap-20 items-center justify-center animate-in fade-in duration-700 mt-4 md:mt-0">
                   <div className="space-y-6 md:space-y-8 text-center md:text-left flex-1 max-lg">
                      <div className="inline-flex items-center gap-5 md:gap-6 bg-black/20 backdrop-blur-xl p-3 md:p-4 pr-8 md:pr-10 rounded-[2rem] md:rounded-[2.5rem] border border-white/5 shadow-2xl mx-auto md:mx-0">
                         <Avatar className="h-16 w-16 md:h-24 md:w-24 rounded-[1.5rem] md:rounded-[2rem] ring-4 ring-primary/20 shadow-2xl border-2 border-white/10 shrink-0">
                            <AvatarImage src={activeCashier?.photoURL || undefined} className="object-cover" />
                            <AvatarFallback className="bg-zinc-900 text-primary text-xl md:text-2xl font-black uppercase border border-white/5">{activeCashier?.displayName?.[0]}</AvatarFallback>
                         </Avatar>
                         <div className="text-left space-y-1 md:space-y-2 min-w-0">
                            <p className="text-[9px] md:text-[10px] font-black text-primary uppercase tracking-[0.4em]">Logged in as</p>
                            <h2 className="text-2xl md:text-3xl font-black uppercase text-white tracking-tighter leading-none truncate">{activeCashier?.displayName}</h2>
                            <Badge className="bg-white/10 text-white border-none text-[8px] md:text-[9px] font-black uppercase px-3 py-1 shadow-sm">{activeCashier?.role}</Badge>
                         </div>
                      </div>
                      <div className="space-y-2 md:space-y-3">
                         <h2 className="text-4xl md:text-8xl font-black font-headline uppercase text-white tracking-tighter leading-none">
                           {needsPinSetup ? "Set your PIN." : "Enter your PIN."}
                         </h2>
                         <p className="text-[10px] md:text-[11px] font-black text-zinc-500 uppercase tracking-[0.6em]">{needsPinSetup ? "One-time security update: create a new four-digit PIN. Your old PIN is not required." : "Secure Staff Access"}</p>
                      </div>
                      <button type="button" onClick={handleCancelSwitch} className="text-zinc-500 hover:text-white uppercase font-black text-[9px] md:text-[11px] tracking-[0.4em] h-10 md:h-12 px-8 md:px-10 rounded-xl md:rounded-2xl border border-white/10 bg-white/5 backdrop-blur-xl transition-all active:scale-95 hover:bg-primary/10 hover:border-primary/20">Switch account</button>
                   </div>

                   <div className="flex flex-col items-center flex-1 max-w-[320px] md:max-w-[360px] w-full">
                      <div 
                        onClick={focusInput}
                        className="w-full bg-black/20 backdrop-blur-3xl p-8 md:p-10 rounded-[2.5rem] md:rounded-[3rem] border border-white/5 shadow-[0_50px_100px_rgba(0,0,0,0.5)] relative cursor-text"
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
                                 <div className="flex items-center gap-2 text-red-500 animate-pulse">
                                    <AlertTriangle className="w-3 h-3" />
                                    <span className="text-[9px] font-black uppercase tracking-widest">Unauthorized Entry</span>
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

                      {needsPinSetup && (
                         <div className="mt-6 md:mt-8 px-5 py-3 md:px-6 md:py-4 bg-primary/10 backdrop-blur-xl border border-primary/20 rounded-2xl text-center animate-pulse">
                            <p className="text-[9px] md:text-[10px] font-black text-primary uppercase tracking-widest">Step: {setupStep === 'NEW' ? 'Enter a New 4-Digit PIN' : 'Repeat PIN to Confirm'}</p>
                            <button type="button" onClick={signInAgain} className="underline text-sm mt-3">Sign out and sign in again</button>
                         </div>
                      )}
                   </div>
                </div>
              )}
            </div>
            
            <div className="py-8 md:py-12 text-[7px] md:text-[9px] font-black text-white/10 uppercase tracking-[1em] select-none text-center shrink-0">Urban Express Business OS v2.5</div>
         </div>
      </div>
    );
  }
  return <>{children}</>;
}
