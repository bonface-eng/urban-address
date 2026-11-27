-- ==============================================================================
-- Migration 11: Dynamic Roles, Permissions & User Lifecycle Management
-- ==============================================================================

-- 1. Ensure profiles has all lifecycle, status, and role management columns
ALTER TABLE public.profiles 
  ADD COLUMN IF NOT EXISTS status text DEFAULT 'active',
  ADD COLUMN IF NOT EXISTS suspended_at timestamptz,
  ADD COLUMN IF NOT EXISTS suspended_by text,
  ADD COLUMN IF NOT EXISTS suspended_reason text,
  ADD COLUMN IF NOT EXISTS branch_id text,
  ADD COLUMN IF NOT EXISTS terminal_pin_hash text,
  ADD COLUMN IF NOT EXISTS station_authorizations jsonb DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS updated_by text,
  ADD COLUMN IF NOT EXISTS deleted_at timestamptz;

-- Set default status on existing rows
UPDATE public.profiles
SET status = CASE 
  WHEN disabled = true THEN 'suspended'
  ELSE 'active'
END
WHERE status IS NULL;

-- Add check constraint for status
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'profiles_status_check'
  ) THEN
    ALTER TABLE public.profiles 
      ADD CONSTRAINT profiles_status_check 
      CHECK (status IN ('active', 'suspended', 'deleted'));
  END IF;
END $$;

-- Update profiles_role_check constraint to include SUPER_ADMIN
ALTER TABLE public.profiles DROP CONSTRAINT IF EXISTS profiles_role_check;
ALTER TABLE public.profiles ADD CONSTRAINT profiles_role_check 
  CHECK (role = ANY (ARRAY['SUPER_ADMIN'::text, 'ADMIN'::text, 'MANAGER'::text, 'SUPERVISOR'::text, 'CASHIER'::text, 'STOREKEEPER'::text, 'ATTENDANT'::text, 'KITCHEN'::text, 'CLIENT'::text]));

-- 2. Create roles table
CREATE TABLE IF NOT EXISTS public.roles (
  id text PRIMARY KEY,
  name text NOT NULL,
  description text,
  is_staff boolean DEFAULT true,
  is_system boolean DEFAULT true,
  created_at timestamptz DEFAULT now()
);

-- Seed confirmed 9 roles
INSERT INTO public.roles (id, name, description, is_staff, is_system)
VALUES 
  ('SUPER_ADMIN', 'Super Administrator', 'Protected root administrator with full privileges across all systems', true, true),
  ('ADMIN', 'Administrator', 'Full operational and personnel management across all modules', true, true),
  ('MANAGER', 'Branch Manager', 'Branch operations, shift supervision, staff management, and approvals', true, true),
  ('SUPERVISOR', 'Shift Supervisor', 'Shift leadership, terminal oversight, attendant queue, and drawer reconciliations', true, true),
  ('CASHIER', 'Cashier', 'POS operation, drawer sessions, sales intake, customer lookup, and receipts', true, true),
  ('STOREKEEPER', 'Storekeeper', 'Inventory stock control, movement, goods intake, and supplier procurement', true, true),
  ('ATTENDANT', 'Service Attendant', 'Carwash and detailing service queue operations and personal commissions', true, true),
  ('KITCHEN', 'Kitchen / Barista', 'Kitchen Display System order preparation and status alerts', true, true),
  ('CLIENT', 'Customer / Member', 'Storefront customer with personal profile, vehicles, orders, and loyalty points', false, true)
ON CONFLICT (id) DO UPDATE SET
  name = EXCLUDED.name,
  description = EXCLUDED.description,
  is_staff = EXCLUDED.is_staff;

-- 3. Create permissions table
CREATE TABLE IF NOT EXISTS public.permissions (
  id text PRIMARY KEY,
  category text NOT NULL,
  name text NOT NULL,
  description text,
  created_at timestamptz DEFAULT now()
);

-- Seed permission catalogue
INSERT INTO public.permissions (id, category, name, description)
VALUES
  -- POS
  ('pos.lounge', 'pos', 'Lounge Terminal', 'Access and operate Lounge POS register'),
  ('pos.store', 'pos', 'Store Terminal', 'Access and operate Auto Accessories retail POS'),
  ('pos.carwash', 'pos', 'Carwash Terminal', 'Access and operate Carwash intake register'),
  ('pos.hold_resume', 'pos', 'Hold & Resume Bills', 'Hold customer draft tickets and resume for payment'),
  ('pos.void_item', 'pos', 'Void Items & Bills', 'Authorize voiding items or cancelling tickets'),
  -- Orders
  ('orders.view_all', 'orders', 'View All Orders', 'View all customer and station orders across business'),
  ('orders.view_own', 'orders', 'View Own Orders', 'View orders created by or assigned to self'),
  ('orders.create', 'orders', 'Create Orders', 'Record sales transactions and intake jobs'),
  ('orders.refund', 'orders', 'Process Refunds', 'Approve or process customer refunds and credit notes'),
  -- Carwash
  ('carwash.queue', 'carwash', 'Service Queue', 'Manage vehicle detailing queue and bay allocations'),
  ('carwash.commissions', 'carwash', 'Commissions Tracking', 'View and audit attendant service commissions'),
  -- Kitchen
  ('kds.board', 'kds', 'Kitchen Display', 'View and manage food & beverage kitchen preparation orders'),
  -- Inventory
  ('inventory.view', 'inventory', 'View Inventory', 'View catalog products, prices, and stock levels'),
  ('inventory.edit', 'inventory', 'Edit Catalog', 'Create, update, and manage inventory product details'),
  ('inventory.adjust_stock', 'inventory', 'Stock Adjustments', 'Adjust stock quantities and approve variances'),
  ('suppliers.manage', 'inventory', 'Supplier Management', 'Manage suppliers, contracts, and purchase orders'),
  -- Finance
  ('finance.petty_cash', 'finance', 'Petty Cash', 'Request, review, and approve petty cash disbursements'),
  ('finance.reconcile', 'finance', 'Drawer Reconciliation', 'Close registers and reconcile cash drawer sessions'),
  ('finance.reports', 'finance', 'Financial Reports', 'View executive revenue velocity and shift reports'),
  ('finance.payroll', 'finance', 'Staff Payroll', 'View and manage base salaries, advances, and payroll'),
  -- Users
  ('users.view_staff', 'users', 'View Staff Registry', 'Browse staff directory and assigned stations'),
  ('users.manage_staff', 'users', 'Manage Staff', 'Create, update, suspend, and configure staff accounts'),
  ('users.manage_admins', 'users', 'Manage Administrators', 'Promote, demote, or configure ADMIN accounts'),
  ('users.view_customers', 'users', 'View Customers', 'Browse customer directory and loyalty profiles'),
  ('users.manage_customers', 'users', 'Manage Customers', 'Update or suspend customer accounts'),
  -- System
  ('system.branches', 'system', 'Branch Management', 'Create and configure physical branch locations'),
  ('system.matrix', 'system', 'Access Matrix', 'View and modify role permission matrices'),
  ('system.audit_logs', 'system', 'Audit Logging', 'Inspect comprehensive system and security event logs'),
  ('system.errors', 'system', 'System Diagnostics', 'Inspect system runtime errors and health diagnostics'),
  ('system.settings', 'system', 'Global Settings', 'Configure system-wide operational and payment parameters')
ON CONFLICT (id) DO UPDATE SET
  category = EXCLUDED.category,
  name = EXCLUDED.name,
  description = EXCLUDED.description;

-- 4. Create role_permissions join table
CREATE TABLE IF NOT EXISTS public.role_permissions (
  role_id text NOT NULL REFERENCES public.roles(id) ON DELETE CASCADE,
  permission_id text NOT NULL REFERENCES public.permissions(id) ON DELETE CASCADE,
  access_level text NOT NULL CHECK (access_level IN ('view', 'create', 'edit', 'delete', 'manage')),
  created_at timestamptz DEFAULT now(),
  PRIMARY KEY (role_id, permission_id)
);

-- Seed matrix
INSERT INTO public.role_permissions (role_id, permission_id, access_level)
VALUES
  -- SUPER_ADMIN: manage on everything
  ('SUPER_ADMIN', 'pos.lounge', 'manage'),
  ('SUPER_ADMIN', 'pos.store', 'manage'),
  ('SUPER_ADMIN', 'pos.carwash', 'manage'),
  ('SUPER_ADMIN', 'pos.hold_resume', 'manage'),
  ('SUPER_ADMIN', 'pos.void_item', 'manage'),
  ('SUPER_ADMIN', 'orders.view_all', 'manage'),
  ('SUPER_ADMIN', 'orders.view_own', 'manage'),
  ('SUPER_ADMIN', 'orders.create', 'manage'),
  ('SUPER_ADMIN', 'orders.refund', 'manage'),
  ('SUPER_ADMIN', 'carwash.queue', 'manage'),
  ('SUPER_ADMIN', 'carwash.commissions', 'manage'),
  ('SUPER_ADMIN', 'kds.board', 'manage'),
  ('SUPER_ADMIN', 'inventory.view', 'manage'),
  ('SUPER_ADMIN', 'inventory.edit', 'manage'),
  ('SUPER_ADMIN', 'inventory.adjust_stock', 'manage'),
  ('SUPER_ADMIN', 'suppliers.manage', 'manage'),
  ('SUPER_ADMIN', 'finance.petty_cash', 'manage'),
  ('SUPER_ADMIN', 'finance.reconcile', 'manage'),
  ('SUPER_ADMIN', 'finance.reports', 'manage'),
  ('SUPER_ADMIN', 'finance.payroll', 'manage'),
  ('SUPER_ADMIN', 'users.view_staff', 'manage'),
  ('SUPER_ADMIN', 'users.manage_staff', 'manage'),
  ('SUPER_ADMIN', 'users.manage_admins', 'manage'),
  ('SUPER_ADMIN', 'users.view_customers', 'manage'),
  ('SUPER_ADMIN', 'users.manage_customers', 'manage'),
  ('SUPER_ADMIN', 'system.branches', 'manage'),
  ('SUPER_ADMIN', 'system.matrix', 'manage'),
  ('SUPER_ADMIN', 'system.audit_logs', 'manage'),
  ('SUPER_ADMIN', 'system.errors', 'manage'),
  ('SUPER_ADMIN', 'system.settings', 'manage'),

  -- ADMIN: manage on operational & staff, none on manage_admins / system.errors
  ('ADMIN', 'pos.lounge', 'manage'),
  ('ADMIN', 'pos.store', 'manage'),
  ('ADMIN', 'pos.carwash', 'manage'),
  ('ADMIN', 'pos.hold_resume', 'manage'),
  ('ADMIN', 'pos.void_item', 'manage'),
  ('ADMIN', 'orders.view_all', 'manage'),
  ('ADMIN', 'orders.view_own', 'manage'),
  ('ADMIN', 'orders.create', 'manage'),
  ('ADMIN', 'orders.refund', 'manage'),
  ('ADMIN', 'carwash.queue', 'manage'),
  ('ADMIN', 'carwash.commissions', 'manage'),
  ('ADMIN', 'kds.board', 'manage'),
  ('ADMIN', 'inventory.view', 'manage'),
  ('ADMIN', 'inventory.edit', 'manage'),
  ('ADMIN', 'inventory.adjust_stock', 'manage'),
  ('ADMIN', 'suppliers.manage', 'manage'),
  ('ADMIN', 'finance.petty_cash', 'manage'),
  ('ADMIN', 'finance.reconcile', 'manage'),
  ('ADMIN', 'finance.reports', 'manage'),
  ('ADMIN', 'finance.payroll', 'manage'),
  ('ADMIN', 'users.view_staff', 'manage'),
  ('ADMIN', 'users.manage_staff', 'manage'),
  ('ADMIN', 'users.view_customers', 'manage'),
  ('ADMIN', 'users.manage_customers', 'manage'),
  ('ADMIN', 'system.branches', 'manage'),
  ('ADMIN', 'system.matrix', 'manage'),
  ('ADMIN', 'system.audit_logs', 'view'),
  ('ADMIN', 'system.settings', 'manage'),

  -- MANAGER
  ('MANAGER', 'pos.lounge', 'manage'),
  ('MANAGER', 'pos.store', 'manage'),
  ('MANAGER', 'pos.carwash', 'manage'),
  ('MANAGER', 'pos.hold_resume', 'manage'),
  ('MANAGER', 'pos.void_item', 'edit'),
  ('MANAGER', 'orders.view_all', 'view'),
  ('MANAGER', 'orders.view_own', 'view'),
  ('MANAGER', 'orders.create', 'create'),
  ('MANAGER', 'orders.refund', 'edit'),
  ('MANAGER', 'carwash.queue', 'manage'),
  ('MANAGER', 'carwash.commissions', 'view'),
  ('MANAGER', 'kds.board', 'view'),
  ('MANAGER', 'inventory.view', 'view'),
  ('MANAGER', 'inventory.edit', 'edit'),
  ('MANAGER', 'inventory.adjust_stock', 'edit'),
  ('MANAGER', 'suppliers.manage', 'manage'),
  ('MANAGER', 'finance.petty_cash', 'edit'),
  ('MANAGER', 'finance.reconcile', 'manage'),
  ('MANAGER', 'finance.reports', 'view'),
  ('MANAGER', 'finance.payroll', 'view'),
  ('MANAGER', 'users.view_staff', 'view'),
  ('MANAGER', 'users.manage_staff', 'edit'),
  ('MANAGER', 'users.view_customers', 'view'),
  ('MANAGER', 'users.manage_customers', 'edit'),
  ('MANAGER', 'system.branches', 'view'),
  ('MANAGER', 'system.audit_logs', 'view'),

  -- SUPERVISOR
  ('SUPERVISOR', 'pos.lounge', 'manage'),
  ('SUPERVISOR', 'pos.store', 'manage'),
  ('SUPERVISOR', 'pos.carwash', 'manage'),
  ('SUPERVISOR', 'pos.hold_resume', 'manage'),
  ('SUPERVISOR', 'pos.void_item', 'edit'),
  ('SUPERVISOR', 'orders.view_all', 'view'),
  ('SUPERVISOR', 'orders.view_own', 'view'),
  ('SUPERVISOR', 'orders.create', 'create'),
  ('SUPERVISOR', 'carwash.queue', 'manage'),
  ('SUPERVISOR', 'carwash.commissions', 'view'),
  ('SUPERVISOR', 'kds.board', 'view'),
  ('SUPERVISOR', 'inventory.view', 'view'),
  ('SUPERVISOR', 'suppliers.manage', 'view'),
  ('SUPERVISOR', 'finance.petty_cash', 'create'),
  ('SUPERVISOR', 'finance.reconcile', 'manage'),
  ('SUPERVISOR', 'finance.reports', 'view'),
  ('SUPERVISOR', 'users.view_staff', 'view'),
  ('SUPERVISOR', 'users.view_customers', 'view'),
  ('SUPERVISOR', 'system.branches', 'view'),

  -- CASHIER
  ('CASHIER', 'pos.lounge', 'view'),
  ('CASHIER', 'pos.store', 'view'),
  ('CASHIER', 'pos.carwash', 'view'),
  ('CASHIER', 'pos.hold_resume', 'edit'),
  ('CASHIER', 'orders.view_all', 'view'),
  ('CASHIER', 'orders.view_own', 'view'),
  ('CASHIER', 'orders.create', 'create'),
  ('CASHIER', 'carwash.queue', 'view'),
  ('CASHIER', 'inventory.view', 'view'),
  ('CASHIER', 'finance.petty_cash', 'create'),
  ('CASHIER', 'finance.reconcile', 'create'),
  ('CASHIER', 'users.view_customers', 'view'),

  -- STOREKEEPER
  ('STOREKEEPER', 'pos.store', 'view'),
  ('STOREKEEPER', 'pos.hold_resume', 'view'),
  ('STOREKEEPER', 'orders.view_all', 'view'),
  ('STOREKEEPER', 'orders.view_own', 'view'),
  ('STOREKEEPER', 'orders.create', 'create'),
  ('STOREKEEPER', 'inventory.view', 'manage'),
  ('STOREKEEPER', 'inventory.edit', 'edit'),
  ('STOREKEEPER', 'inventory.adjust_stock', 'create'),
  ('STOREKEEPER', 'suppliers.manage', 'manage'),

  -- ATTENDANT
  ('ATTENDANT', 'carwash.queue', 'edit'),
  ('ATTENDANT', 'carwash.commissions', 'view'),
  ('ATTENDANT', 'orders.view_own', 'view'),

  -- KITCHEN
  ('KITCHEN', 'kds.board', 'edit'),
  ('KITCHEN', 'pos.lounge', 'view'),
  ('KITCHEN', 'orders.view_own', 'view'),

  -- CLIENT
  ('CLIENT', 'orders.create', 'create'),
  ('CLIENT', 'orders.view_own', 'view'),
  ('CLIENT', 'carwash.queue', 'view'),
  ('CLIENT', 'users.manage_customers', 'edit')
ON CONFLICT (role_id, permission_id) DO UPDATE SET
  access_level = EXCLUDED.access_level;

-- 5. Helper SQL functions
CREATE OR REPLACE FUNCTION public.is_super_admin()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, auth
AS $$
  SELECT auth.uid() IS NOT NULL
    AND COALESCE((SELECT disabled OR status = 'suspended' FROM public.profiles WHERE id = auth.uid()), false) = false
    AND (
      EXISTS (
        SELECT 1 FROM public.profiles
        WHERE id = auth.uid()
          AND (UPPER(role) = 'SUPER_ADMIN' OR is_super_admin = true)
      )
      OR COALESCE((auth.jwt() -> 'app_metadata' ->> 'super_admin')::boolean, false) = true
      OR lower(COALESCE(auth.jwt() ->> 'email', '')) = 'gackstoneb@gmail.com'
    );
$$;

CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, auth
AS $$
  SELECT auth.uid() IS NOT NULL
    AND COALESCE((SELECT disabled OR status = 'suspended' FROM public.profiles WHERE id = auth.uid()), false) = false
    AND (
      public.is_super_admin()
      OR EXISTS (
        SELECT 1 FROM public.profiles
        WHERE id = auth.uid()
          AND UPPER(role) IN ('ADMIN', 'SUPER_ADMIN')
      )
      OR EXISTS (
        SELECT 1 FROM public.admins
        WHERE lower(email) = lower(COALESCE(auth.jwt() ->> 'email', ''))
      )
      OR UPPER(COALESCE(auth.jwt() -> 'app_metadata' ->> 'role', '')) IN ('ADMIN', 'SUPER_ADMIN')
    );
$$;

CREATE OR REPLACE FUNCTION public.has_role(required_role text)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, auth
AS $$
  SELECT auth.uid() IS NOT NULL
    AND COALESCE((SELECT disabled OR status = 'suspended' FROM public.profiles WHERE id = auth.uid()), false) = false
    AND (
      public.is_super_admin()
      OR EXISTS (
        SELECT 1 FROM public.profiles
        WHERE id = auth.uid()
          AND UPPER(role) = UPPER(required_role)
      )
      OR UPPER(COALESCE(auth.jwt() -> 'app_metadata' ->> 'role', '')) = UPPER(required_role)
    );
$$;

CREATE OR REPLACE FUNCTION public.has_permission(required_perm text, required_level text DEFAULT 'view')
RETURNS boolean
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
  caller_role text;
  caller_level text;
  levels text[] := ARRAY['view', 'create', 'edit', 'delete', 'manage'];
  caller_idx int;
  req_idx int;
BEGIN
  IF public.is_super_admin() THEN
    RETURN true;
  END IF;

  SELECT role INTO caller_role
  FROM public.profiles
  WHERE id = auth.uid() AND COALESCE(disabled, false) = false AND COALESCE(status, 'active') = 'active';

  IF caller_role IS NULL THEN
    RETURN false;
  END IF;

  -- Full ADMIN has manage on all permissions except system.errors / users.manage_admins
  IF UPPER(caller_role) = 'ADMIN' THEN
    IF required_perm IN ('system.errors', 'users.manage_admins') THEN
      RETURN false;
    END IF;
    RETURN true;
  END IF;

  SELECT access_level INTO caller_level
  FROM public.role_permissions
  WHERE role_id = UPPER(caller_role) AND permission_id = required_perm;

  IF caller_level IS NULL THEN
    RETURN false;
  END IF;

  IF caller_level = 'manage' THEN
    RETURN true;
  END IF;

  caller_idx := array_position(levels, caller_level);
  req_idx := array_position(levels, required_level);

  IF caller_idx IS NOT NULL AND req_idx IS NOT NULL AND caller_idx >= req_idx THEN
    RETURN true;
  END IF;

  RETURN false;
END;
$$;

-- 6. Trigger to prevent non-admins from changing role, status, or branch
CREATE OR REPLACE FUNCTION public.trg_protect_profile_lifecycle()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
  super_admin_count int;
  caller_is_admin boolean;
  caller_is_super boolean;
BEGIN
  -- Allow service_role, postgres, or database migrations (when auth.uid() is null)
  IF auth.uid() IS NULL OR current_user IN ('postgres', 'service_role', 'supabase_admin') THEN
    IF NEW.status = 'suspended' THEN
      NEW.disabled := true;
    ELSIF NEW.status = 'active' THEN
      NEW.disabled := false;
    END IF;
    NEW.updated_at := now();
    NEW.updated_at_ms := EXTRACT(EPOCH FROM now()) * 1000;
    RETURN NEW;
  END IF;

  caller_is_super := public.is_super_admin();
  caller_is_admin := public.is_admin();

  -- Prevent demoting, suspending, or deleting the primary root super admin
  IF lower(OLD.email) = 'gackstoneb@gmail.com' THEN
    IF (NEW.role IS DISTINCT FROM OLD.role AND UPPER(NEW.role) NOT IN ('SUPER_ADMIN', 'ADMIN'))
       OR (NEW.status IS DISTINCT FROM 'active' AND NEW.status IS NOT NULL)
       OR (NEW.disabled = true) THEN
      RAISE EXCEPTION 'The primary root Super Administrator account cannot be demoted, suspended, or deactivated.';
    END IF;
  END IF;

  -- Only super admins can modify an admin or super admin profile
  IF (UPPER(OLD.role) IN ('ADMIN', 'SUPER_ADMIN') OR OLD.is_super_admin = true) AND NOT caller_is_super THEN
    IF (NEW.role IS DISTINCT FROM OLD.role) 
       OR (NEW.status IS DISTINCT FROM OLD.status)
       OR (NEW.disabled IS DISTINCT FROM OLD.disabled) THEN
      RAISE EXCEPTION 'Only a Super Administrator can modify an Administrator role or status.';
    END IF;
  END IF;

  -- Non-admins cannot alter their own or others' role, status, or branch
  IF NOT caller_is_admin THEN
    IF NEW.role IS DISTINCT FROM OLD.role THEN
      RAISE EXCEPTION 'Unauthorized: Only administrators can modify roles.';
    END IF;
    IF NEW.status IS DISTINCT FROM OLD.status OR NEW.disabled IS DISTINCT FROM OLD.disabled THEN
      RAISE EXCEPTION 'Unauthorized: Only administrators can alter account status.';
    END IF;
    IF NEW.branch_id IS DISTINCT FROM OLD.branch_id OR NEW.active_branch_id IS DISTINCT FROM OLD.active_branch_id THEN
      RAISE EXCEPTION 'Unauthorized: Only administrators can modify branch assignments.';
    END IF;
  END IF;

  -- Ensure we never have 0 active super admins / admins
  IF (UPPER(OLD.role) IN ('ADMIN', 'SUPER_ADMIN') AND UPPER(NEW.role) NOT IN ('ADMIN', 'SUPER_ADMIN'))
     OR (OLD.status = 'active' AND NEW.status <> 'active') THEN
    SELECT count(*) INTO super_admin_count
    FROM public.profiles
    WHERE UPPER(role) IN ('ADMIN', 'SUPER_ADMIN')
      AND id <> OLD.id
      AND COALESCE(status, 'active') = 'active'
      AND COALESCE(disabled, false) = false;
      
    IF super_admin_count = 0 THEN
      RAISE EXCEPTION 'Operation refused: The system must retain at least one active administrator.';
    END IF;
  END IF;

  -- Keep disabled and status in sync
  IF NEW.status = 'suspended' THEN
    NEW.disabled := true;
  ELSIF NEW.status = 'active' THEN
    NEW.disabled := false;
  END IF;

  NEW.updated_at := now();
  NEW.updated_at_ms := EXTRACT(EPOCH FROM now()) * 1000;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_protect_profile_lifecycle ON public.profiles;
CREATE TRIGGER trg_protect_profile_lifecycle
BEFORE UPDATE ON public.profiles
FOR EACH ROW
EXECUTE FUNCTION public.trg_protect_profile_lifecycle();

-- 7. Ensure gackstoneb@gmail.com and bonfacewana3072@gmail.com are correctly configured
UPDATE public.profiles
SET 
  role = 'SUPER_ADMIN',
  is_super_admin = true,
  status = 'active',
  disabled = false
WHERE email = 'gackstoneb@gmail.com';

UPDATE public.profiles
SET 
  role = 'ADMIN',
  is_super_admin = false,
  status = 'active',
  disabled = false
WHERE email = 'bonfacewana3072@gmail.com';

-- 8. Enable RLS on roles, permissions, role_permissions
ALTER TABLE public.roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.permissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.role_permissions ENABLE ROW LEVEL SECURITY;

-- Grant API permissions
GRANT SELECT ON public.roles TO anon, authenticated;
GRANT SELECT ON public.permissions TO anon, authenticated;
GRANT SELECT ON public.role_permissions TO anon, authenticated;

GRANT ALL ON public.roles TO service_role;
GRANT ALL ON public.permissions TO service_role;
GRANT ALL ON public.role_permissions TO service_role;

-- Policies for roles, permissions, role_permissions: readable by all signed-in users, writable by admins
DROP POLICY IF EXISTS "roles_read" ON public.roles;
CREATE POLICY "roles_read" ON public.roles FOR SELECT USING (true);

DROP POLICY IF EXISTS "roles_admin" ON public.roles;
CREATE POLICY "roles_admin" ON public.roles FOR ALL USING (public.is_admin());

DROP POLICY IF EXISTS "permissions_read" ON public.permissions;
CREATE POLICY "permissions_read" ON public.permissions FOR SELECT USING (true);

DROP POLICY IF EXISTS "permissions_admin" ON public.permissions;
CREATE POLICY "permissions_admin" ON public.permissions FOR ALL USING (public.is_admin());

DROP POLICY IF EXISTS "role_permissions_read" ON public.role_permissions;
CREATE POLICY "role_permissions_read" ON public.role_permissions FOR SELECT USING (true);

DROP POLICY IF EXISTS "role_permissions_admin" ON public.role_permissions;
CREATE POLICY "role_permissions_admin" ON public.role_permissions FOR ALL USING (public.is_admin());
