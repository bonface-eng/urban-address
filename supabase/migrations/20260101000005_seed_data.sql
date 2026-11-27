-- =============================================================================
-- 05_seed_data.sql
-- Urban Auto Express — Deterministic Configuration & Reference Defaults
-- Derived strictly from codebase constants found in Step A (no invented data).
-- =============================================================================

BEGIN;

-- 1. Root Super-Admin Whitelist (from firestore.rules & src/hooks/use-profile.ts)
INSERT INTO public.admins (email, firebase_id, is_root, added_by)
VALUES
  ('urbanautoexpressnakuru@gmail.com', 'urbanautoexpressnakuru@gmail.com', true, 'SYSTEM_SEED'),
  ('urbanaautoexpressnakuru@gmail.com', 'urbanaautoexpressnakuru@gmail.com', true, 'SYSTEM_SEED'),
  ('samuelkarani044@gmail.com', 'samuelkarani044@gmail.com', true, 'SYSTEM_SEED'),
  ('gmaina424@gmail.com', 'gmaina424@gmail.com', true, 'SYSTEM_SEED'),
  ('bonfacewana3072@gmail.com', 'bonfacewana3072@gmail.com', true, 'SYSTEM_SEED')
ON CONFLICT (email) DO NOTHING;

-- 2. Primary Branch: Default - Naka Branch (from src/app/admin/page.tsx & src/lib/config.ts)
INSERT INTO public.branches (
  id, firebase_id, business_id, name, code, status, is_primary, location, phone, created_by, updated_by
)
VALUES (
  'default-naka',
  'default-naka',
  'urban-address',
  'Default - Naka Branch',
  'default-naka',
  'ACTIVE',
  true,
  jsonb_build_object(
    'address', 'Main Highway, Naka Center',
    'town', 'Naka',
    'county', 'Nakuru',
    'country', 'Kenya',
    'latitude', -0.2875484,
    'longitude', 36.1076805
  ),
  '0785860753',
  'SYSTEM_SEED',
  'SYSTEM_SEED'
)
ON CONFLICT (id) DO NOTHING;

-- 3. Default Receipt Configuration (from src/hooks/use-receipt-settings.ts: DEFAULT_RECEIPT_SETTINGS)
INSERT INTO public.settings (id, firebase_id, data, updated_by)
VALUES (
  'receipt_config',
  'receipt_config',
  jsonb_build_object(
    'storeHeader', 'URBAN ACCESSORIES',
    'loungeHeader', 'URBAN ADDRESS',
    'carwashHeader', 'URBAN AUTO EXPRESS',
    'branchName', 'NAKA CENTER BRANCH',
    'location', 'NAKURU, KENYA',
    'phone', '0785860753',
    'paybill', '222111',
    'accountNo', '035',
    'loungePaybill', '516600',
    'loungeAccountNo', '449449',
    'vatNumber', 'P051234567Z',
    'footerNote', 'Thank you for your patronage',
    'footerTagline', 'Urban Express Business OS',
    'receiptSections', '[]'::jsonb
  ),
  'SYSTEM_SEED'
)
ON CONFLICT (id) DO NOTHING;

-- 4. System Configuration & Default Role Access Matrix (from src/app/admin/page.tsx & navigation-config.ts)
INSERT INTO public.system_config (id, firebase_id, data)
VALUES
  (
    'permissions',
    'permissions',
    jsonb_build_object(
      'ADMIN', jsonb_build_array(
        '/dashboard', '/settings', '/kds', '/lounge', '/store', '/carwash/pos',
        '/sales-history', '/customers', '/finance', '/reports', '/reports/fraud',
        '/admin/loyalty', '/inventory', '/suppliers', '/carwash', '/attendants',
        '/employees', '/admin/payroll', '/admin/intelligence', '/admin/database',
        '/admin/live-audio', '/admin/support', '/admin/documents', '/admin/help'
      ),
      'MANAGER', jsonb_build_array(
        '/dashboard', '/settings', '/kds', '/lounge', '/store', '/carwash/pos',
        '/sales-history', '/customers', '/finance', '/reports', '/reports/fraud',
        '/admin/loyalty', '/inventory', '/suppliers', '/carwash', '/attendants',
        '/employees', '/admin/payroll', '/admin/documents', '/admin/help'
      ),
      'SUPERVISOR', jsonb_build_array(
        '/dashboard', '/settings', '/kds', '/lounge', '/store', '/carwash/pos',
        '/sales-history', '/customers', '/finance', '/reports', '/admin/loyalty',
        '/inventory', '/suppliers', '/carwash', '/attendants', '/employees'
      ),
      'CASHIER', jsonb_build_array(
        '/dashboard', '/settings', '/lounge', '/store', '/carwash/pos',
        '/sales-history', '/customers', '/finance', '/carwash'
      ),
      'STOREKEEPER', jsonb_build_array(
        '/dashboard', '/settings', '/inventory', '/suppliers', '/store'
      ),
      'ATTENDANT', jsonb_build_array(
        '/dashboard', '/settings', '/carwash', '/attendants'
      ),
      'KITCHEN', jsonb_build_array(
        '/kds', '/settings'
      )
    )
  ),
  (
    'config',
    'config',
    jsonb_build_object(
      'commissionStandard', '30.00',
      'commissionNightShift', '50.00',
      'paystackPublicKeyLive', '',
      'paystackSecretKeyLive', '',
      'visualTheme', 'NONE'
    )
  ),
  (
    'ping',
    'ping',
    jsonb_build_object(
      'lastChecked', (EXTRACT(EPOCH FROM now()) * 1000)::bigint
    )
  )
ON CONFLICT (id) DO NOTHING;

-- 5. Default Digital Menu Document (from src/app/admin/digital-menu/page.tsx)
INSERT INTO public.digital_menus (
  id, firebase_id, status, headline, promotion, rotation_seconds, template, items, updated_by
)
VALUES (
  'main',
  'main',
  'DRAFT',
  'Freshly prepared. Made for you.',
  '',
  14,
  'GRID',
  '[]'::jsonb,
  'SYSTEM_SEED'
)
ON CONFLICT (id) DO NOTHING;

COMMIT;
