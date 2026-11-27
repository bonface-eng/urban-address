-- =============================================================================
-- 01_extensions_and_schema.sql
-- Urban Auto Express (urban-address) — PostgreSQL / Supabase Schema
-- Idempotent creation of extensions, 55 normalized tables, constraints & indexes
-- =============================================================================

BEGIN;

CREATE EXTENSION IF NOT EXISTS "pgcrypto";
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- =============================================================================
-- GROUP 1: IDENTITY, ROLES, ADMINS & USER SUBCOLLECTIONS
-- =============================================================================

-- 1. public.admins (Replaces Firestore /admins/{email} + root super-admin list)
CREATE TABLE IF NOT EXISTS public.admins (
  email text PRIMARY KEY CHECK (email = lower(email)),
  firebase_id text UNIQUE,
  is_root boolean NOT NULL DEFAULT false,
  added_by text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- 2. public.firebase_uid_map (Reconciles legacy Firebase UIDs to Supabase Auth UUIDs)
CREATE TABLE IF NOT EXISTS public.firebase_uid_map (
  firebase_uid text PRIMARY KEY,
  supabase_user_id uuid NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  email text,
  migrated_at timestamptz NOT NULL DEFAULT now()
);

-- 3. public.profiles (Replaces Firestore /users/{uid}, linked 1:1 with auth.users)
CREATE TABLE IF NOT EXISTS public.profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  uid text NOT NULL UNIQUE,
  firebase_id text UNIQUE,
  email text NOT NULL DEFAULT '',
  display_name text NOT NULL DEFAULT 'Urban Member',
  first_name text,
  middle_name text,
  last_name text,
  role text NOT NULL DEFAULT 'CLIENT' CHECK (role IN ('ADMIN', 'MANAGER', 'SUPERVISOR', 'CASHIER', 'STOREKEEPER', 'ATTENDANT', 'KITCHEN', 'CLIENT')),
  account_type text NOT NULL DEFAULT 'CLIENT' CHECK (account_type IN ('STAFF', 'CLIENT')),
  assigned_units text[] NOT NULL DEFAULT '{}'::text[],
  branch_ids text[] NOT NULL DEFAULT '{}'::text[],
  active_branch_id text,
  photo_url text,
  phone_number text,
  address text,
  delivery_location jsonb,
  mpesa_number text,
  paystack_recipient_code text,
  must_change_password boolean NOT NULL DEFAULT false,
  base_salary numeric(12,2) NOT NULL DEFAULT 0,
  loyalty_points integer NOT NULL DEFAULT 0,
  total_spent numeric(12,2) NOT NULL DEFAULT 0,
  loyalty_reconciled_at bigint,
  loyalty_reconciliation_id text,
  seen_versions text[] NOT NULL DEFAULT '{}'::text[],
  email_verified boolean NOT NULL DEFAULT false,
  email_verified_at bigint,
  terms_accepted_at bigint,
  terms_version text,
  marketing_opt_in boolean NOT NULL DEFAULT false,
  marketing_consent boolean NOT NULL DEFAULT false,
  marketing_consent_updated_at bigint,
  marketing_consent_source text,
  preferences jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at_ms bigint NOT NULL DEFAULT (EXTRACT(EPOCH FROM now()) * 1000)::bigint,
  updated_at_ms bigint,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_profiles_role_created ON public.profiles(role, created_at_ms DESC);
CREATE INDEX IF NOT EXISTS idx_profiles_email_lower ON public.profiles(lower(email));
CREATE INDEX IF NOT EXISTS idx_profiles_assigned_units ON public.profiles USING GIN (assigned_units);
CREATE INDEX IF NOT EXISTS idx_profiles_branch_ids ON public.profiles USING GIN (branch_ids);

-- 4. public.user_held_bills (Replaces Firestore /users/{uid}/held_bills/{billId})
CREATE TABLE IF NOT EXISTS public.user_held_bills (
  id text PRIMARY KEY DEFAULT (gen_random_uuid())::text,
  firebase_id text UNIQUE,
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  cashier_uid text NOT NULL,
  type text NOT NULL CHECK (type IN ('LOUNGE', 'STORE', 'CARWASH', 'SYSTEM-REPORT')),
  job_type text CHECK (job_type IS NULL OR job_type IN ('VEHICLE', 'CARPET')),
  status text NOT NULL DEFAULT 'PENDING',
  prep_status text,
  total numeric(12,2) NOT NULL DEFAULT 0 CHECK (total >= 0),
  discount numeric(12,2) DEFAULT 0,
  tip numeric(12,2) DEFAULT 0,
  tax numeric(12,2) DEFAULT 0,
  payment_method text,
  cashier_id text,
  cashier_name text,
  terminal_id text,
  terminal_name text,
  register_session_id text,
  commission numeric(12,2) DEFAULT 0,
  customer_id text,
  customer_name text,
  customer_phone text,
  branch_id text,
  branch_name text,
  items jsonb NOT NULL DEFAULT '[]'::jsonb,
  plate_number text,
  vehicle_make text,
  vehicle_model text,
  vehicle_color text,
  table_number text,
  attendant_id text,
  attendant_name text,
  carpet_dimensions text,
  timestamp_ms bigint NOT NULL DEFAULT (EXTRACT(EPOCH FROM now()) * 1000)::bigint,
  raw_data jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_user_held_bills_user_id ON public.user_held_bills(user_id, timestamp_ms DESC);
CREATE INDEX IF NOT EXISTS idx_user_held_bills_cashier_uid ON public.user_held_bills(cashier_uid, timestamp_ms DESC);
CREATE INDEX IF NOT EXISTS idx_user_held_bills_type_status_ts ON public.user_held_bills(type, status, timestamp_ms DESC);
CREATE INDEX IF NOT EXISTS idx_user_held_bills_type_ts ON public.user_held_bills(type, timestamp_ms DESC);

-- 5. public.user_fleet (Replaces Firestore /users/{uid}/fleet/{plate})
CREATE TABLE IF NOT EXISTS public.user_fleet (
  id text PRIMARY KEY DEFAULT (gen_random_uuid())::text,
  firebase_id text UNIQUE,
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  owner_uid text NOT NULL,
  plate_number text NOT NULL,
  make text,
  model text,
  color text,
  vehicle_color text,
  last_service bigint,
  last_service_type text,
  total_services integer NOT NULL DEFAULT 0,
  loyalty_points integer NOT NULL DEFAULT 0,
  total_loyalty_spend numeric(12,2) NOT NULL DEFAULT 0,
  loyalty_reconciled_at bigint,
  loyalty_reconciliation_id text,
  raw_data jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, plate_number)
);

CREATE INDEX IF NOT EXISTS idx_user_fleet_plate ON public.user_fleet(plate_number);
CREATE INDEX IF NOT EXISTS idx_user_fleet_owner_uid ON public.user_fleet(owner_uid);

-- 6. public.user_ai_chats (Replaces Firestore /users/{uid}/ai_chats/{chatId})
CREATE TABLE IF NOT EXISTS public.user_ai_chats (
  id text PRIMARY KEY DEFAULT (gen_random_uuid())::text,
  firebase_id text UNIQUE,
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  owner_uid text NOT NULL,
  role text NOT NULL CHECK (role IN ('user', 'ai')),
  content jsonb NOT NULL,
  timestamp_ms bigint NOT NULL DEFAULT (EXTRACT(EPOCH FROM now()) * 1000)::bigint,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_user_ai_chats_user_ts ON public.user_ai_chats(user_id, timestamp_ms DESC);

-- 7. public.user_memories (Replaces Firestore /users/{uid}/memories/{memoryId})
CREATE TABLE IF NOT EXISTS public.user_memories (
  id text PRIMARY KEY DEFAULT (gen_random_uuid())::text,
  firebase_id text UNIQUE,
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  owner_uid text NOT NULL,
  key text,
  content jsonb NOT NULL DEFAULT '{}'::jsonb,
  timestamp_ms bigint NOT NULL DEFAULT (EXTRACT(EPOCH FROM now()) * 1000)::bigint,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_user_memories_user ON public.user_memories(user_id);

-- =============================================================================
-- GROUP 2: CORE POS, COMMERCE & OPERATIONS
-- =============================================================================

-- 8. public.branches (Replaces Firestore /branches/{branchId})
CREATE TABLE IF NOT EXISTS public.branches (
  id text PRIMARY KEY DEFAULT (gen_random_uuid())::text,
  firebase_id text UNIQUE,
  business_id text NOT NULL DEFAULT 'urban-address' CHECK (business_id = 'urban-address'),
  name text NOT NULL CHECK (char_length(name) > 1),
  code text NOT NULL UNIQUE,
  status text NOT NULL DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE', 'INACTIVE')),
  is_primary boolean NOT NULL DEFAULT false,
  location jsonb NOT NULL DEFAULT '{"address":"","town":"","county":"","country":"Kenya"}'::jsonb,
  phone text,
  created_by text NOT NULL DEFAULT 'SYSTEM',
  updated_by text NOT NULL DEFAULT 'SYSTEM',
  created_at_ms bigint NOT NULL DEFAULT (EXTRACT(EPOCH FROM now()) * 1000)::bigint,
  updated_at_ms bigint NOT NULL DEFAULT (EXTRACT(EPOCH FROM now()) * 1000)::bigint,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_branches_status ON public.branches(status, created_at_ms ASC);

-- 9. public.inventory (Replaces Firestore /inventory/{productId})
CREATE TABLE IF NOT EXISTS public.inventory (
  id text PRIMARY KEY DEFAULT (gen_random_uuid())::text,
  firebase_id text UNIQUE,
  name text NOT NULL,
  category text NOT NULL,
  price numeric(12,2) NOT NULL DEFAULT 0 CHECK (price >= 0),
  cost_price numeric(12,2) DEFAULT 0,
  stock_level numeric(12,2) NOT NULL DEFAULT 0,
  min_stock numeric(12,2) NOT NULL DEFAULT 0,
  barcode text,
  unit text NOT NULL CHECK (unit IN ('LOUNGE', 'STORE', 'CARWASH')),
  branch_id text REFERENCES public.branches(id) ON DELETE SET NULL,
  branch_name text,
  image text,
  size numeric(12,2),
  size_unit text,
  commission numeric(12,2) DEFAULT 0,
  commission_night_shift numeric(12,2) DEFAULT 0,
  last_counted_stock numeric(12,2),
  last_counted_at bigint,
  last_counted_by text,
  archived boolean NOT NULL DEFAULT false,
  stock_adjusted_by_telegram_id text,
  created_at_ms bigint NOT NULL DEFAULT (EXTRACT(EPOCH FROM now()) * 1000)::bigint,
  updated_at_ms bigint,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_inventory_unit_name ON public.inventory(unit, archived, name ASC);
CREATE INDEX IF NOT EXISTS idx_inventory_category ON public.inventory(category);
CREATE INDEX IF NOT EXISTS idx_inventory_barcode ON public.inventory(barcode) WHERE barcode IS NOT NULL;

-- 10. public.inventory_backups (Replaces Firestore /inventory_backups/{backupId})
CREATE TABLE IF NOT EXISTS public.inventory_backups (
  id text PRIMARY KEY DEFAULT (gen_random_uuid())::text,
  firebase_id text UNIQUE,
  items jsonb NOT NULL DEFAULT '[]'::jsonb,
  item_count integer NOT NULL DEFAULT 0,
  created_by text NOT NULL,
  created_by_name text,
  timestamp_ms bigint NOT NULL DEFAULT (EXTRACT(EPOCH FROM now()) * 1000)::bigint,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_inventory_backups_ts ON public.inventory_backups(timestamp_ms DESC);

-- 11. public.pos_terminals (Replaces Firestore /pos_terminals/{id})
CREATE TABLE IF NOT EXISTS public.pos_terminals (
  id text PRIMARY KEY DEFAULT (gen_random_uuid())::text,
  firebase_id text UNIQUE,
  name text NOT NULL,
  unit text NOT NULL CHECK (unit IN ('LOUNGE', 'STORE', 'CARWASH')),
  branch_id text REFERENCES public.branches(id) ON DELETE SET NULL,
  branch_name text,
  status text NOT NULL DEFAULT 'CLOSED' CHECK (status IN ('OPEN', 'CLOSED')),
  current_cashier_id text,
  current_cashier_name text,
  current_register_session_id text,
  last_active bigint NOT NULL DEFAULT (EXTRACT(EPOCH FROM now()) * 1000)::bigint,
  disabled boolean NOT NULL DEFAULT false,
  locked boolean NOT NULL DEFAULT false,
  locked_at bigint,
  locked_by_telegram_id text,
  force_lock_at bigint,
  force_lock_reason text,
  closing_cash numeric(12,2),
  session_ended_at bigint,
  session_ended_by_telegram_id text,
  created_at_ms bigint NOT NULL DEFAULT (EXTRACT(EPOCH FROM now()) * 1000)::bigint,
  updated_at_ms bigint,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- 12. public.register_sessions (Replaces Firestore /register_sessions/{id})
CREATE TABLE IF NOT EXISTS public.register_sessions (
  id text PRIMARY KEY DEFAULT (gen_random_uuid())::text,
  firebase_id text UNIQUE,
  terminal_id text NOT NULL,
  branch_id text REFERENCES public.branches(id) ON DELETE SET NULL,
  opened_at bigint NOT NULL DEFAULT (EXTRACT(EPOCH FROM now()) * 1000)::bigint,
  closed_at bigint,
  opening_cash numeric(12,2) NOT NULL DEFAULT 0,
  closing_cash numeric(12,2),
  expected_cash numeric(12,2),
  variance numeric(12,2),
  reconciliation_id text,
  status text NOT NULL DEFAULT 'OPEN' CHECK (status IN ('OPEN', 'CLOSED')),
  manager_id text NOT NULL,
  cashier_id text,
  cashier_name text,
  closed_by_telegram_id text,
  close_reason text,
  close_source text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_register_sessions_terminal ON public.register_sessions(terminal_id, status);

-- 13. public.reconciliations (Replaces Firestore /reconciliations/{id})
CREATE TABLE IF NOT EXISTS public.reconciliations (
  id text PRIMARY KEY DEFAULT (gen_random_uuid())::text,
  firebase_id text UNIQUE,
  user_id text NOT NULL,
  actor_type text,
  telegram_user_id text,
  register_session_id text,
  terminal_id text,
  branch_id text,
  cashier_id text,
  expected_cash numeric(12,2) NOT NULL DEFAULT 0,
  actual_cash numeric(12,2) NOT NULL DEFAULT 0,
  variance numeric(12,2) NOT NULL DEFAULT 0,
  status text NOT NULL CHECK (status IN ('STABLE', 'DISCREPANCY')),
  notes text,
  timestamp_ms bigint NOT NULL DEFAULT (EXTRACT(EPOCH FROM now()) * 1000)::bigint,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_reconciliations_ts ON public.reconciliations(timestamp_ms DESC);

-- 14. public.orders (Replaces Firestore /orders/{orderId})
CREATE TABLE IF NOT EXISTS public.orders (
  id text PRIMARY KEY DEFAULT (gen_random_uuid())::text,
  firebase_id text UNIQUE,
  type text NOT NULL CHECK (type IN ('LOUNGE', 'STORE', 'CARWASH', 'SYSTEM-REPORT')),
  job_type text CHECK (job_type IS NULL OR job_type IN ('VEHICLE', 'CARPET')),
  status text NOT NULL DEFAULT 'PENDING' CHECK (status IN ('PENDING', 'PAID', 'VOIDED', 'REFUNDED', 'PARTIALLY_REFUNDED', 'CANCELLED', 'UNPAID', 'AWAITING_PAYMENT')),
  prep_status text CHECK (prep_status IS NULL OR prep_status IN ('NEW', 'PREPARING', 'READY', 'SERVED')),
  kitchen_status text,
  total numeric(12,2) NOT NULL DEFAULT 0 CHECK (total >= 0),
  discount numeric(12,2) DEFAULT 0,
  tip numeric(12,2) DEFAULT 0,
  tax numeric(12,2) DEFAULT 0,
  payment_method text,
  cashier_id text,
  cashier_name text,
  terminal_id text,
  terminal_name text,
  register_session_id text,
  commission numeric(12,2) DEFAULT 0,
  customer_id text,
  customer_name text,
  customer_email text,
  customer_phone text,
  fulfilment text CHECK (fulfilment IS NULL OR fulfilment IN ('DELIVERY', 'PICKUP')),
  delivery_address text,
  delivery_location jsonb,
  branch_id text REFERENCES public.branches(id) ON DELETE SET NULL,
  branch_name text,
  payment_status text CHECK (payment_status IS NULL OR payment_status IN ('AWAITING_PAYMENT', 'PAID', 'FAILED', 'REFUNDED')),
  payment_provider text CHECK (payment_provider IS NULL OR payment_provider IN ('MPESA', 'AIRTEL_MONEY', 'PAYSTACK')),
  payment_ref text,
  payment_receipt text,
  provider_transaction_id text,
  payment_phone text,
  paid_phone text,
  payment_amount numeric(12,2),
  amount_kobo bigint,
  amount_currency text DEFAULT 'KES',
  checkout_request_id text,
  merchant_request_id text,
  airtel_transaction_id text,
  payment_initiated_at bigint,
  payment_failure_reason text,
  payment_failed_at bigint,
  gateway_response text,
  inventory_synced boolean NOT NULL DEFAULT false,
  paid_at bigint,
  refunded_at bigint,
  refunded_amount numeric(12,2),
  refund_total numeric(12,2),
  refund_approval_status text,
  refund_approval_request_id text,
  refund_approved_at bigint,
  cancelled_at bigint,
  cash_tendered numeric(12,2),
  change_due numeric(12,2),
  scheduled_date text,
  scheduled_time text,
  timestamp_ms bigint NOT NULL DEFAULT (EXTRACT(EPOCH FROM now()) * 1000)::bigint,
  updated_at_ms bigint,
  kitchen_updated_at bigint,
  served_at bigint,
  items jsonb NOT NULL DEFAULT '[]'::jsonb,
  plate_number text,
  vehicle_make text,
  vehicle_model text,
  vehicle_color text,
  table_number text,
  attendant_id text,
  attendant_name text,
  carpet_dimensions text,
  raw_data jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Indexes matching firestore.indexes.json + webhook lookups
CREATE INDEX IF NOT EXISTS idx_orders_type_status_ts ON public.orders(type, status, timestamp_ms DESC);
CREATE INDEX IF NOT EXISTS idx_orders_status_ts ON public.orders(status, timestamp_ms DESC);
CREATE INDEX IF NOT EXISTS idx_orders_type_cashier_status_ts ON public.orders(type, cashier_id, status, timestamp_ms DESC);
CREATE INDEX IF NOT EXISTS idx_orders_customer_ts ON public.orders(customer_id, timestamp_ms DESC);
CREATE INDEX IF NOT EXISTS idx_orders_type_ts ON public.orders(type, timestamp_ms DESC);
CREATE INDEX IF NOT EXISTS idx_orders_payment_status_ts ON public.orders(payment_method, status, timestamp_ms ASC);
CREATE INDEX IF NOT EXISTS idx_orders_register_session ON public.orders(register_session_id);
CREATE INDEX IF NOT EXISTS idx_orders_checkout_request_id ON public.orders(checkout_request_id) WHERE checkout_request_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_orders_airtel_tx_id ON public.orders(airtel_transaction_id) WHERE airtel_transaction_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_orders_payment_ref ON public.orders(payment_ref) WHERE payment_ref IS NOT NULL;

-- 15. public.order_items (Normalized line items from orders.items[])
CREATE TABLE IF NOT EXISTS public.order_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id text NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  item_index integer NOT NULL DEFAULT 0,
  product_id text,
  name text NOT NULL,
  category text,
  price numeric(12,2) NOT NULL DEFAULT 0,
  quantity numeric(12,2) NOT NULL DEFAULT 1,
  notes text,
  status text DEFAULT 'COMMITTED',
  commission numeric(12,2) DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_order_items_order_id ON public.order_items(order_id);
CREATE INDEX IF NOT EXISTS idx_order_items_product_id ON public.order_items(product_id);

-- 16. public.carwash_jobs (Replaces Firestore /carwash_jobs/{jobId})
CREATE TABLE IF NOT EXISTS public.carwash_jobs (
  id text PRIMARY KEY DEFAULT (gen_random_uuid())::text,
  firebase_id text UNIQUE,
  order_id text,
  job_type text DEFAULT 'VEHICLE' CHECK (job_type IN ('VEHICLE', 'CARPET')),
  plate_number text NOT NULL,
  vehicle_make text,
  vehicle_model text,
  vehicle_color text,
  service text NOT NULL,
  status text NOT NULL DEFAULT 'QUEUED' CHECK (status IN ('QUEUED', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED')),
  attendant_id text NOT NULL DEFAULT 'Unassigned',
  attendant_name text NOT NULL DEFAULT 'Unassigned',
  price numeric(12,2) NOT NULL DEFAULT 0,
  tip numeric(12,2) DEFAULT 0,
  commission numeric(12,2) NOT NULL DEFAULT 0,
  customer_id text,
  valet_service text,
  is_valet boolean DEFAULT false,
  address text,
  coordinates jsonb,
  booking_date text,
  booking_time text,
  carpet_dimensions text,
  timestamp_ms bigint NOT NULL DEFAULT (EXTRACT(EPOCH FROM now()) * 1000)::bigint,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_carwash_jobs_status_ts ON public.carwash_jobs(status, timestamp_ms DESC);
CREATE INDEX IF NOT EXISTS idx_carwash_jobs_ts ON public.carwash_jobs(timestamp_ms DESC);
CREATE INDEX IF NOT EXISTS idx_carwash_jobs_attendant ON public.carwash_jobs(attendant_id);
CREATE INDEX IF NOT EXISTS idx_carwash_jobs_customer ON public.carwash_jobs(customer_id);

-- 17. public.vehicles (Replaces Firestore /vehicles/{plate})
CREATE TABLE IF NOT EXISTS public.vehicles (
  id text PRIMARY KEY, -- Normalized plate number
  firebase_id text UNIQUE,
  plate_number text NOT NULL UNIQUE,
  make text,
  model text,
  color text,
  last_seen bigint,
  loyalty_points integer NOT NULL DEFAULT 0,
  total_loyalty_spend numeric(12,2) NOT NULL DEFAULT 0,
  loyalty_customer_id text,
  loyalty_reconciled_at bigint,
  loyalty_reconciliation_id text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- 18. public.petty_cash (Replaces Firestore /petty_cash/{requestId})
CREATE TABLE IF NOT EXISTS public.petty_cash (
  id text PRIMARY KEY DEFAULT (gen_random_uuid())::text,
  firebase_id text UNIQUE,
  amount numeric(12,2) NOT NULL CHECK (amount >= 0),
  reason text NOT NULL,
  status text NOT NULL DEFAULT 'PENDING' CHECK (status IN ('PENDING', 'APPROVED', 'DENIED', 'REJECTED')),
  requester_id text NOT NULL,
  requester_name text NOT NULL,
  branch_id text,
  approved_by text,
  approved_at bigint,
  denied_by text,
  denied_at bigint,
  denial_reason text,
  timestamp_ms bigint NOT NULL DEFAULT (EXTRACT(EPOCH FROM now()) * 1000)::bigint,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_petty_cash_status_ts ON public.petty_cash(status, timestamp_ms DESC);

-- 19. public.salary_advances (Replaces Firestore /salary_advances/{id})
CREATE TABLE IF NOT EXISTS public.salary_advances (
  id text PRIMARY KEY DEFAULT (gen_random_uuid())::text,
  firebase_id text UNIQUE,
  staff_id text NOT NULL,
  staff_name text NOT NULL,
  amount numeric(12,2) NOT NULL CHECK (amount >= 0),
  reason text,
  status text DEFAULT 'APPROVED',
  approved_by text,
  timestamp_ms bigint NOT NULL DEFAULT (EXTRACT(EPOCH FROM now()) * 1000)::bigint,
  raw_data jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_salary_advances_ts ON public.salary_advances(timestamp_ms DESC);

-- 20. public.suppliers (Replaces Firestore /suppliers/{supplierId})
CREATE TABLE IF NOT EXISTS public.suppliers (
  id text PRIMARY KEY DEFAULT (gen_random_uuid())::text,
  firebase_id text UNIQUE,
  name text NOT NULL,
  contact_person text NOT NULL,
  phone text NOT NULL,
  email text,
  category text NOT NULL,
  status text NOT NULL DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE', 'INACTIVE')),
  created_at_ms bigint NOT NULL DEFAULT (EXTRACT(EPOCH FROM now()) * 1000)::bigint,
  updated_at_ms bigint,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_suppliers_name ON public.suppliers(name ASC);

-- 21. public.digital_menus (Replaces Firestore /digitalMenus/{menuId})
CREATE TABLE IF NOT EXISTS public.digital_menus (
  id text PRIMARY KEY DEFAULT 'main',
  firebase_id text UNIQUE,
  status text NOT NULL DEFAULT 'DRAFT' CHECK (status IN ('DRAFT', 'PUBLISHED')),
  headline text NOT NULL DEFAULT 'Freshly prepared. Made for you.',
  promotion text NOT NULL DEFAULT '',
  rotation_seconds integer NOT NULL DEFAULT 14,
  template text NOT NULL DEFAULT 'GRID' CHECK (template IN ('HERO', 'GRID', 'EDITORIAL')),
  items jsonb NOT NULL DEFAULT '[]'::jsonb,
  updated_at_ms bigint NOT NULL DEFAULT (EXTRACT(EPOCH FROM now()) * 1000)::bigint,
  updated_by text NOT NULL DEFAULT 'SYSTEM',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- =============================================================================
-- GROUP 3: CUSTOMER EXPERIENCE, CONFIG, TELEMETRY & LIVE AUDIO
-- =============================================================================

-- 22. public.reviews (Replaces Firestore /reviews/{reviewId})
CREATE TABLE IF NOT EXISTS public.reviews (
  id text PRIMARY KEY DEFAULT (gen_random_uuid())::text,
  firebase_id text UNIQUE,
  user_id text NOT NULL,
  user_name text NOT NULL,
  user_photo text,
  rating integer NOT NULL CHECK (rating >= 1 AND rating <= 5),
  comment text NOT NULL,
  timestamp_ms bigint NOT NULL DEFAULT (EXTRACT(EPOCH FROM now()) * 1000)::bigint,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_reviews_ts ON public.reviews(timestamp_ms DESC);

-- 23. public.support_queries (Replaces Firestore /support_queries/{id})
CREATE TABLE IF NOT EXISTS public.support_queries (
  id text PRIMARY KEY DEFAULT (gen_random_uuid())::text,
  firebase_id text UNIQUE,
  name text NOT NULL CHECK (char_length(name) BETWEEN 2 AND 120),
  email text NOT NULL CHECK (char_length(email) <= 254),
  phone text,
  subject text NOT NULL CHECK (char_length(subject) BETWEEN 2 AND 160),
  message text NOT NULL CHECK (char_length(message) BETWEEN 5 AND 5000),
  status text NOT NULL DEFAULT 'OPEN',
  resolved_at bigint,
  timestamp_ms bigint NOT NULL DEFAULT (EXTRACT(EPOCH FROM now()) * 1000)::bigint,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_support_queries_ts ON public.support_queries(timestamp_ms DESC);

-- 24. public.notifications (Replaces Firestore /notifications/{notifId})
CREATE TABLE IF NOT EXISTS public.notifications (
  id text PRIMARY KEY DEFAULT (gen_random_uuid())::text,
  firebase_id text UNIQUE,
  user_id text NOT NULL,
  title text NOT NULL,
  message text NOT NULL,
  type text DEFAULT 'INFO',
  read boolean NOT NULL DEFAULT false,
  timestamp_ms bigint NOT NULL DEFAULT (EXTRACT(EPOCH FROM now()) * 1000)::bigint,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_notifications_user_ts ON public.notifications(user_id, timestamp_ms DESC);

-- 25. public.app_releases (Replaces Firestore /app_releases/{releaseId})
CREATE TABLE IF NOT EXISTS public.app_releases (
  id text PRIMARY KEY DEFAULT (gen_random_uuid())::text,
  firebase_id text UNIQUE,
  version text NOT NULL,
  apk_url text NOT NULL,
  apk_size text,
  screenshots jsonb NOT NULL DEFAULT '{"landing":"","shop":"","cart":""}'::jsonb,
  is_latest boolean NOT NULL DEFAULT true,
  updated_by text,
  updated_at_ms bigint NOT NULL DEFAULT (EXTRACT(EPOCH FROM now()) * 1000)::bigint,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_app_releases_updated ON public.app_releases(updated_at_ms DESC);

-- 26. public.settings (Replaces Firestore /settings/{configId})
CREATE TABLE IF NOT EXISTS public.settings (
  id text PRIMARY KEY,
  firebase_id text UNIQUE,
  data jsonb NOT NULL DEFAULT '{}'::jsonb,
  updated_by text,
  updated_at_ms bigint NOT NULL DEFAULT (EXTRACT(EPOCH FROM now()) * 1000)::bigint,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- 27. public.system_config (Replaces Firestore /system/{document}: permissions, config, ping)
CREATE TABLE IF NOT EXISTS public.system_config (
  id text PRIMARY KEY,
  firebase_id text UNIQUE,
  data jsonb NOT NULL DEFAULT '{}'::jsonb,
  updated_at_ms bigint NOT NULL DEFAULT (EXTRACT(EPOCH FROM now()) * 1000)::bigint,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- 28. public.live_audio_sessions (Replaces Firestore /live_audio_sessions/{sessionId})
CREATE TABLE IF NOT EXISTS public.live_audio_sessions (
  id text PRIMARY KEY DEFAULT (gen_random_uuid())::text,
  firebase_id text UNIQUE,
  terminal_id text NOT NULL,
  terminal_name text,
  cashier_id text NOT NULL,
  cashier_name text,
  requested_by text NOT NULL,
  requested_by_name text,
  status text NOT NULL DEFAULT 'REQUESTED' CHECK (status IN ('REQUESTED', 'ACCEPTED', 'DECLINED', 'ENDED')),
  offer jsonb,
  answer jsonb,
  created_at_ms bigint NOT NULL DEFAULT (EXTRACT(EPOCH FROM now()) * 1000)::bigint,
  accepted_at bigint,
  accepted_by text,
  declined_at bigint,
  declined_by text,
  ended_at bigint,
  ended_by text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_live_audio_sessions_status ON public.live_audio_sessions(status);
CREATE INDEX IF NOT EXISTS idx_live_audio_sessions_cashier ON public.live_audio_sessions(cashier_id, status);

-- 29. public.live_audio_candidates (Replaces subcollections admin_candidates & staff_candidates)
CREATE TABLE IF NOT EXISTS public.live_audio_candidates (
  id text PRIMARY KEY DEFAULT (gen_random_uuid())::text,
  firebase_id text UNIQUE,
  session_id text NOT NULL REFERENCES public.live_audio_sessions(id) ON DELETE CASCADE,
  sender_role text NOT NULL CHECK (sender_role IN ('ADMIN', 'STAFF')),
  candidate jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_live_audio_candidates_session ON public.live_audio_candidates(session_id, sender_role);

-- 30. public.account_deletion_requests (Replaces Firestore /account_deletion_requests/{requestId})
CREATE TABLE IF NOT EXISTS public.account_deletion_requests (
  id text PRIMARY KEY DEFAULT (gen_random_uuid())::text,
  firebase_id text UNIQUE,
  user_id text NOT NULL,
  email text NOT NULL,
  display_name text NOT NULL,
  requested_at bigint NOT NULL DEFAULT (EXTRACT(EPOCH FROM now()) * 1000)::bigint,
  status text NOT NULL DEFAULT 'PENDING' CHECK (status IN ('PENDING', 'APPROVED', 'REJECTED')),
  source text NOT NULL DEFAULT 'CUSTOMER_PROFILE',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- 31. public.audit_logs (Replaces Firestore /audit_logs/{logId})
CREATE TABLE IF NOT EXISTS public.audit_logs (
  id text PRIMARY KEY DEFAULT (gen_random_uuid())::text,
  firebase_id text UNIQUE,
  action text NOT NULL,
  user_id text,
  actor_id text,
  actor_name text,
  actor_type text,
  telegram_user_id text,
  terminal_id text,
  device_id text,
  role text,
  from_path text,
  to_path text,
  details text NOT NULL,
  severity text NOT NULL DEFAULT 'INFO' CHECK (severity IN ('INFO', 'WARNING', 'CRITICAL')),
  timestamp_ms bigint NOT NULL DEFAULT (EXTRACT(EPOCH FROM now()) * 1000)::bigint,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_audit_logs_ts ON public.audit_logs(timestamp_ms DESC, id ASC);
CREATE INDEX IF NOT EXISTS idx_audit_logs_action_ts ON public.audit_logs(action, timestamp_ms DESC);

-- 32. public.system_incidents (Replaces Firestore /system_incidents/{incidentId})
CREATE TABLE IF NOT EXISTS public.system_incidents (
  id text PRIMARY KEY DEFAULT (gen_random_uuid())::text,
  firebase_id text UNIQUE,
  incident_id text NOT NULL CHECK (char_length(incident_id) <= 80),
  category text NOT NULL CHECK (category IN ('CLIENT_ERROR', 'UNHANDLED_REJECTION', 'FIRESTORE_PERMISSION', 'SUPABASE_PERMISSION', 'TELEGRAM_REPORTED', 'EMERGENCY_ALERT')),
  message text NOT NULL CHECK (char_length(message) <= 500),
  route text NOT NULL CHECK (char_length(route) <= 160),
  status text NOT NULL DEFAULT 'OPEN' CHECK (status IN ('OPEN', 'ACKNOWLEDGED', 'RESOLVED')),
  severity text DEFAULT 'WARNING',
  created_at_ms bigint NOT NULL DEFAULT (EXTRACT(EPOCH FROM now()) * 1000)::bigint,
  user_id text NOT NULL,
  user_agent text NOT NULL CHECK (char_length(user_agent) <= 180),
  branch_id text,
  created_by_telegram_id text,
  acknowledged_at bigint,
  acknowledged_by text,
  resolved_at bigint,
  resolved_by text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_system_incidents_status_created ON public.system_incidents(status, created_at_ms DESC);

-- =============================================================================
-- GROUP 4: SERVER-ONLY TABLES (OTPs, PINs, Email, Telegram, Rate Limits, Caches)
-- =============================================================================

-- 33. public.terminal_devices (Replaces Firestore /terminal_devices/{deviceId})
CREATE TABLE IF NOT EXISTS public.terminal_devices (
  id text PRIMARY KEY,
  firebase_id text UNIQUE,
  name text,
  terminal_name text,
  label text,
  disabled boolean NOT NULL DEFAULT false,
  disabled_at bigint,
  disabled_by_telegram_id text,
  updated_at_ms bigint,
  updated_by text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- 34. public.terminal_device_staff (Replaces /terminal_devices/{deviceId}/staff_members/{uid})
CREATE TABLE IF NOT EXISTS public.terminal_device_staff (
  id text PRIMARY KEY DEFAULT (gen_random_uuid())::text,
  firebase_id text UNIQUE,
  device_id text NOT NULL REFERENCES public.terminal_devices(id) ON DELETE CASCADE,
  uid text NOT NULL,
  display_name text NOT NULL,
  email text NOT NULL,
  role text NOT NULL,
  photo_url text,
  disclaimer_version text,
  disclaimer_acknowledged_at timestamptz,
  pin_salt text,
  pin_hash text,
  pin_updated_at timestamptz,
  pin_reset_at timestamptz,
  registered_at timestamptz NOT NULL DEFAULT now(),
  last_seen_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (device_id, uid)
);

-- 35. public.terminal_pin_attempts (Replaces /terminal_pin_attempts/{uid})
CREATE TABLE IF NOT EXISTS public.terminal_pin_attempts (
  id text PRIMARY KEY, -- targetUid
  firebase_id text UNIQUE,
  failures integer NOT NULL DEFAULT 0,
  blocked_until bigint NOT NULL DEFAULT 0,
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- 36. public.terminal_pin_reset_otps (Replaces /terminal_pin_reset_otps/{uid})
CREATE TABLE IF NOT EXISTS public.terminal_pin_reset_otps (
  id text PRIMARY KEY, -- targetUid
  firebase_id text UNIQUE,
  code_hash text,
  device_id text NOT NULL,
  created_at_ms bigint NOT NULL,
  last_sent_at bigint NOT NULL,
  expires_at bigint NOT NULL,
  attempts integer NOT NULL DEFAULT 0,
  last_attempt_at bigint,
  consumed_at bigint,
  hour bigint NOT NULL,
  hourly_count integer NOT NULL DEFAULT 1,
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- 37. public.terminal_sessions (Tracks active PIN-authenticated POS sessions)
CREATE TABLE IF NOT EXISTS public.terminal_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  device_id text NOT NULL,
  target_uid text NOT NULL,
  actor_uid text NOT NULL,
  expires_at timestamptz NOT NULL DEFAULT (now() + interval '12 hours'),
  created_at timestamptz NOT NULL DEFAULT now()
);

-- 38. public.email_verification_otps (Replaces /email_verification_otps/{uid})
CREATE TABLE IF NOT EXISTS public.email_verification_otps (
  id text PRIMARY KEY, -- uid
  firebase_id text UNIQUE,
  code_hash text NOT NULL,
  created_at_ms bigint NOT NULL,
  last_sent_at bigint NOT NULL,
  expires_at bigint NOT NULL,
  attempts integer NOT NULL DEFAULT 0,
  consumed_at bigint,
  hour bigint NOT NULL,
  hourly_count integer NOT NULL DEFAULT 1,
  updated_at_ms bigint,
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- 39. public.admin_daily_otps (Replaces /admin_daily_otps/{uid})
CREATE TABLE IF NOT EXISTS public.admin_daily_otps (
  id text PRIMARY KEY, -- uid
  firebase_id text UNIQUE,
  day text NOT NULL,
  code_hash text NOT NULL,
  sent_at bigint NOT NULL,
  expires_at bigint NOT NULL,
  attempts integer NOT NULL DEFAULT 0,
  consumed_at bigint,
  verified_at bigint,
  updated_at_ms bigint,
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- 40. public.email_rate_limits (Replaces /email_rate_limits/{limitId})
CREATE TABLE IF NOT EXISTS public.email_rate_limits (
  id text PRIMARY KEY,
  firebase_id text UNIQUE,
  count integer NOT NULL DEFAULT 0,
  window_started_at bigint NOT NULL DEFAULT 0,
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- 41. public.email_preferences (Replaces /email_preferences/{emailHash})
CREATE TABLE IF NOT EXISTS public.email_preferences (
  id text PRIMARY KEY, -- sha256(lowercase email)
  firebase_id text UNIQUE,
  email text NOT NULL,
  marketing_unsubscribed boolean NOT NULL DEFAULT false,
  marketing_preference_updated_at bigint,
  unsubscribed_at text,
  source text,
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- 42. public.email_outbox (Replaces /email_outbox/{outboxId})
CREATE TABLE IF NOT EXISTS public.email_outbox (
  id text PRIMARY KEY,
  firebase_id text UNIQUE,
  type text NOT NULL,
  order_id text NOT NULL,
  status text NOT NULL DEFAULT 'PENDING',
  attempt_count integer NOT NULL DEFAULT 0,
  lease_until bigint,
  sent_at bigint,
  skip_reason text,
  last_error text,
  created_at_ms bigint NOT NULL DEFAULT (EXTRACT(EPOCH FROM now()) * 1000)::bigint,
  updated_at_ms bigint,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- 43. public.email_campaigns (Replaces /email_campaigns/{campaignId})
CREATE TABLE IF NOT EXISTS public.email_campaigns (
  id text PRIMARY KEY DEFAULT (gen_random_uuid())::text,
  firebase_id text UNIQUE,
  kind text NOT NULL,
  audience text NOT NULL,
  subject text NOT NULL,
  heading text NOT NULL,
  reference text,
  recipient_count integer NOT NULL DEFAULT 0,
  sent_count integer NOT NULL DEFAULT 0,
  failed_count integer NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'SENDING',
  created_by text NOT NULL,
  created_by_email text,
  created_at_ms bigint NOT NULL DEFAULT (EXTRACT(EPOCH FROM now()) * 1000)::bigint,
  updated_at_ms bigint,
  completed_at bigint,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_email_campaigns_created ON public.email_campaigns(created_at_ms DESC);

-- 44. public.email_messages (Replaces /email_messages/{messageId})
CREATE TABLE IF NOT EXISTS public.email_messages (
  id text PRIMARY KEY DEFAULT (gen_random_uuid())::text,
  firebase_id text UNIQUE,
  campaign_id text REFERENCES public.email_campaigns(id) ON DELETE SET NULL,
  provider_email_id text,
  recipient_email text NOT NULL,
  recipient_name text,
  subject text NOT NULL,
  kind text NOT NULL,
  body_text text,
  body_html text,
  status text NOT NULL DEFAULT 'SENT',
  sent_at bigint NOT NULL DEFAULT (EXTRACT(EPOCH FROM now()) * 1000)::bigint,
  created_by text,
  created_by_email text,
  last_event text,
  last_event_at bigint,
  event_history text[] NOT NULL DEFAULT '{}'::text[],
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_email_messages_sent_at ON public.email_messages(sent_at DESC);
CREATE INDEX IF NOT EXISTS idx_email_messages_provider_id ON public.email_messages(provider_email_id) WHERE provider_email_id IS NOT NULL;

-- 45. public.email_replies (Replaces /email_replies/{replyId})
CREATE TABLE IF NOT EXISTS public.email_replies (
  id text PRIMARY KEY DEFAULT (gen_random_uuid())::text,
  firebase_id text UNIQUE,
  provider_email_id text,
  from_address text NOT NULL,
  to_addresses text[] NOT NULL DEFAULT '{}'::text[],
  subject text NOT NULL,
  text_body text,
  html_body text,
  received_at bigint NOT NULL DEFAULT (EXTRACT(EPOCH FROM now()) * 1000)::bigint,
  status text NOT NULL DEFAULT 'RECEIVED',
  message_id text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_email_replies_received_at ON public.email_replies(received_at DESC);

-- 46. public.resend_webhook_events (Replaces /resend_webhook_events/{svixId})
CREATE TABLE IF NOT EXISTS public.resend_webhook_events (
  id text PRIMARY KEY, -- svix-id
  firebase_id text UNIQUE,
  type text NOT NULL,
  received_at bigint NOT NULL,
  processed boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- 47. public.privacy_consent (Replaces /privacyConsent/{consentId})
CREATE TABLE IF NOT EXISTS public.privacy_consent (
  id text PRIMARY KEY,
  firebase_id text UNIQUE,
  policy_version integer NOT NULL DEFAULT 1,
  categories jsonb NOT NULL,
  action text NOT NULL,
  source text NOT NULL DEFAULT 'website_cookie_banner',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- 48. public.maps_geocode_cache (Replaces /maps_geocode_cache/{cacheKey})
CREATE TABLE IF NOT EXISTS public.maps_geocode_cache (
  id text PRIMARY KEY,
  firebase_id text UNIQUE,
  result jsonb NOT NULL,
  expires_at bigint NOT NULL,
  updated_at_ms bigint NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- 49. public.loyalty_reconciliations (Replaces /loyalty_reconciliations/{migrationId})
CREATE TABLE IF NOT EXISTS public.loyalty_reconciliations (
  id text PRIMARY KEY,
  firebase_id text UNIQUE,
  migration_id text NOT NULL,
  preview_hash text,
  point_rate text,
  summary jsonb,
  status text NOT NULL,
  started_at bigint,
  started_by text,
  applied_at bigint,
  applied_by text,
  customer_count integer,
  plate_count integer,
  failed_at bigint,
  failure_note text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- 50. public.refund_requests (Replaces /refund_requests/{requestId})
CREATE TABLE IF NOT EXISTS public.refund_requests (
  id text PRIMARY KEY DEFAULT (gen_random_uuid())::text,
  firebase_id text UNIQUE,
  order_id text NOT NULL,
  amount numeric(12,2) NOT NULL CHECK (amount > 0),
  reason text NOT NULL,
  status text NOT NULL DEFAULT 'PENDING',
  decision text,
  branch_id text,
  branch_name text,
  order_total numeric(12,2),
  payment_method text,
  requested_by_telegram_id text,
  requested_by text,
  created_at_ms bigint NOT NULL DEFAULT (EXTRACT(EPOCH FROM now()) * 1000)::bigint,
  decided_at bigint,
  decided_by_telegram_id text,
  decided_by text,
  source text DEFAULT 'TELEGRAM',
  decision_source text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_refund_requests_order ON public.refund_requests(order_id);
CREATE INDEX IF NOT EXISTS idx_refund_requests_status ON public.refund_requests(status, created_at_ms DESC);

-- 51. public.stock_adjustment_requests (Replaces /stock_adjustment_requests/{requestId})
CREATE TABLE IF NOT EXISTS public.stock_adjustment_requests (
  id text PRIMARY KEY DEFAULT (gen_random_uuid())::text,
  firebase_id text UNIQUE,
  product_id text NOT NULL,
  product_name text NOT NULL,
  before_stock numeric(12,2) NOT NULL,
  after_stock numeric(12,2) NOT NULL,
  delta numeric(12,2) NOT NULL,
  reason text NOT NULL,
  unit text,
  branch_id text,
  requested_by_telegram_id text,
  requested_by text,
  status text NOT NULL DEFAULT 'PENDING',
  created_at_ms bigint NOT NULL DEFAULT (EXTRACT(EPOCH FROM now()) * 1000)::bigint,
  decided_at bigint,
  decided_by_telegram_id text,
  decided_by text,
  source text DEFAULT 'TELEGRAM',
  decision_source text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_stock_adj_requests_status ON public.stock_adjustment_requests(status, created_at_ms DESC);

-- 52. public.staff_navigation_state (Replaces /staff_navigation_state/{uid})
CREATE TABLE IF NOT EXISTS public.staff_navigation_state (
  id text PRIMARY KEY, -- uid
  firebase_id text UNIQUE,
  last_path text NOT NULL,
  last_at bigint NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- 53. public.staff_navigation_logs (Replaces /staff_navigation_logs/{logId})
CREATE TABLE IF NOT EXISTS public.staff_navigation_logs (
  id text PRIMARY KEY DEFAULT (gen_random_uuid())::text,
  firebase_id text UNIQUE,
  user_id text NOT NULL,
  staff_name text NOT NULL,
  role text NOT NULL,
  from_path text NOT NULL,
  to_path text NOT NULL,
  terminal_device_id text,
  created_at_ms bigint NOT NULL DEFAULT (EXTRACT(EPOCH FROM now()) * 1000)::bigint,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- 54. public.system_audit_logs (Replaces /system_audit_logs/{logId})
CREATE TABLE IF NOT EXISTS public.system_audit_logs (
  id text PRIMARY KEY DEFAULT (gen_random_uuid())::text,
  firebase_id text UNIQUE,
  action text NOT NULL,
  actor_uid text,
  actor_email text,
  actor_name text,
  actor_type text,
  target_type text,
  target_id text,
  details jsonb,
  event_id text,
  webhook_url text,
  severity text DEFAULT 'INFO',
  created_at_ms bigint NOT NULL DEFAULT (EXTRACT(EPOCH FROM now()) * 1000)::bigint,
  raw_data jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_system_audit_logs_created ON public.system_audit_logs(created_at_ms ASC, id ASC);

-- 55. Telegram Operational Tables (Replaces 12 Telegram Firestore collections)
CREATE TABLE IF NOT EXISTS public.telegram_user_access (
  id text PRIMARY KEY, -- telegramUserId
  firebase_id text UNIQUE,
  telegram_user_id text NOT NULL,
  linked_uid text,
  email text,
  role text NOT NULL CHECK (role IN ('OWNER', 'MANAGER', 'STAFF')),
  name text,
  branch_ids text[] NOT NULL DEFAULT '{}'::text[],
  enabled boolean NOT NULL DEFAULT true,
  source text DEFAULT 'DATABASE',
  verified_at bigint,
  updated_by text,
  created_at_ms bigint NOT NULL DEFAULT (EXTRACT(EPOCH FROM now()) * 1000)::bigint,
  updated_at_ms bigint,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.telegram_links (
  id text PRIMARY KEY, -- staff uid
  firebase_id text UNIQUE,
  uid text NOT NULL,
  telegram_user_id text NOT NULL,
  role text NOT NULL,
  linked_at bigint NOT NULL,
  verified_at bigint NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.telegram_link_challenges (
  id text PRIMARY KEY, -- staff uid
  firebase_id text UNIQUE,
  uid text NOT NULL,
  telegram_user_id text NOT NULL,
  code_hash text NOT NULL,
  expires_at bigint NOT NULL,
  attempts integer NOT NULL DEFAULT 0,
  created_at_ms bigint NOT NULL,
  updated_at_ms bigint,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.telegram_presence (
  id text PRIMARY KEY, -- uid
  firebase_id text UNIQUE,
  uid text NOT NULL,
  email text,
  display_name text,
  role text,
  category text CHECK (category IN ('CUSTOMER', 'STAFF', 'ADMIN')),
  last_seen_at bigint NOT NULL,
  updated_at_ms bigint NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_telegram_presence_seen ON public.telegram_presence(last_seen_at DESC);

CREATE TABLE IF NOT EXISTS public.telegram_updates (
  id text PRIMARY KEY, -- update_id
  firebase_id text UNIQUE,
  status text NOT NULL,
  received_at bigint NOT NULL,
  processing_started_at bigint,
  completed_at bigint,
  failed_at bigint,
  attempts integer NOT NULL DEFAULT 1,
  last_error text,
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_telegram_updates_received ON public.telegram_updates(received_at DESC);

CREATE TABLE IF NOT EXISTS public.telegram_controls (
  id text PRIMARY KEY, -- e.g. 'remote_admin'
  firebase_id text UNIQUE,
  enabled boolean NOT NULL DEFAULT false,
  updated_by text,
  updated_at_ms bigint,
  data jsonb NOT NULL DEFAULT '{}'::jsonb,
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.telegram_monitor_state (
  id text PRIMARY KEY, -- 'audit_cursor', 'system_audit_cursor'
  firebase_id text UNIQUE,
  timestamp_ms bigint NOT NULL DEFAULT 0,
  document_id text NOT NULL DEFAULT '',
  initialized_at bigint,
  updated_at_ms bigint,
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.telegram_stock_alert_state (
  id text PRIMARY KEY, -- productId
  firebase_id text UNIQUE,
  product_id text,
  active boolean NOT NULL DEFAULT false,
  last_sent_at bigint,
  recovered_at bigint,
  current_stock numeric(12,2),
  minimum_stock numeric(12,2),
  lease_until bigint,
  last_attempt_at bigint,
  delivered integer,
  failed integer,
  last_error_at bigint,
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.telegram_sale_notifications (
  id text PRIMARY KEY, -- orderId
  firebase_id text UNIQUE,
  status text NOT NULL,
  sent_at bigint,
  lease_until bigint,
  attempts integer NOT NULL DEFAULT 0,
  data jsonb NOT NULL DEFAULT '{}'::jsonb,
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.telegram_event_deliveries (
  id text PRIMARY KEY, -- eventId
  firebase_id text UNIQUE,
  status text NOT NULL,
  lease_until bigint,
  attempts integer NOT NULL DEFAULT 1,
  sent integer,
  failed integer,
  created_at_ms bigint NOT NULL,
  updated_at_ms bigint,
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.telegram_security_throttle (
  id text PRIMARY KEY,
  firebase_id text UNIQUE,
  count integer NOT NULL DEFAULT 0,
  updated_at_ms bigint NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.telegram_otp_request_windows (
  id text PRIMARY KEY,
  firebase_id text UNIQUE,
  uid_hash text NOT NULL,
  purpose text NOT NULL,
  window_start bigint NOT NULL,
  count integer NOT NULL DEFAULT 0,
  last_requested_at bigint NOT NULL,
  spam_suspected boolean NOT NULL DEFAULT false,
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Enable Supabase Realtime publication for live operational tables
DO $$
DECLARE
  tbl text;
BEGIN
  IF EXISTS (SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime') THEN
    FOREACH tbl IN ARRAY ARRAY[
      'profiles', 'admins', 'user_held_bills', 'user_fleet', 'user_ai_chats',
      'branches', 'inventory', 'inventory_backups', 'pos_terminals',
      'register_sessions', 'reconciliations', 'orders', 'carwash_jobs',
      'petty_cash', 'salary_advances', 'suppliers', 'digital_menus',
      'reviews', 'support_queries', 'notifications', 'app_releases',
      'settings', 'system_config', 'live_audio_sessions', 'live_audio_candidates',
      'audit_logs', 'system_incidents'
    ] LOOP
      IF NOT EXISTS (
        SELECT 1 FROM pg_publication_tables
        WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = tbl
      ) THEN
        EXECUTE format('ALTER PUBLICATION supabase_realtime ADD TABLE public.%I', tbl);
      END IF;
    END LOOP;
  END IF;
END $$;

COMMIT;
