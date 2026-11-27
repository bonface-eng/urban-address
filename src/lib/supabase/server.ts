import { createServerClient } from '@supabase/ssr';
import type { SupabaseClient } from '@supabase/supabase-js';
import { cookies } from 'next/headers';
import { SUPABASE_URL, SUPABASE_ANON_KEY } from './config';
import { getSupabaseAdminClient, getSupabaseServiceRoleClient } from './admin';

/**
 * Cookie-based Supabase server client for Next.js App Router Server Components,
 * Server Actions, and Route Handlers.
 */
export async function createSupabaseServerClient(): Promise<SupabaseClient> {
  const cookieStore = await cookies();

  return createServerClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          cookiesToSet.forEach(({ name, value, options }) =>
            cookieStore.set(name, value, options)
          );
        } catch {
          // Called from a Server Component where setting cookies is a no-op;
          // middleware handles session refresh.
        }
      },
    },
  });
}

export { getSupabaseAdminClient, getSupabaseServiceRoleClient };
