'use client';

import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import { useFirestore, useUser, useAuth } from '@/firebase';
import { doc, getDoc, setDoc, updateDoc, collection, query, where, addDoc, onSnapshot } from 'firebase/firestore';
import { signInWithEmailAndPassword, signOut, GoogleAuthProvider, signInWithPopup } from 'firebase/auth';
import { POSTerminal, RegisterSession, UserProfile, BusinessUnit } from '@/lib/types';
import { toast } from '@/hooks/use-toast';
import { SYSTEM_CONFIG } from '@/lib/config';

interface TerminalContextType {
  pinLoading: boolean;
  pinEnrolled: boolean;
  pinError: string;
  retryPinStatus: () => void;
  enrollPin: (pin: string, confirmation: string) => Promise<void>;
  activeTerminal: POSTerminal | null;
  activeCashier: UserProfile | null;
  activeRegisterSession: RegisterSession | null;
  loading: boolean;
  lockTerminal: () => void;
  unlockTerminal: (pin: string) => Promise<boolean>;
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
  const [pinIdentity, setPinIdentity] = useState('');
  const [pinLoadingState, setPinLoading] = useState(true);
  const [pinEnrolled, setPinEnrolled] = useState(false);
  const [pinError, setPinError] = useState('');
  const [pinRetry, setPinRetry] = useState(0);
  const pinLoading = pinLoadingState || pinIdentity !== (user?.uid || '');
  const identityRef = useRef(user?.uid);
  identityRef.current = user?.uid;

  const pinRequest = useCallback(async (body: Record<string, unknown>) => {
    const currentUser = auth?.currentUser;
    if (!currentUser) throw new Error('Sign in with your staff account first.');
    const uid = currentUser.uid;
    const token = await currentUser.getIdToken();
    const response = await fetch('/api/staff-pin', {
      method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      cache: 'no-store', signal: AbortSignal.timeout(15000), body: JSON.stringify(body),
    });
    const data = await response.json();
    if (identityRef.current !== uid) throw new Error('The active account changed. Please retry.');
    if (!response.ok || data.success === false) throw new Error(data.error || 'PIN service unavailable.');
    return data;
  }, [auth]);

  useEffect(() => {
    let cancelled = false;
    const uid = user?.uid || '';
    setIsLocked(true);
    setPinLoading(true);
    setPinEnrolled(false);
    setPinError('');
    if (!user) {
      setPinIdentity(''); setPinLoading(false);
      return;
    }
    pinRequest({ action: 'status' }).then(data => {
      if (!cancelled) { setPinEnrolled(data.enrolled === true); setPinIdentity(uid); }
    }).catch(error => {
      if (!cancelled) { setPinError(error.message); setPinIdentity(uid); }
    }).finally(() => { if (!cancelled) setPinLoading(false); });
    return () => { cancelled = true; };
  }, [user?.uid, pinRetry, pinRequest]);

  const retryPinStatus = useCallback(() => setPinRetry(value => value + 1), []);
  const enrollPin = useCallback(async (pin: string, confirmPin: string) => {
    try {
      await pinRequest({ action: 'enroll', pin, confirmPin });
      setPinEnrolled(true);
      setPinError('');
      localStorage.setItem('uax_last_unlocked_at', Date.now().toString());
      setIsLocked(false);
    } catch (error) {
      retryPinStatus();
      throw error;
    }
  }, [pinRequest, retryPinStatus]);

  const [isLocationAuthorized, setIsLocationAuthorized] = useState(true);
  const [locationName, setLocationName] = useState('Remote Node');
  const [clientIp, setClientIp] = useState('0.0.0.0');
  const [loading, setLoading] = useState(true);
  
  const watchId = useRef<number | null>(null);
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
          fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${latitude}&lon=${longitude}&zoom=14`)
            .then(res => res.json())
            .then(data => {
              const area = data.address?.suburb || data.address?.neighbourhood || data.address?.town || data.address?.city || 'External';
              setLocationName(area);
            })
            .catch(() => setLocationName('Remote Node'));
        }
      },
      (error) => {
        setIsLocationAuthorized(true); 
        setLocationName('Offline Signal');
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
    if (typeof window === 'undefined') return;
    const checkTimeout = () => {
      const lastUnlockedStr = localStorage.getItem('uax_last_unlocked_at');
      if (lastUnlockedStr && !isLocked) {
        const elapsed = Date.now() - parseInt(lastUnlockedStr, 10);
        const fifteenMinutes = 15 * 60 * 1000;
        if (elapsed >= fifteenMinutes) {
          localStorage.removeItem('uax_last_unlocked_at');
          setIsLocked(true);
        }
      }
    };

    const interval = setInterval(checkTimeout, 15000);
    return () => clearInterval(interval);
  }, [isLocked]);

  useEffect(() => {
    setActiveCashier(null);
    setLoading(true);
    if (!firestore || !user) {
      setLoading(false);
      return;
    }

    let unsubscribeProfile: (() => void) | undefined;

    const init = async () => {
      let terminalId = localStorage.getItem('uax_terminal_id');
      
      unsubscribeProfile = onSnapshot(doc(firestore, 'users', user.uid), (uSnap) => {
        if (uSnap.exists()) {
          setActiveCashier({ ...uSnap.data(), uid: uSnap.id } as UserProfile);
        }
        // Ensure loading finishes after first profile resolution attempt
        setLoading(false);
      }, (err) => {
        setLoading(false);
      });

      if (!terminalId) return;

      try {
        const termDoc = await getDoc(doc(firestore, 'pos_terminals', terminalId));
        if (termDoc.exists()) {
          const data = termDoc.data() as POSTerminal;
          setActiveTerminal({ ...data, id: termDoc.id });

          if (data.currentRegisterSessionId) {
            const regDoc = await getDoc(doc(firestore, 'register_sessions', data.currentRegisterSessionId));
            if (regDoc.exists()) {
              setActiveRegisterSession({ ...regDoc.data(), id: regDoc.id } as RegisterSession);
            }
          }
        }
      } catch (err) {
        console.error('Terminal Init Error:', err);
      }
    };

    init();
    return () => { if (unsubscribeProfile) unsubscribeProfile(); };
  }, [firestore, user]);

  const lockTerminal = useCallback(() => {
    if (typeof window !== 'undefined') {
      localStorage.setItem('uax_last_unlocked_at', '0'); // Force timeout
    }
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
        const newUser = { ...uDoc.data(), uid: uDoc.id } as UserProfile;
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
        const profileData = uDoc.data() as UserProfile;
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
    if (!auth || !firestore) return false;
    
    // Check if already signed in as this user
    if (auth.currentUser?.email?.toLowerCase() === targetUser.email.toLowerCase()) {
      setIsLocked(true);
      return true;
    }
    
    // Never reuse another staff member's cached password to switch identities.
    toast({ title: "Sign in required", description: "Use Add New Account to sign in with that staff account." });
    return false;
  }, [auth, firestore]);

  const unlockTerminal = useCallback(async (pin: string): Promise<boolean> => {
    if (pinLoading || !pinEnrolled || !activeCashier || activeCashier.uid !== user?.uid || !/^\d{4}$/.test(pin)) return false;
    try {
      await pinRequest({ action: 'verify', pin });
      localStorage.setItem('uax_last_unlocked_at', Date.now().toString());
      setPinError('');
      setIsLocked(false);
      return true;
    } catch (error) {
      toast({ variant: "destructive", title: "PIN verification failed", description: error instanceof Error ? error.message : "Please retry." });
      return false;
    }
  }, [pinLoading, pinEnrolled, activeCashier, user?.uid, pinRequest]);

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
    setIsLocked(false);
  };

  const closeRegister = async (closingCash: number) => {
    if (!firestore || !activeTerminal || !activeRegisterSession) return;
    await updateDoc(doc(firestore, 'register_sessions', activeRegisterSession.id!), { closedAt: Date.now(), closingCash, status: 'CLOSED' });
    await updateDoc(doc(firestore, 'pos_terminals', activeTerminal.id), { status: 'CLOSED', currentCashierId: null, currentRegisterSessionId: null });
    setActiveTerminal(prev => prev ? { ...prev, status: 'CLOSED', currentCashierId: null, currentRegisterSessionId: null } : null);
    setActiveRegisterSession(null);
    setIsLocked(true);
  };

  const value = {
    pinLoading, pinEnrolled, pinError, retryPinStatus, enrollPin, activeTerminal, activeCashier, activeRegisterSession, loading, lockTerminal, unlockTerminal, setIsLocked, openRegister, closeRegister, swapIdentity, loginAndSwitch, loginWithGoogle, clearActiveCashier, refreshLocation, isLocked, isLocationAuthorized, locationName, clientIp
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
