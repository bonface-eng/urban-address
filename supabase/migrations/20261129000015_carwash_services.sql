-- Migration 15: Carwash Services Single Source of Truth
-- Additive migration: creates public.carwash_services table, RLS policies, and idempotent seed data.

CREATE TABLE IF NOT EXISTS public.carwash_services (
  id text PRIMARY KEY,
  name text NOT NULL CHECK (char_length(trim(name)) > 0),
  category text NOT NULL CHECK (category IN ('Wash', 'Interior', 'Exterior & Protection', 'Restoration', 'Engine')),
  pricing_type text NOT NULL CHECK (pricing_type IN ('fixed', 'range', 'tiers')),
  price numeric(12,2) CHECK (price IS NULL OR price > 0),
  price_from numeric(12,2) CHECK (price_from IS NULL OR price_from > 0),
  price_to numeric(12,2) CHECK (price_to IS NULL OR price_to > 0),
  tiers jsonb,
  vehicle_size_pricing jsonb,
  currency text NOT NULL DEFAULT 'KES' CHECK (currency = 'KES'),
  is_active boolean NOT NULL DEFAULT true,
  sort_order integer NOT NULL DEFAULT 0,
  note text,
  commission numeric(12,2) NOT NULL DEFAULT 30 CHECK (commission >= 0 AND commission <= 100),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT carwash_services_price_range_check CHECK (price_from IS NULL OR price_to IS NULL OR price_from <= price_to)
);

CREATE INDEX IF NOT EXISTS idx_carwash_services_active_sort
  ON public.carwash_services (is_active, sort_order ASC, category ASC);

ALTER TABLE public.carwash_services ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "carwash_services_select" ON public.carwash_services;
CREATE POLICY "carwash_services_select" ON public.carwash_services
  FOR SELECT USING (is_active = true OR public.is_staff());

DROP POLICY IF EXISTS "carwash_services_admin_insert" ON public.carwash_services;
CREATE POLICY "carwash_services_admin_insert" ON public.carwash_services
  FOR INSERT WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS "carwash_services_admin_update" ON public.carwash_services;
CREATE POLICY "carwash_services_admin_update" ON public.carwash_services
  FOR UPDATE USING (public.is_admin())
  WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS "carwash_services_admin_delete" ON public.carwash_services;
CREATE POLICY "carwash_services_admin_delete" ON public.carwash_services
  FOR DELETE USING (public.is_admin());

GRANT SELECT ON public.carwash_services TO anon, authenticated;
GRANT INSERT, UPDATE, DELETE ON public.carwash_services TO authenticated;

-- Idempotent seed: safe to run multiple times without creating duplicates or overwriting edited prices.
-- TODO: confirm tier names with owner for Watermark Removal, Plastic Restoration, and Headlight Restoration.
INSERT INTO public.carwash_services (
  id, name, category, pricing_type, price, price_from, price_to, tiers, vehicle_size_pricing, currency, is_active, sort_order, note, commission
) VALUES
  ('wash-normal', 'Normal Wash', 'Wash', 'fixed', 300, NULL, NULL, NULL, '{"standard": 300, "suv": 400}'::jsonb, 'KES', true, 10, NULL, 30),
  ('wash-normal-suv', 'Normal Wash (SUV)', 'Wash', 'fixed', 400, NULL, NULL, NULL, '{"standard": 400, "suv": 400}'::jsonb, 'KES', true, 20, NULL, 30),
  ('wash-exterior', 'Exterior Wash', 'Wash', 'fixed', 200, NULL, NULL, NULL, NULL, 'KES', true, 30, NULL, 30),
  ('interior-vacuum', 'Vacuum', 'Interior', 'fixed', 300, NULL, NULL, NULL, NULL, 'KES', true, 40, NULL, 30),
  ('interior-dashboard-cleaning', 'Dashboard Cleaning', 'Interior', 'fixed', 300, NULL, NULL, NULL, NULL, 'KES', true, 50, NULL, 30),
  ('interior-leather-treatment', 'Leather Treatment', 'Interior', 'fixed', 300, NULL, NULL, NULL, NULL, 'KES', true, 60, NULL, 30),
  ('interior-roof-cleaning', 'Roof Cleaning', 'Interior', 'range', NULL, 1000, 1500, NULL, NULL, 'KES', true, 70, 'Final price depends on vehicle size and condition.', 30),
  ('interior-detailing', 'Interior Detailing', 'Interior', 'range', NULL, 3500, 5000, NULL, NULL, 'KES', true, 80, 'Final price depends on vehicle size and condition.', 30),
  ('exterior-tire-shine', 'Tire Shine', 'Exterior & Protection', 'fixed', 400, NULL, NULL, NULL, NULL, 'KES', true, 90, NULL, 30),
  ('exterior-wax', 'Wax', 'Exterior & Protection', 'fixed', 300, NULL, NULL, NULL, NULL, 'KES', true, 100, NULL, 30),
  ('exterior-buffing-polishing', 'Buffing / Polishing', 'Exterior & Protection', 'range', NULL, 500, 4500, NULL, NULL, 'KES', true, 110, 'Final price depends on vehicle size and condition.', 30),
  ('exterior-watermark-removal', 'Watermark Removal', 'Exterior & Protection', 'tiers', NULL, NULL, NULL, '[{"label": "Option 1", "price": 1000}, {"label": "Option 2", "price": 2000}]'::jsonb, NULL, 'KES', true, 120, NULL, 30),
  ('exterior-detailing', 'Exterior Detailing', 'Exterior & Protection', 'range', NULL, 1000, 2000, NULL, NULL, 'KES', true, 130, 'Final price depends on vehicle size and condition.', 30),
  ('restoration-plastic', 'Plastic Restoration', 'Restoration', 'tiers', NULL, NULL, NULL, '[{"label": "Option 1", "price": 1000}, {"label": "Option 2", "price": 2000}]'::jsonb, NULL, 'KES', true, 140, NULL, 30),
  ('restoration-headlight', 'Headlight Restoration', 'Restoration', 'tiers', NULL, NULL, NULL, '[{"label": "Option 1", "price": 500}, {"label": "Option 2", "price": 1000}]'::jsonb, NULL, 'KES', true, 150, NULL, 30),
  ('restoration-wheel-cleaning', 'Wheel Cleaning', 'Restoration', 'fixed', 2000, NULL, NULL, NULL, NULL, 'KES', true, 160, NULL, 30),
  ('engine-wash', 'Engine Wash', 'Engine', 'fixed', 300, NULL, NULL, NULL, NULL, 'KES', true, 170, NULL, 30),
  ('engine-degreasing', 'Engine Degreasing', 'Engine', 'fixed', 600, NULL, NULL, NULL, NULL, 'KES', true, 180, NULL, 30),
  ('engine-detailing', 'Engine Detailing', 'Engine', 'fixed', 2000, NULL, NULL, NULL, NULL, 'KES', true, 190, NULL, 30)
ON CONFLICT (id) DO NOTHING;
