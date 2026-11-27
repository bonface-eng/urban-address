/**
 * Startup validation for required Supabase environment variables.
 *
 * Client bundles only receive NEXT_PUBLIC_* variables. Server bundles
 * additionally require SUPABASE_SERVICE_ROLE_KEY.
 */

const PUBLIC_REQUIRED = [
  'NEXT_PUBLIC_SUPABASE_URL',
  'NEXT_PUBLIC_SUPABASE_ANON_KEY',
] as const;

const SERVER_REQUIRED = [
  'SUPABASE_SERVICE_ROLE_KEY',
] as const;

export function validatePublicSupabaseEnv(): void {
  const missing: string[] = [];
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL?.trim()) {
    missing.push('NEXT_PUBLIC_SUPABASE_URL');
  }
  if (!process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim()) {
    missing.push('NEXT_PUBLIC_SUPABASE_ANON_KEY');
  }
  if (missing.length > 0) {
    throw new Error(
      `[ENV] Missing required public Supabase environment variable(s): ${missing.join(', ')}. Check .env.local or deployment environment settings.`
    );
  }
}

export function validateServerSupabaseEnv(): void {
  if (typeof window !== 'undefined') {
    throw new Error('[ENV] Server environment validation cannot run in the browser.');
  }
  validatePublicSupabaseEnv();
  const missing = SERVER_REQUIRED.filter((key) => !process.env[key]?.trim());
  if (missing.length > 0) {
    throw new Error(
      `[ENV] Missing required server Supabase environment variable(s): ${missing.join(', ')}. Check .env.local or deployment environment settings.`
    );
  }
}

export function validateMigrationEnv(): void {
  validateServerSupabaseEnv();
  if (!process.env.DATABASE_URL_MIGRATIONS?.trim()) {
    throw new Error(
      '[ENV] Missing required migration environment variable: DATABASE_URL_MIGRATIONS.'
    );
  }
}

// Run immediately on module import when not in a mocked unit-test run
if (typeof process !== 'undefined' && !process.env.VITEST) {
  if (typeof window === 'undefined') {
    validateServerSupabaseEnv();
  } else {
    validatePublicSupabaseEnv();
  }
}

export { PUBLIC_REQUIRED, SERVER_REQUIRED };
