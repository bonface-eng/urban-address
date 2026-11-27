'use client';

import React, { createContext, useContext, useMemo } from 'react';
import type { SupabaseClient } from '@supabase/supabase-js';
import { getSupabaseBrowserClient } from '@/lib/supabase/client';
import { getAuth } from '@/lib/db';
import { DataErrorListener } from '@/components/DataErrorListener';

interface SupabaseContextType {
  /** Browser Supabase client used for data access (RLS-enforced). */
  db: SupabaseClient | null;
  /** Same browser client; exposes `.auth` for the auth helpers in `@/lib/db`. */
  auth: ReturnType<typeof getAuth> | null;
}

const SupabaseContext = createContext<SupabaseContextType>({ db: null, auth: null });

/**
 * Creates the browser client once on the client side and exposes it through
 * context. During SSR it provides nulls (consumers already guard on that).
 */
export function SupabaseClientProvider({ children }: { children: React.ReactNode }) {
  const services = useMemo<SupabaseContextType>(() => {
    if (typeof window === 'undefined') return { db: null, auth: null };
    const client = getSupabaseBrowserClient();
    return { db: client, auth: getAuth(client) };
  }, []);

  return (
    <SupabaseContext.Provider value={services}>
      <DataErrorListener />
      {children}
    </SupabaseContext.Provider>
  );
}

export function useSupabase() {
  return useContext(SupabaseContext);
}

export function useDb() {
  return useSupabase().db;
}

export function useAuth() {
  return useSupabase().auth;
}
