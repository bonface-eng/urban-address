-- =============================================================================
-- 07_grants.sql
-- Table/function privileges for the Supabase API roles.
--
-- WHY: RLS policies only filter rows. A role still needs a table-level GRANT
-- before PostgREST/Realtime can touch the table at all; without it every query
-- fails with "permission denied for table ..." (including the service role).
-- Tables created from the SQL editor/psql do not always get default grants.
--
-- Model:
--   service_role   -> ALL on everything (server only; bypasses RLS).
--   authenticated  -> CRUD only on tables that have at least one RLS policy
--                     (policies then decide which rows). Server-only tables
--                     (OTPs, PIN hashes, outbox, Telegram state, ...) have no
--                     policies, so they are NOT granted -> client access denied.
--   anon           -> SELECT only on tables with a policy that is open to the
--                     public (USING (true)), e.g. public menu/releases.
-- Idempotent: safe to re-run. Run AFTER 03_rls_policies.sql.
-- =============================================================================

GRANT USAGE ON SCHEMA public TO anon, authenticated, service_role;

-- Service role (server-side, SUPABASE_SERVICE_ROLE_KEY)
GRANT ALL ON ALL TABLES    IN SCHEMA public TO service_role;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO service_role;
GRANT ALL ON ALL FUNCTIONS IN SCHEMA public TO service_role;

-- Future objects created by the postgres role get the same service_role access
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES    TO service_role;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON SEQUENCES TO service_role;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON FUNCTIONS TO service_role;

-- Policy helper functions are called from inside RLS policies as the caller
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA public TO anon, authenticated;

DO $$
DECLARE
  r record;
BEGIN
  -- authenticated: CRUD on every table that has client policies
  FOR r IN SELECT DISTINCT tablename FROM pg_policies WHERE schemaname = 'public' LOOP
    EXECUTE format('GRANT SELECT, INSERT, UPDATE, DELETE ON public.%I TO authenticated', r.tablename);
  END LOOP;

  -- anon: read-only on tables with a public (USING true) SELECT policy
  FOR r IN
    SELECT DISTINCT tablename FROM pg_policies
    WHERE schemaname = 'public'
      AND cmd IN ('SELECT', 'ALL')
      AND trim(both '() ' from COALESCE(qual, '')) = 'true'
  LOOP
    EXECUTE format('GRANT SELECT ON public.%I TO anon', r.tablename);
  END LOOP;
END $$;

-- Sequences used by authenticated inserts (serial/identity columns, if any)
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO authenticated;
