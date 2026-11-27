/**
 * src/lib/db/index.ts
 *
 * Unified Data Access Layer barrel export for Urban Auto Express (Supabase).
 */

export * from './table-map';
export * from './query-client';
export * from './auth-client';
export {
  getSupabaseBrowserClient,
} from '@/lib/supabase/client';
export {
  SUPABASE_URL,
  SUPABASE_ANON_KEY,
  isSupabaseConfigured,
  supabaseConfig,
} from '@/lib/supabase/config';
