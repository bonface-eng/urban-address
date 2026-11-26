'use client';

import React, { useMemo } from 'react';
import { initializeApp, getApps, getApp, FirebaseApp } from 'firebase/app';
import { getFirestore, Firestore } from 'firebase/firestore';
import { getAuth, Auth } from 'firebase/auth';
import { firebaseConfig } from './config';
import { FirebaseProvider } from './provider';

// Singleton instances to survive across hot-reloads and provider re-mounts
let appInstance: FirebaseApp | null = null;
let firestoreInstance: Firestore | null = null;
let authInstance: Auth | null = null;

/**
 * FirebaseClientProvider
 * Ensures Firebase services are only initialized once on the client side
 * and provides them to the context via a stable singleton pattern.
 */
export function FirebaseClientProvider({ children }: { children: React.ReactNode }) {
  const services = useMemo(() => {
    if (typeof window === 'undefined') {
      return { firebaseApp: null, firestore: null, auth: null };
    }

    if (!appInstance) {
      appInstance = getApps().length > 0 ? getApp() : initializeApp(firebaseConfig);
      firestoreInstance = getFirestore(appInstance);
      authInstance = getAuth(appInstance);
    }
    
    return { 
      firebaseApp: appInstance, 
      firestore: firestoreInstance, 
      auth: authInstance 
    };
  }, []);

  return (
    <FirebaseProvider 
      firebaseApp={services.firebaseApp} 
      firestore={services.firestore} 
      auth={services.auth}
    >
      {children}
    </FirebaseProvider>
  );
}
