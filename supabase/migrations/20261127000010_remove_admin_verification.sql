-- ==============================================================================
-- Migration 10: Complete removal of Administrator Verification (Daily OTP)
-- ==============================================================================
-- - Drops obsolete security functions (has_daily_admin_otp, is_full_auth).
-- - Confirms public.is_admin() grants full access based solely on Supabase session,
--   profiles.role, profiles.is_super_admin, and the public.admins whitelist.
-- - Revokes any client/anon privileges on public.admin_daily_otps (preserving table
--   rows for audit until user explicitly asks to drop it).
-- ==============================================================================

-- 1. Drop obsolete OTP helper functions if any exist
DROP FUNCTION IF EXISTS public.has_daily_admin_otp() CASCADE;
DROP FUNCTION IF EXISTS public.is_full_auth() CASCADE;

-- 2. Ensure public.is_admin() helper does not check any OTP claims
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, auth
AS $$
  SELECT auth.uid() IS NOT NULL
    AND COALESCE((SELECT disabled FROM public.profiles WHERE id = auth.uid()), false) = false
    AND (
      EXISTS (
        SELECT 1 FROM public.profiles
        WHERE id = auth.uid()
          AND (UPPER(role) IN ('ADMIN', 'SUPER_ADMIN') OR is_super_admin = true)
      )
      OR EXISTS (
        SELECT 1 FROM public.admins
        WHERE lower(email) = lower(COALESCE(auth.jwt() ->> 'email', ''))
      )
      OR UPPER(COALESCE(auth.jwt() -> 'app_metadata' ->> 'role', '')) IN ('ADMIN', 'SUPER_ADMIN')
      OR COALESCE((auth.jwt() -> 'app_metadata' ->> 'super_admin')::boolean, false) = true
    );
$$;

-- 3. Confirm public.is_staff() does not require daily OTP
CREATE OR REPLACE FUNCTION public.is_staff()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, auth
AS $$
  SELECT auth.uid() IS NOT NULL
    AND COALESCE((SELECT disabled FROM public.profiles WHERE id = auth.uid()), false) = false
    AND (
      public.is_admin()
      OR EXISTS (
        SELECT 1 FROM public.profiles
        WHERE id = auth.uid()
          AND role IS NOT NULL
          AND UPPER(role) <> 'CLIENT'
      )
    );
$$;

-- 4. Revoke all client privileges on admin_daily_otps while preserving historical rows
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'admin_daily_otps') THEN
    REVOKE ALL ON TABLE public.admin_daily_otps FROM anon, authenticated, public;
    GRANT ALL ON TABLE public.admin_daily_otps TO service_role;
  END IF;
END $$;
