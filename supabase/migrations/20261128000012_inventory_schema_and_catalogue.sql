-- Migration 12: Inventory schema adjustments, constraints, price_history, and public_catalogue view
-- Allows nullable price and stock_level, changes size to text, adds metadata columns

DROP VIEW IF EXISTS public.public_catalogue CASCADE;

-- 1. Alter public.inventory columns
ALTER TABLE public.inventory ALTER COLUMN price DROP NOT NULL;
ALTER TABLE public.inventory DROP CONSTRAINT IF EXISTS inventory_price_check;
ALTER TABLE public.inventory ADD CONSTRAINT inventory_price_check CHECK (price IS NULL OR price >= 0);

ALTER TABLE public.inventory ALTER COLUMN stock_level DROP NOT NULL;
ALTER TABLE public.inventory ALTER COLUMN size TYPE text USING size::text;

ALTER TABLE public.inventory ADD COLUMN IF NOT EXISTS original_name text;
ALTER TABLE public.inventory ADD COLUMN IF NOT EXISTS subcategory text;
ALTER TABLE public.inventory ADD COLUMN IF NOT EXISTS description text;
ALTER TABLE public.inventory ADD COLUMN IF NOT EXISTS track_stock boolean DEFAULT true;
ALTER TABLE public.inventory ADD COLUMN IF NOT EXISTS image_url text;
ALTER TABLE public.inventory ADD COLUMN IF NOT EXISTS image_asset_key text;
ALTER TABLE public.inventory ADD COLUMN IF NOT EXISTS is_active boolean DEFAULT true;
ALTER TABLE public.inventory ADD COLUMN IF NOT EXISTS needs_review boolean DEFAULT false;
ALTER TABLE public.inventory ADD COLUMN IF NOT EXISTS review_notes text;
ALTER TABLE public.inventory ADD COLUMN IF NOT EXISTS source_ref text;
ALTER TABLE public.inventory ADD COLUMN IF NOT EXISTS updated_by text;

-- Create unique index to prevent duplicate unit/name/size items
CREATE UNIQUE INDEX IF NOT EXISTS inventory_unit_name_size_uidx 
ON public.inventory (unit, lower(name), coalesce(size, ''));

-- 2. Create price_history table
CREATE TABLE IF NOT EXISTS public.price_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id text NOT NULL,
  old_price numeric(12,2),
  new_price numeric(12,2),
  changed_by text,
  changed_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_price_history_product_id ON public.price_history(product_id);
CREATE INDEX IF NOT EXISTS idx_price_history_changed_at ON public.price_history(changed_at DESC);

-- Enable RLS on price_history
ALTER TABLE public.price_history ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'price_history' AND policyname = 'Admins can manage price history'
  ) THEN
    CREATE POLICY "Admins can manage price history" ON public.price_history
      FOR ALL TO authenticated
      USING (
        EXISTS (
          SELECT 1 FROM public.profiles 
          WHERE profiles.id = auth.uid() 
          AND profiles.role IN ('SUPER_ADMIN', 'ADMIN', 'MANAGER')
        )
      );
  END IF;
END $$;

-- 3. Price change audit trigger
CREATE OR REPLACE FUNCTION public.log_inventory_price_change()
RETURNS trigger AS $$
BEGIN
  IF (OLD.price IS DISTINCT FROM NEW.price) THEN
    INSERT INTO public.price_history (product_id, old_price, new_price, changed_by, changed_at)
    VALUES (NEW.id, OLD.price, NEW.price, NEW.updated_by, now());
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trg_inventory_price_change ON public.inventory;
CREATE TRIGGER trg_inventory_price_change
  AFTER UPDATE OF price ON public.inventory
  FOR EACH ROW
  EXECUTE FUNCTION public.log_inventory_price_change();

-- 4. Public catalogue view
DROP VIEW IF EXISTS public.public_catalogue CASCADE;
CREATE OR REPLACE VIEW public.public_catalogue AS
SELECT 
  id,
  name,
  unit,
  category,
  subcategory,
  size,
  size_unit,
  price,
  image,
  image_url,
  CASE 
    WHEN track_stock = false THEN true
    WHEN stock_level IS NULL THEN true
    WHEN stock_level > 0 THEN true
    ELSE false
  END AS is_available,
  CASE 
    WHEN track_stock = false THEN 'untracked'
    WHEN stock_level IS NULL THEN 'uncounted'
    WHEN stock_level > (coalesce(min_stock, 0)) THEN 'in_stock'
    WHEN stock_level > 0 THEN 'low_stock'
    ELSE 'out_of_stock'
  END AS stock_status,
  is_active,
  archived
FROM public.inventory
WHERE archived = false AND is_active = true;

-- Grant select on public_catalogue to anon and authenticated
GRANT SELECT ON public.public_catalogue TO anon, authenticated;
GRANT SELECT ON public.inventory TO anon, authenticated;
