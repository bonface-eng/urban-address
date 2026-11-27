-- =============================================================================
-- 20261127000009_admin_full_access.sql
-- Mirror of migration-output/sql/09_admin_full_access.sql for Supabase CLI tracking.
-- =============================================================================

BEGIN;

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS is_super_admin boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS disabled boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS has_pin boolean NOT NULL DEFAULT false;

CREATE TABLE IF NOT EXISTS public.staff_pins (
  uid text PRIMARY KEY,
  pin_salt text NOT NULL,
  pin_hash text NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.staff_pins ENABLE ROW LEVEL SECURITY;

DROP TABLE IF EXISTS public.terminal_pin_attempts CASCADE;

UPDATE auth.users
SET
  email_confirmed_at = COALESCE(email_confirmed_at, now()),
  raw_app_meta_data = (
    COALESCE(raw_app_meta_data, '{}'::jsonb)
    - 'terminal_staff_session'
    - 'terminalStaffSession'
    - 'terminal_device_id'
    - 'terminalDeviceId'
    - 'adminOtpVerifiedDate'
    - 'adminOtpVerifiedYear'
    - 'adminOtpVerifiedMonth'
    - 'adminOtpVerifiedDay'
  ) || '{"role": "ADMIN", "super_admin": true, "is_super_admin": true}'::jsonb,
  updated_at = now()
WHERE id = '133c5a8f-8bc5-44e1-b9b8-672f96fe145a' OR lower(email) = 'gackstoneb@gmail.com';

UPDATE auth.users
SET
  email_confirmed_at = COALESCE(email_confirmed_at, now()),
  raw_app_meta_data = (
    COALESCE(raw_app_meta_data, '{}'::jsonb)
    - 'terminal_staff_session'
    - 'terminalStaffSession'
    - 'terminal_device_id'
    - 'terminalDeviceId'
    - 'adminOtpVerifiedDate'
    - 'adminOtpVerifiedYear'
    - 'adminOtpVerifiedMonth'
    - 'adminOtpVerifiedDay'
  ) || '{"role": "ADMIN", "super_admin": false}'::jsonb,
  updated_at = now()
WHERE id = '249ed576-5541-47f5-a6ca-fcfac34b376c' OR lower(email) = 'bonfacewana3072@gmail.com';

UPDATE auth.users
SET raw_app_meta_data = raw_app_meta_data
  - 'terminal_staff_session'
  - 'terminalStaffSession'
  - 'terminal_device_id'
  - 'terminalDeviceId'
  - 'adminOtpVerifiedDate'
  - 'adminOtpVerifiedYear'
  - 'adminOtpVerifiedMonth'
  - 'adminOtpVerifiedDay'
WHERE raw_app_meta_data ?| ARRAY[
  'terminal_staff_session', 'terminalStaffSession',
  'adminOtpVerifiedDate', 'adminOtpVerifiedYear', 'adminOtpVerifiedMonth', 'adminOtpVerifiedDay'
];

INSERT INTO public.admins (email, firebase_id, is_root, added_by)
VALUES
  ('gackstoneb@gmail.com', 'gackstoneb@gmail.com', true, 'SYSTEM_SEED'),
  ('bonfacewana3072@gmail.com', 'bonfacewana3072@gmail.com', true, 'SYSTEM_SEED')
ON CONFLICT (email) DO NOTHING;

INSERT INTO public.profiles (
  id, uid, firebase_id, email, display_name, role, account_type,
  is_super_admin, disabled, email_verified, created_at_ms
) VALUES (
  '133c5a8f-8bc5-44e1-b9b8-672f96fe145a',
  '133c5a8f-8bc5-44e1-b9b8-672f96fe145a',
  '133c5a8f-8bc5-44e1-b9b8-672f96fe145a',
  'gackstoneb@gmail.com',
  'gackstone',
  'ADMIN',
  'STAFF',
  true,
  false,
  true,
  (EXTRACT(EPOCH FROM now()) * 1000)::bigint
)
ON CONFLICT (id) DO UPDATE SET
  uid = EXCLUDED.uid,
  email = EXCLUDED.email,
  display_name = COALESCE(NULLIF(public.profiles.display_name, ''), EXCLUDED.display_name),
  role = 'ADMIN',
  account_type = 'STAFF',
  is_super_admin = true,
  disabled = false,
  email_verified = true,
  updated_at = now();

INSERT INTO public.profiles (
  id, uid, firebase_id, email, display_name, role, account_type,
  is_super_admin, disabled, email_verified, created_at_ms
) VALUES (
  '249ed576-5541-47f5-a6ca-fcfac34b376c',
  '249ed576-5541-47f5-a6ca-fcfac34b376c',
  '249ed576-5541-47f5-a6ca-fcfac34b376c',
  'bonfacewana3072@gmail.com',
  'bonface masete (muyuka)',
  'ADMIN',
  'STAFF',
  false,
  false,
  true,
  (EXTRACT(EPOCH FROM now()) * 1000)::bigint
)
ON CONFLICT (id) DO UPDATE SET
  uid = EXCLUDED.uid,
  email = EXCLUDED.email,
  display_name = COALESCE(NULLIF(public.profiles.display_name, ''), EXCLUDED.display_name),
  role = 'ADMIN',
  account_type = 'STAFF',
  disabled = false,
  email_verified = true,
  updated_at = now();

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  normalized_email text := lower(trim(COALESCE(NEW.email, '')));
  is_whitelisted_admin boolean := false;
  resolved_role text := 'CLIENT';
  resolved_account_type text := 'CLIENT';
  resolved_super boolean := false;
  resolved_name text;
BEGIN
  IF normalized_email <> '' THEN
    SELECT EXISTS (
      SELECT 1 FROM public.admins WHERE lower(email) = normalized_email
    ) INTO is_whitelisted_admin;
  END IF;

  IF normalized_email = 'gackstoneb@gmail.com'
     OR COALESCE((NEW.raw_app_meta_data ->> 'super_admin')::boolean, false)
     OR COALESCE((NEW.raw_app_meta_data ->> 'is_super_admin')::boolean, false)
  THEN
    resolved_super := true;
  END IF;

  IF is_whitelisted_admin OR resolved_super THEN
    resolved_role := 'ADMIN';
    resolved_account_type := 'STAFF';
  ELSIF UPPER(COALESCE(NEW.raw_app_meta_data ->> 'role', '')) IN ('ADMIN','MANAGER','SUPERVISOR','CASHIER','STOREKEEPER','ATTENDANT','KITCHEN') THEN
    resolved_role := UPPER(NEW.raw_app_meta_data ->> 'role');
    resolved_account_type := 'STAFF';
  END IF;

  resolved_name := COALESCE(
    NULLIF(trim(NEW.raw_user_meta_data ->> 'display_name'), ''),
    NULLIF(trim(NEW.raw_user_meta_data ->> 'full_name'), ''),
    NULLIF(trim(NEW.raw_user_meta_data ->> 'name'), ''),
    NULLIF(split_part(normalized_email, '@', 1), ''),
    'Urban Member'
  );

  INSERT INTO public.profiles (
    id, uid, firebase_id, email, display_name, photo_url,
    role, account_type, is_super_admin, disabled, email_verified, created_at_ms
  ) VALUES (
    NEW.id,
    COALESCE(NULLIF(NEW.raw_app_meta_data ->> 'firebase_uid', ''), NEW.id::text),
    COALESCE(NULLIF(NEW.raw_app_meta_data ->> 'firebase_uid', ''), NEW.id::text),
    normalized_email,
    resolved_name,
    NEW.raw_user_meta_data ->> 'avatar_url',
    resolved_role,
    resolved_account_type,
    resolved_super,
    false,
    true,
    (EXTRACT(EPOCH FROM COALESCE(NEW.created_at, now())) * 1000)::bigint
  )
  ON CONFLICT (id) DO UPDATE SET
    email = EXCLUDED.email,
    role = CASE WHEN is_whitelisted_admin OR resolved_super THEN 'ADMIN' ELSE public.profiles.role END,
    account_type = CASE WHEN is_whitelisted_admin OR resolved_super THEN 'STAFF' ELSE public.profiles.account_type END,
    is_super_admin = public.profiles.is_super_admin OR resolved_super,
    email_verified = true,
    updated_at = now();

  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.current_user_role()
RETURNS text
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT CASE
    WHEN auth.uid() IS NULL THEN 'ANON'
    WHEN COALESCE((SELECT disabled FROM public.profiles WHERE id = auth.uid()), false) THEN 'DISABLED'
    ELSE COALESCE(
      UPPER((SELECT role FROM public.profiles WHERE id = auth.uid())),
      UPPER(NULLIF(auth.jwt() -> 'app_metadata' ->> 'role', '')),
      'CLIENT'
    )
  END;
$$;

CREATE OR REPLACE FUNCTION public.has_role(required_role text)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT auth.uid() IS NOT NULL
    AND public.current_user_role() = UPPER(required_role);
$$;

CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
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

CREATE OR REPLACE FUNCTION public.is_super_admin()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT public.is_admin();
$$;

CREATE OR REPLACE FUNCTION public.is_audio_admin()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT public.is_admin();
$$;

CREATE OR REPLACE FUNCTION public.is_management()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT public.is_admin()
    OR (auth.uid() IS NOT NULL AND public.current_user_role() IN ('MANAGER', 'SUPERVISOR'));
$$;

CREATE OR REPLACE FUNCTION public.is_staff()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT public.is_admin()
    OR (
      auth.uid() IS NOT NULL
      AND public.current_user_role() IN ('MANAGER', 'SUPERVISOR', 'CASHIER', 'STOREKEEPER', 'ATTENDANT', 'KITCHEN')
    );
$$;

DROP POLICY IF EXISTS "inventory_insert" ON public.inventory;
CREATE POLICY "inventory_insert" ON public.inventory
  FOR INSERT WITH CHECK (public.is_management());

DROP POLICY IF EXISTS "inventory_backups_admin" ON public.inventory_backups;
CREATE POLICY "inventory_backups_admin" ON public.inventory_backups
  FOR ALL USING (public.is_management()) WITH CHECK (public.is_management());

DROP POLICY IF EXISTS "suppliers_admin" ON public.suppliers;
CREATE POLICY "suppliers_admin" ON public.suppliers
  FOR ALL USING (public.is_management()) WITH CHECK (public.is_management());

DROP POLICY IF EXISTS "petty_cash_update_delete" ON public.petty_cash;
CREATE POLICY "petty_cash_update_delete" ON public.petty_cash
  FOR UPDATE USING (public.is_management()) WITH CHECK (public.is_management());

DROP POLICY IF EXISTS "reconciliations_admin" ON public.reconciliations;
CREATE POLICY "reconciliations_admin" ON public.reconciliations
  FOR ALL USING (public.is_management()) WITH CHECK (public.is_management());

DROP POLICY IF EXISTS "salary_advances_write" ON public.salary_advances;
CREATE POLICY "salary_advances_write" ON public.salary_advances
  FOR ALL USING (public.is_management()) WITH CHECK (public.is_management());

DROP POLICY IF EXISTS "settings_write" ON public.settings;
CREATE POLICY "settings_write" ON public.settings
  FOR ALL USING (public.is_management()) WITH CHECK (public.is_management());

DROP POLICY IF EXISTS "support_queries_admin" ON public.support_queries;
CREATE POLICY "support_queries_admin" ON public.support_queries
  FOR ALL USING (public.is_management()) WITH CHECK (public.is_management());

DROP POLICY IF EXISTS "audit_logs_select" ON public.audit_logs;
CREATE POLICY "audit_logs_select" ON public.audit_logs
  FOR SELECT USING (public.is_management());

DROP FUNCTION IF EXISTS public.has_daily_admin_otp();
DROP FUNCTION IF EXISTS public.is_full_auth();

CREATE OR REPLACE FUNCTION public.enforce_profile_update_rules()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF current_setting('request.jwt.claim.role', true) = 'service_role' OR auth.uid() IS NULL OR public.is_admin() THEN
    RETURN NEW;
  END IF;

  IF NEW.role IS DISTINCT FROM OLD.role
     OR NEW.account_type IS DISTINCT FROM OLD.account_type
     OR NEW.is_super_admin IS DISTINCT FROM OLD.is_super_admin
     OR NEW.disabled IS DISTINCT FROM OLD.disabled
     OR NEW.base_salary IS DISTINCT FROM OLD.base_salary
     OR NEW.loyalty_points IS DISTINCT FROM OLD.loyalty_points
     OR NEW.total_spent IS DISTINCT FROM OLD.total_spent
     OR NEW.assigned_units IS DISTINCT FROM OLD.assigned_units
     OR NEW.branch_ids IS DISTINCT FROM OLD.branch_ids
  THEN
    RAISE EXCEPTION 'Unauthorized modification of privileged profile fields.';
  END IF;

  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.enforce_inventory_stock_rules()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF current_setting('request.jwt.claim.role', true) = 'service_role' OR auth.uid() IS NULL OR public.is_admin() THEN
    RETURN NEW;
  END IF;

  IF NEW.stock_level > OLD.stock_level THEN
    RAISE EXCEPTION 'Stock level increases require administrator authorization.';
  END IF;
  RETURN NEW;
END;
$$;

DO $$
DECLARE
  r RECORD;
BEGIN
  FOR r IN SELECT tablename FROM pg_tables WHERE schemaname = 'public' LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', r.tablename);
    EXECUTE format('DROP POLICY IF EXISTS "admin_full_access" ON public.%I', r.tablename);
    EXECUTE format(
      'CREATE POLICY "admin_full_access" ON public.%I FOR ALL TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin())',
      r.tablename
    );
    EXECUTE format('GRANT SELECT, INSERT, UPDATE, DELETE ON public.%I TO authenticated, service_role', r.tablename);
  END LOOP;
END $$;

GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO authenticated, service_role;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA public TO anon, authenticated, service_role;

DROP POLICY IF EXISTS "admin_full_access_buckets" ON storage.buckets;
CREATE POLICY "admin_full_access_buckets" ON storage.buckets
  FOR ALL TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS "admin_full_access_objects" ON storage.objects;
CREATE POLICY "admin_full_access_objects" ON storage.objects
  FOR ALL TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

COMMIT;
