import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY } from './config';
import { validateServerSupabaseEnv } from '@/lib/env';

let adminClient: SupabaseClient | null = null;

/**
 * Server-only Supabase Admin client using SUPABASE_SERVICE_ROLE_KEY.
 * Bypasses RLS — never import or execute in Client Components.
 */
export function getSupabaseAdminClient(): SupabaseClient {
  if (typeof window !== 'undefined') {
    throw new Error('[SUPABASE_ADMIN] Service role client cannot be used in the browser.');
  }
  if (adminClient) return adminClient;

  if (!process.env.VITEST) {
    validateServerSupabaseEnv();
  }

  const serviceKey = SUPABASE_SERVICE_ROLE_KEY;
  if (!serviceKey && !process.env.VITEST) {
    throw new Error('[SUPABASE_ADMIN] Missing SUPABASE_SERVICE_ROLE_KEY.');
  }

  adminClient = createClient(SUPABASE_URL, serviceKey || 'vitest-placeholder-service-key', {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });
  return adminClient;
}

export const getSupabaseServiceRoleClient = getSupabaseAdminClient;
