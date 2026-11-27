'use client';

import React, { createContext, useContext, useMemo, useState, useEffect } from 'react';
import { doc } from 'firebase/firestore';
import { useFirestore, useUser, useDoc } from '@/firebase';
import { UserProfile, UserRole } from '@/lib/types';
import { ROOT_ADMIN_EMAILS } from '@/lib/admin-identity';

interface ProfileContextType {
  profile: UserProfile | null;
  loading: boolean;
  role: UserRole | null;
  isEmployee: boolean;
  isSuperAdmin: boolean;
  /** True when the signed-in user holds the KITCHEN role (KDS access). */
  isKitchen: boolean;
}

const ProfileContext = createContext<ProfileContextType | undefined>(undefined);

/**
 * ProfileProvider
 * Centralized identity and session management.
 * Provides synchronized access to the logged-in user's profile and system role.
 */
export function ProfileProvider({ children }: { children: React.ReactNode }) {
  const { user, loading: authLoading } = useUser();
  const firestore = useFirestore();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const userDocRef = useMemo(() => {
    if (!firestore || !user?.uid) return null;
    return doc(firestore, 'users', user.uid);
  }, [firestore, user?.uid]);

  const adminDocRef = useMemo(() => {
    if (!firestore || !user?.email) return null;
    const email = user.email.toLowerCase().trim();
    // Root accounts already have the same eligibility independently of this registry.
    // Avoid a protected lookup on every page for an answer we already know.
    if (ROOT_ADMIN_EMAILS.includes(email)) return null;
    return doc(firestore, 'admins', email);
  }, [firestore, user?.email]);

  const { data: firestoreProfile, loading: profileLoading } = useDoc<UserProfile>(userDocRef);
  const { data: adminWhitelist, loading: adminLoading } = useDoc<any>(adminDocRef);

  // Identity Resolution Logic (Root Whitelist)
  const envStatus = useMemo(() => {
    if (!user?.email) return null;
    const email = user.email.toLowerCase().trim();
    
    if (ROOT_ADMIN_EMAILS.includes(email)) return { role: 'ADMIN' as UserRole };
    return null;
  }, [user?.email]);

  // Master Admin Bypass: True if root email OR in /admins collection OR profile role is ADMIN
  const isSuperAdmin = useMemo(() => 
    envStatus?.role === 'ADMIN' || 
    !!adminWhitelist ||
    firestoreProfile?.role === 'ADMIN', 
  [envStatus, adminWhitelist, firestoreProfile]);

  // Employee Guard: True if any staff role is detected or Super Admin
  const isEmployee = useMemo(() => 
    isSuperAdmin ||
    (firestoreProfile?.role && firestoreProfile.role !== 'CLIENT' && firestoreProfile.role !== undefined), 
  [isSuperAdmin, firestoreProfile]);

  /**
   * Final Role Name Resolution
   */
  const resolvedRole = useMemo(() => {
    if (!user) return null;
    if (isSuperAdmin) return 'ADMIN';
    if (firestoreProfile?.role) return firestoreProfile.role;
    return authLoading ? null : 'CLIENT';
  }, [user, firestoreProfile, isSuperAdmin, authLoading]);

  // Kitchen Guard: True when role is explicitly KITCHEN (KDS-only access)
  const isKitchen = useMemo(() =>
    firestoreProfile?.role === 'KITCHEN' && !isSuperAdmin,
  [firestoreProfile, isSuperAdmin]);

  const value = useMemo(() => ({
    profile: firestoreProfile || null,
    loading: authLoading || profileLoading || adminLoading || !mounted,
    role: resolvedRole,
    isEmployee,
    isSuperAdmin,
    isKitchen
  }), [firestoreProfile, authLoading, profileLoading, adminLoading, mounted, resolvedRole, isEmployee, isSuperAdmin, isKitchen]);

  return React.createElement(ProfileContext.Provider, { value }, children);
}

/**
 * useProfile Hook
 * Consumes the global identity context.
 */
export function useProfile() {
  const context = useContext(ProfileContext);
  if (context === undefined) {
    throw new Error('useProfile must be used within a ProfileProvider');
  }
  return context;
}
