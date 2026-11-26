'use client';

import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import { useFirestore, useUser, useAuth } from '@/firebase';
import { doc, getDoc, setDoc, updateDoc, collection, query, where, addDoc, onSnapshot } from 'firebase/firestore';
import { signInWithEmailAndPassword, signInWithCustomToken, signOut, GoogleAuthProvider, signInWithPopup } from 'firebase/auth';
import { POSTerminal, RegisterSession, UserProfile, BusinessUnit } from '@/lib/types';
import { toast } from '@/hooks/use-toast';
import { SYSTEM_CONFIG } from '@/lib/config';

interface TerminalContextType {
  activeTerminal: POSTerminal | null;
  activeCashier: UserProfile | null;
  activeRegisterSession: RegisterSession | null;
  loading: boolean;
  lockTerminal: () => void;
  switchWithPin: (targetUid: string, pin: string, deviceId: string) => Promise<boolean>;
  setIsLocked: (locked: boolean) => void;
  openRegister: (openingCash: number, unit: BusinessUnit) => Promise<void>;
  closeRegister: (closingCash: number) => Promise<void>;
  swapIdentity: (targetUser: UserProfile) => Promise<boolean>;
  loginAndSwitch: (email: string, pass: string) => Promise<boolean>;
  loginWithGoogle: () => Promise<boolean>;
  clearActiveCashier: () => void;
  refreshLocation: () => void;
  isLocked: boolean;
  isLocationAuthorized: boolean;
  locationName: string;
  clientIp: string;
}

const TerminalContext = createContext<TerminalContextType | undefined>(undefined);

export function TerminalProvider({ children }: { children: React.ReactNode }) {
  const firestore = useFirestore();
  const auth = useAuth();
  const { user } = useUser();
  const [activeTerminal, setActiveTerminal] = useState<POSTerminal | null>(null);
  const [activeCashier, setActiveCashier] = useState<UserProfile | null>(null);
  const [activeRegisterSession, setActiveRegisterSession] = useState<RegisterSession | null>(null);
  const [isLocked, setIsLocked] = useState(true);
  
  const [isLocationAuthorized, setIsLocationAuthorized] = useState(true);
  const [locationName, setLocationName] = useState('Remote Node');
  const [clientIp, setClientIp] = useState('0.0.0.0');
  const [loading, setLoading] = useState(true);
  
  const watchId = useRef<number | null>(null);
  const lastUnlockedAt = useRef<number | null>(null);
  const lastGeocodeTime = useRef<number>(0);

  const refreshLocation = useCallback(() => {
    if (typeof window === 'undefined') return;
    if (!navigator.geolocation) {
      setLocationName('Location Unavailable');
      return;
    }

    if (watchId.current !== null) {
      navigator.geolocation.clearWatch(watchId.current);
    }

    setLocationName('Acquiring Signal...');

    watchId.current = navigator.geolocation.watchPosition(
      (position) => {
        const { latitude, longitude } = position.coords;
        setIsLocationAuthorized(true);
        
        const now = Date.now();
        if (now - lastGeocodeTime.current > 30000) {
          lastGeocodeTime.current = now;
          fetch(`/api/maps/geocode?lat=${latitude}&lon=${longitude}`)
            .then(res => res.json())
            .then(data => {
              const area = data.address?.suburb || data.address?.neighbourhood || data.address?.town || data.address?.city || 'External';
              setLocationName(area);
            })
            .catch(() => setLocationName('Remote Node'));
        }
      },
      (error) => {
        setIsLocationAuthorized(false);
        setLocationName(error.code === 1 ? 'Location Permission Denied' : 'Offline Signal');
      },
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 30000 }
    );
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    
    const fetchIp = async () => {
      try {
        const res = await fetch('https://api.ipify.org?format=json');
        const data = await res.json();
        setClientIp(data.ip);
      } catch (err) {
        setClientIp('0.0.0.0');
      }
    };

    fetchIp();
    refreshLocation();

    return () => {
      if (watchId.current !== null) {
        navigator.geolocation.clearWatch(watchId.current);
      }
    };
  }, [refreshLocation]);

  useEffect(() => {
    const checkTimeout = () => {
      const unlockedAt = lastUnlockedAt.current;
      if (unlockedAt !== null && !isLocked && Date.now() - unlockedAt >= 15 * 60 * 1000) {
        lastUnlockedAt.current = null;
        setIsLocked(true);
      }
    };
    const interval = setInterval(checkTimeout, 15000);
    return () => clearInterval(interval);
  }, [isLocked]);

  useEffect(() => {
    if (!firestore || !user) {
      setLoading(false);
      return;
    }

    let unsubscribeProfile: (() => void) | undefined;
    let unsubscribeTerminal: (() => void) | undefined;
    let unsubscribeRegister: (() => void) | undefined;
    let currentRegisterSessionId: string | null = null;

    const terminalId = localStorage.getItem('uax_terminal_id');
    setActiveTerminal(null);
    setActiveRegisterSession(null);

    unsubscribeProfile = onSnapshot(doc(firestore, 'users', user.uid), (uSnap) => {
      if (uSnap.exists()) {
        const safeProfile = { ...uSnap.data() };
        delete safeProfile.masterKey;
        delete safeProfile.pin;
        setActiveCashier({ ...safeProfile, uid: uSnap.id } as UserProfile);
      } else {
        setActiveCashier(null);
      }
      setLoading(false);
    }, (err) => {
      console.error('[TERMINAL] Cashier profile subscription failed:', err);
      setLoading(false);
    });

    if (terminalId) {
      unsubscribeTerminal = onSnapshot(doc(firestore, 'pos_terminals', terminalId), (terminalSnap) => {
        if (!terminalSnap.exists()) {
          setActiveTerminal(null);
          setActiveRegisterSession(null);
          currentRegisterSessionId = null;
          unsubscribeRegister?.();
          unsubscribeRegister = undefined;
          return;
        }

        const terminal = { ...terminalSnap.data(), id: terminalSnap.id } as POSTerminal & { disabled?: boolean; locked?: boolean; forceLockAt?: number };
        setActiveTerminal(terminal);

        // Remote Telegram station locks and cashier-session closures are enforced
        // through the live terminal document, not only at the next PIN attempt.
        if (terminal.disabled === true || terminal.locked === true) {
          lastUnlockedAt.current = null;
          setIsLocked(true);
        }
        if (terminal.currentCashierId !== undefined && terminal.currentCashierId !== user.uid) {
          lastUnlockedAt.current = null;
          setActiveCashier(null);
          setIsLocked(true);
        }

        const nextSessionId = terminal.currentRegisterSessionId || null;
        if (nextSessionId === currentRegisterSessionId) return;

        unsubscribeRegister?.();
        unsubscribeRegister = undefined;
        currentRegisterSessionId = nextSessionId;
        setActiveRegisterSession(null);

        if (nextSessionId) {
          unsubscribeRegister = onSnapshot(doc(firestore, 'register_sessions', nextSessionId), (registerSnap) => {
            setActiveRegisterSession(registerSnap.exists()
              ? { ...registerSnap.data(), id: registerSnap.id } as RegisterSession
              : null);
          }, (error) => {
            console.error('[TERMINAL] Register session subscription failed:', error);
            setActiveRegisterSession(null);
          });
        }
      }, (error) => {
        console.error('[TERMINAL] Terminal subscription failed:', error);
        setActiveTerminal(null);
        setActiveRegisterSession(null);
      });
    }

    return () => {
      unsubscribeProfile?.();
      unsubscribeTerminal?.();
      unsubscribeRegister?.();
    };
  }, [firestore, user]);

  const lockTerminal = useCallback(() => {
    lastUnlockedAt.current = null;
    setIsLocked(true);
    toast({ title: "Station Locked" });
  }, []);

  const clearActiveCashier = useCallback(() => {
    setActiveCashier(null);
    setIsLocked(true);
  }, []);

  const loginAndSwitch = useCallback(async (email: string, pass: string): Promise<boolean> => {
    if (!auth || !firestore) return false;
    try {
      const cred = await signInWithEmailAndPassword(auth, email.toLowerCase().trim(), pass);
      const userRef = doc(firestore, 'users', cred.user.uid);
      const uDoc = await getDoc(userRef);
      
      if (uDoc.exists()) {
        const safeProfile = { ...uDoc.data() };
        delete safeProfile.masterKey;
        delete safeProfile.pin;
        const newUser = { ...safeProfile, uid: uDoc.id } as UserProfile;
        if (!newUser.role || newUser.role === 'CLIENT') {
          setActiveCashier(null);
          setIsLocked(true);
          await signOut(auth);
          toast({ variant: "destructive", title: "Staff access required", description: "Customer accounts cannot enter the staff terminal." });
          return false;
        }
        setActiveCashier(newUser);
        setIsLocked(true); 
        
        if (activeTerminal) {
          await updateDoc(doc(firestore, 'pos_terminals', activeTerminal.id), {
            currentCashierId: newUser.uid,
            lastActive: Date.now()
          });
        }
        
        toast({ title: "Authorized", description: `Welcome back, ${newUser.displayName}` });
        return true;
      }
      setActiveCashier(null);
      setIsLocked(true);
      await signOut(auth);
      toast({ variant: "destructive", title: "Staff profile unavailable", description: "This account is not configured for staff terminal access." });
      return false;
    } catch (err: any) {
      if (err.code === 'auth/quota-exceeded') {
        toast({ variant: "destructive", title: "Security Rate Limit", description: "Too many login attempts. Please wait or use a different node." });
      }
      return false;
    }
  }, [auth, firestore, activeTerminal]);

  const loginWithGoogle = useCallback(async (): Promise<boolean> => {
    if (!auth || !firestore) return false;
    try {
      const provider = new GoogleAuthProvider();
      const result = await signInWithPopup(auth, provider);
      
      const userRef = doc(firestore, 'users', result.user.uid);
      const uDoc = await getDoc(userRef);
      
      if (uDoc.exists()) {
        const safeProfile = { ...uDoc.data() };
        delete safeProfile.masterKey;
        delete safeProfile.pin;
        const profileData = safeProfile as UserProfile;
        if (profileData.role === 'CLIENT') {
          toast({ variant: "destructive", title: "Access Denied", description: "Standard accounts not authorized for node entry." });
          return false;
        }

        setActiveCashier({ ...profileData, uid: uDoc.id });
        setIsLocked(true); 
        
        if (activeTerminal) {
          await updateDoc(doc(firestore, 'pos_terminals', activeTerminal.id), {
            currentCashierId: uDoc.id,
            lastActive: Date.now()
          });
        }
        
        toast({ title: "Authorized", description: `Operator: ${profileData.displayName}` });
        return true;
      } else {
        toast({ variant: "destructive", title: "Identity Error", description: "Profile not found." });
        return false;
      }
    } catch (err: any) {
      return false;
    }
  }, [auth, firestore, activeTerminal]);

  const swapIdentity = useCallback(async (targetUser: UserProfile): Promise<boolean> => {
    if (!auth?.currentUser || !targetUser?.uid) return false;

    // Never retrieve or reuse a stored Firebase password. Switching Firebase
    // identities requires the operator to authenticate with their own
    // credentials through loginAndSwitch.
    if (auth.currentUser.uid === targetUser.uid) {
      setIsLocked(true);
      return true;
    }

    toast({
      variant: "destructive",
      title: "Re-authentication required",
      description: "Enter this operator's own email and password to switch accounts.",
    });
    return false;
  }, [auth]);

  const switchWithPin = useCallback(async (targetUid: string, pin: string, deviceId: string): Promise<boolean> => {
    if (!auth || !firestore || !auth.currentUser || !targetUid || !deviceId) return false;
    try {
      const idToken = await auth.currentUser.getIdToken();
      const response = await fetch('/api/terminal/pin', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${idToken}` },
        body: JSON.stringify({ action: 'verify-pin', targetUid, deviceId, pin }),
      });
      const payload = await response.json();
      if (!response.ok || typeof payload.customToken !== 'string') return false;

      const credential = await signInWithCustomToken(auth, payload.customToken);
      const profileSnap = await getDoc(doc(firestore, 'users', credential.user.uid));
      if (!profileSnap.exists()) {
        await signOut(auth);
        return false;
      }
      const profile = { ...profileSnap.data() };
      delete profile.masterKey;
      delete profile.pin;
      const safeProfile = { ...profile, uid: profileSnap.id } as UserProfile;
      if (!safeProfile.role || safeProfile.role === 'CLIENT') {
        await signOut(auth);
        setActiveCashier(null);
        setIsLocked(true);
        return false;
      }
      setActiveCashier(safeProfile);
      if (activeTerminal) {
        await updateDoc(doc(firestore, 'pos_terminals', activeTerminal.id), {
          currentCashierId: safeProfile.uid,
          lastActive: Date.now(),
        }).catch(error => console.error('[TERMINAL] Could not update active operator:', error));
      }
      lastUnlockedAt.current = Date.now();
      setIsLocked(false);
      return true;
    } catch (error) {
      console.error('[TERMINAL] PIN identity switch failed:', error);
      return false;
    }
  }, [auth, firestore, activeTerminal]);

  const openRegister = async (openingCash: number, unit: BusinessUnit) => {
    if (!firestore || !user) return;
    const terminalId = activeTerminal?.id || `TERM-${Math.random().toString(36).substring(7).toUpperCase()}`;
    const regSession: RegisterSession = {
      terminalId,
      openedAt: Date.now(),
      openingCash,
      status: 'OPEN',
      managerId: user.uid
    };
    const regRef = await addDoc(collection(firestore, 'register_sessions'), regSession);
    const terminalData: POSTerminal = {
      id: terminalId,
      name: `${unit} Station`,
      unit,
      status: 'OPEN',
      currentCashierId: user.uid,
      currentRegisterSessionId: regRef.id,
      lastActive: Date.now()
    };
    await setDoc(doc(firestore, 'pos_terminals', terminalId), terminalData);
    localStorage.setItem('uax_terminal_id', terminalId);
    setActiveTerminal(terminalData);
    setActiveRegisterSession({ ...regSession, id: regRef.id });
    lastUnlockedAt.current = Date.now();
    setIsLocked(false);
  };

  const closeRegister = async (closingCash: number) => {
    if (!firestore || !activeTerminal || !activeRegisterSession) return;
    await updateDoc(doc(firestore, 'register_sessions', activeRegisterSession.id!), { closedAt: Date.now(), closingCash, status: 'CLOSED' });
    await updateDoc(doc(firestore, 'pos_terminals', activeTerminal.id), { status: 'CLOSED', currentCashierId: null, currentRegisterSessionId: null });
    setActiveTerminal(prev => prev ? { ...prev, status: 'CLOSED', currentCashierId: null, currentRegisterSessionId: null } : null);
    setActiveRegisterSession(null);
    lastUnlockedAt.current = null;
    setIsLocked(true);
  };

  const setTerminalLocked = useCallback((locked: boolean) => {
    lastUnlockedAt.current = locked ? null : Date.now();
    setIsLocked(locked);
  }, []);

  const value = {
    activeTerminal, activeCashier, activeRegisterSession, loading, lockTerminal, switchWithPin, setIsLocked: setTerminalLocked, openRegister, closeRegister, swapIdentity, loginAndSwitch, loginWithGoogle, clearActiveCashier, refreshLocation, isLocked, isLocationAuthorized, locationName, clientIp
  };

  return <TerminalContext.Provider value={value}>{children}</TerminalContext.Provider>;
}

export function useTerminal() {
  const context = useContext(TerminalContext);
  if (context === undefined) {
    throw new Error('useTerminal must be used within a TerminalProvider');
  }
  return context;
}
