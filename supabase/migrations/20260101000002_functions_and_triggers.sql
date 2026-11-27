-- =============================================================================
-- 02_functions_and_triggers.sql
-- Urban Auto Express — Helper Functions, Auth Bootstrap, Order Sync & Triggers
-- =============================================================================

BEGIN;

-- 1. Generic updated_at timestamp trigger function
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

-- 2. Auto-populate firebase_id = id if omitted so every row can be reconciled
CREATE OR REPLACE FUNCTION public.ensure_firebase_id()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.firebase_id IS NULL THEN
    NEW.firebase_id := NEW.id::text;
  END IF;
  RETURN NEW;
END;
$$;

-- 3. Synchronize orders.items JSONB array into normalized public.order_items table
CREATE OR REPLACE FUNCTION public.sync_order_items_from_order()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  item jsonb;
  idx integer := 0;
BEGIN
  DELETE FROM public.order_items WHERE order_id = NEW.id;
  IF NEW.items IS NOT NULL AND jsonb_typeof(NEW.items) = 'array' THEN
    FOR item IN SELECT * FROM jsonb_array_elements(NEW.items) LOOP
      INSERT INTO public.order_items (
        order_id, item_index, product_id, name, category, price, quantity, notes, status, commission
      ) VALUES (
        NEW.id,
        idx,
        NULLIF(item ->> 'productId', ''),
        COALESCE(item ->> 'name', 'Item'),
        COALESCE(item ->> 'category', 'General'),
        COALESCE((item ->> 'price')::numeric(12,2), 0),
        COALESCE((item ->> 'quantity')::numeric(12,2), 1),
        item ->> 'notes',
        COALESCE(item ->> 'status', 'COMMITTED'),
        COALESCE((item ->> 'commission')::numeric(12,2), 0)
      );
      idx := idx + 1;
    END LOOP;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_sync_order_items ON public.orders;
CREATE TRIGGER trg_sync_order_items
AFTER INSERT OR UPDATE OF items ON public.orders
FOR EACH ROW
EXECUTE FUNCTION public.sync_order_items_from_order();

-- 4. Auth signup trigger: creates public.profiles row automatically
--    Bootstraps ADMIN role if user's email exists in public.admins!
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
    (NEW.email_confirmed_at IS NOT NULL OR is_whitelisted_admin),
    (EXTRACT(EPOCH FROM COALESCE(NEW.created_at, now())) * 1000)::bigint
  )
  ON CONFLICT (id) DO UPDATE SET
    email = EXCLUDED.email,
    role = CASE WHEN is_whitelisted_admin THEN 'ADMIN' ELSE public.profiles.role END,
    account_type = CASE WHEN is_whitelisted_admin THEN 'STAFF' ELSE public.profiles.account_type END,
    updated_at = now();

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
AFTER INSERT ON auth.users
FOR EACH ROW
EXECUTE FUNCTION public.handle_new_user();

-- =============================================================================
-- 5. SECURITY & RLS HELPER FUNCTIONS (Translating firestore.rules)
-- =============================================================================

CREATE OR REPLACE FUNCTION public.is_signed_in()
RETURNS boolean
LANGUAGE sql
STABLE
AS $$
  SELECT auth.uid() IS NOT NULL;
$$;

-- Equivalent to firestore.rules: isFullAuth()
-- PIN-issued terminal sessions set app_metadata.terminal_staff_session = true
CREATE OR REPLACE FUNCTION public.is_full_auth()
RETURNS boolean
LANGUAGE sql
STABLE
AS $$
  SELECT auth.uid() IS NOT NULL
    AND COALESCE((auth.jwt() -> 'app_metadata' ->> 'terminal_staff_session')::boolean, false) = false
    AND COALESCE((auth.jwt() -> 'app_metadata' ->> 'terminalStaffSession')::boolean, false) = false;
$$;

-- Current user's text UID (matches both Supabase UUID::text and legacy firebase uid)
CREATE OR REPLACE FUNCTION public.current_user_uid()
RETURNS text
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(
    (SELECT uid FROM public.profiles WHERE id = auth.uid()),
    auth.uid()::text
  );
$$;

-- Current user's role from public.profiles
CREATE OR REPLACE FUNCTION public.current_user_role()
RETURNS text
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(
    UPPER((SELECT role FROM public.profiles WHERE id = auth.uid())),
    'CLIENT'
  );
$$;

-- Equivalent to firestore.rules: hasDailyAdminOtp()
-- Checks both public.admin_daily_otps for today's UTC date AND JWT app_metadata
CREATE OR REPLACE FUNCTION public.has_daily_admin_otp()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT auth.uid() IS NOT NULL AND (
    EXISTS (
      SELECT 1 FROM public.admin_daily_otps
      WHERE id IN (auth.uid()::text, public.current_user_uid())
        AND day = to_char(now() AT TIME ZONE 'UTC', 'YYYY-MM-DD')
        AND verified_at IS NOT NULL
    )
    OR COALESCE(auth.jwt() -> 'app_metadata' ->> 'adminOtpVerifiedDate', '') = to_char(now() AT TIME ZONE 'UTC', 'YYYY-MM-DD')
  );
$$;

-- Equivalent to firestore.rules: isSuperAdmin()
-- Checks public.admins table rather than hardcoding email addresses in SQL
CREATE OR REPLACE FUNCTION public.is_super_admin()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT public.is_full_auth()
    AND public.has_daily_admin_otp()
    AND EXISTS (
      SELECT 1 FROM public.admins
      WHERE lower(email) = lower(COALESCE(auth.jwt() ->> 'email', ''))
    );
$$;

-- Equivalent to firestore.rules: isAdmin()
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT public.is_full_auth() AND (
    (public.current_user_role() = 'ADMIN' AND public.has_daily_admin_otp())
    OR public.current_user_role() IN ('MANAGER', 'SUPERVISOR')
    OR public.is_super_admin()
  );
$$;

-- Equivalent to firestore.rules: isAudioAdmin()
CREATE OR REPLACE FUNCTION public.is_audio_admin()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT public.is_full_auth() AND (
    (public.current_user_role() = 'ADMIN' AND public.has_daily_admin_otp())
    OR public.is_super_admin()
  );
$$;

-- Equivalent to firestore.rules: isKitchen()
CREATE OR REPLACE FUNCTION public.is_kitchen()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT public.is_signed_in() AND public.current_user_role() = 'KITCHEN';
$$;

-- Equivalent to firestore.rules: isStaff()
CREATE OR REPLACE FUNCTION public.is_staff()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT public.is_signed_in() AND (
    (public.current_user_role() = 'ADMIN' AND public.has_daily_admin_otp())
    OR public.current_user_role() IN ('MANAGER', 'SUPERVISOR', 'CASHIER', 'STOREKEEPER', 'ATTENDANT', 'KITCHEN')
    OR public.is_super_admin()
  );
$$;

-- Helper to check if current user owns a given uid (UUID::text or legacy firebase_id)
CREATE OR REPLACE FUNCTION public.owns_user(target_uid text)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT auth.uid() IS NOT NULL AND (
    target_uid = auth.uid()::text
    OR target_uid = public.current_user_uid()
  );
$$;

-- Protect sensitive profile columns (role, base_salary, loyalty_points, total_spent) from self-elevation
CREATE OR REPLACE FUNCTION public.enforce_profile_update_rules()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Service role / postgres superuser bypass
  IF current_setting('request.jwt.claim.role', true) = 'service_role' OR auth.uid() IS NULL THEN
    RETURN NEW;
  END IF;

  IF NOT public.is_admin() THEN
    IF NEW.role IS DISTINCT FROM OLD.role
       OR NEW.account_type IS DISTINCT FROM OLD.account_type
       OR NEW.base_salary IS DISTINCT FROM OLD.base_salary
       OR NEW.loyalty_points IS DISTINCT FROM OLD.loyalty_points
       OR NEW.total_spent IS DISTINCT FROM OLD.total_spent
       OR NEW.assigned_units IS DISTINCT FROM OLD.assigned_units
       OR NEW.branch_ids IS DISTINCT FROM OLD.branch_ids
    THEN
      RAISE EXCEPTION 'Unauthorized modification of privileged profile fields.';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_enforce_profile_update ON public.profiles;
CREATE TRIGGER trg_enforce_profile_update
BEFORE UPDATE ON public.profiles
FOR EACH ROW
EXECUTE FUNCTION public.enforce_profile_update_rules();

-- Enforce inventory stock increase rule (only super-admin or service_role can increase stock_level directly)
CREATE OR REPLACE FUNCTION public.enforce_inventory_stock_rules()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF current_setting('request.jwt.claim.role', true) = 'service_role' OR auth.uid() IS NULL THEN
    RETURN NEW;
  END IF;

  IF NEW.stock_level > OLD.stock_level AND NOT public.is_super_admin() THEN
    RAISE EXCEPTION 'Stock level increases require super-administrator authorization.';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_enforce_inventory_stock ON public.inventory;
CREATE TRIGGER trg_enforce_inventory_stock
BEFORE UPDATE ON public.inventory
FOR EACH ROW
EXECUTE FUNCTION public.enforce_inventory_stock_rules();

-- Enforce KDS kitchen order update restrictions
CREATE OR REPLACE FUNCTION public.enforce_kitchen_order_update()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF current_setting('request.jwt.claim.role', true) = 'service_role' OR auth.uid() IS NULL THEN
    RETURN NEW;
  END IF;

  IF public.is_kitchen() AND NOT public.is_admin() THEN
    IF NEW.total IS DISTINCT FROM OLD.total
       OR NEW.status IS DISTINCT FROM OLD.status
       OR NEW.payment_status IS DISTINCT FROM OLD.payment_status
       OR NEW.items IS DISTINCT FROM OLD.items
       OR NEW.prep_status NOT IN ('NEW', 'PREPARING', 'READY', 'SERVED')
    THEN
      RAISE EXCEPTION 'Kitchen accounts may only update preparation status fields.';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_enforce_kitchen_order_update ON public.orders;
CREATE TRIGGER trg_enforce_kitchen_order_update
BEFORE UPDATE ON public.orders
FOR EACH ROW
EXECUTE FUNCTION public.enforce_kitchen_order_update();

COMMIT;
