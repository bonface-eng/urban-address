-- =============================================================================
-- Migration: Remove signup email verification OTP table & update handle_new_user
-- Idempotent: safe to re-run.
-- Confirmed prior to execution: public.email_verification_otps contained 0 rows
-- and is not referenced by any foreign keys, functions, or policies.
-- =============================================================================

BEGIN;

DROP TABLE IF EXISTS public.email_verification_otps CASCADE;

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
  resolved_name text;
BEGIN
  IF normalized_email <> '' THEN
    SELECT EXISTS (
      SELECT 1 FROM public.admins WHERE lower(email) = normalized_email
    ) INTO is_whitelisted_admin;
  END IF;

  IF is_whitelisted_admin THEN
    resolved_role := 'ADMIN';
    resolved_account_type := 'STAFF';
  ELSIF COALESCE(NEW.raw_app_meta_data ->> 'role', '') IN ('ADMIN','MANAGER','SUPERVISOR','CASHIER','STOREKEEPER','ATTENDANT','KITCHEN') THEN
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
    id,
    uid,
    firebase_id,
    email,
    display_name,
    photo_url,
    role,
    account_type,
    email_verified,
    created_at_ms
  ) VALUES (
    NEW.id,
    COALESCE(NULLIF(NEW.raw_app_meta_data ->> 'firebase_uid', ''), NEW.id::text),
    COALESCE(NULLIF(NEW.raw_app_meta_data ->> 'firebase_uid', ''), NEW.id::text),
    normalized_email,
    resolved_name,
    NEW.raw_user_meta_data ->> 'avatar_url',
    resolved_role,
    resolved_account_type,
    true,
    (EXTRACT(EPOCH FROM COALESCE(NEW.created_at, now())) * 1000)::bigint
  )
  ON CONFLICT (id) DO UPDATE SET
    email = EXCLUDED.email,
    role = CASE WHEN is_whitelisted_admin THEN 'ADMIN' ELSE public.profiles.role END,
    account_type = CASE WHEN is_whitelisted_admin THEN 'STAFF' ELSE public.profiles.account_type END,
    email_verified = true,
    updated_at = now();

  RETURN NEW;
END;
$$;

COMMIT;
