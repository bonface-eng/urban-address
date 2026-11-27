import os
import re
import csv
import json

CLEANING_CSV = r"c:\Users\Gackstone_Baraka\Downloads\urban-address-main\migration-output\inventory\CLEANING_REPORT.csv"
MIGRATION_DIR = r"c:\Users\Gackstone_Baraka\Downloads\urban-address-main\supabase\migrations"
MIGRATION_OUTPUT_SQL = r"c:\Users\Gackstone_Baraka\Downloads\urban-address-main\migration-output\sql"

os.makedirs(MIGRATION_DIR, exist_ok=True)
os.makedirs(MIGRATION_OUTPUT_SQL, exist_ok=True)

# 1. Schema migration
SCHEMA_SQL = """-- Migration 12: Inventory schema adjustments, constraints, price_history, and public_catalogue view
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
"""

with open(os.path.join(MIGRATION_DIR, "20261128000012_inventory_schema_and_catalogue.sql"), "w", encoding="utf-8") as f:
    f.write(SCHEMA_SQL)
with open(os.path.join(MIGRATION_OUTPUT_SQL, "12_inventory_schema_and_catalogue.sql"), "w", encoding="utf-8") as f:
    f.write(SCHEMA_SQL)

def escape_sql(val):
    if val is None:
        return "NULL"
    s = str(val).replace("'", "''")
    return f"'{s}'"

# Read CLEANING_REPORT.csv
rows = []
with open(CLEANING_CSV, "r", encoding="utf-8") as f:
    reader = csv.DictReader(f)
    for r in reader:
        rows.append(r)

lounge_inserts = []
store_inserts = []

for r in rows:
    action = r.get("action_taken", "")
    if "EXCLUDED" in action or "MERGED into" in action:
        continue
        
    unit = r["unit"]
    sn = r["source_sn"]
    name = r["cleaned_name"]
    orig_name = r["original_name"]
    cat = r["category"]
    subcat = r["subcategory"]
    size = r["size"] if r["size"] else None
    price = None # never invent price
    
    track_stock = True
    if "Non-stock" in r.get("review_notes", "") or "track_stock=false" in r.get("review_notes", ""):
        track_stock = False
        
    needs_review = r.get("needs_review", "False").lower() == "true"
    review_notes = r.get("review_notes", "")
    
    if unit == "LOUNGE":
        stock_qty = None # never invent lounge stock
        src_ref = f"UAX-AUD-929831#SN{sn}"
        stmt = f"""(gen_random_uuid()::text, {escape_sql(name)}, {escape_sql(orig_name)}, {escape_sql(cat)}, {escape_sql(subcat)}, {escape_sql(size)}, NULL, NULL, {escape_sql(unit)}, {track_stock}, true, false, {needs_review}, {escape_sql(review_notes)}, {escape_sql(src_ref)}, now(), now())"""
        lounge_inserts.append(stmt)
    elif unit == "STORE":
        stock_qty = r["stock_quantity"] if r["stock_quantity"] else 0
        src_ref = f"UAX-AUD-957188#SN{sn}"
        stmt = f"""(gen_random_uuid()::text, {escape_sql(name)}, {escape_sql(orig_name)}, {escape_sql(cat)}, {escape_sql(subcat)}, {escape_sql(size)}, NULL, {stock_qty}, {escape_sql(unit)}, {track_stock}, true, false, {needs_review}, {escape_sql(review_notes)}, {escape_sql(src_ref)}, now(), now())"""
        store_inserts.append(stmt)

print(f"Lounge insert count: {len(lounge_inserts)}")
print(f"Store insert count: {len(store_inserts)}")

def build_insert_migration(inserts, title, ref):
    chunks = []
    chunk_size = 50
    for i in range(0, len(inserts), chunk_size):
        chunk = inserts[i:i+chunk_size]
        vals = ",\n".join(chunk)
        chunks.append(f"""INSERT INTO public.inventory (
  id, name, original_name, category, subcategory, size, price, stock_level, unit, 
  track_stock, is_active, archived, needs_review, review_notes, source_ref, created_at, updated_at
) VALUES 
{vals}
ON CONFLICT (unit, lower(name), coalesce(size, '')) DO UPDATE SET
  original_name = EXCLUDED.original_name,
  category = EXCLUDED.category,
  subcategory = EXCLUDED.subcategory,
  stock_level = COALESCE(public.inventory.stock_level, EXCLUDED.stock_level),
  track_stock = EXCLUDED.track_stock,
  needs_review = EXCLUDED.needs_review,
  review_notes = EXCLUDED.review_notes,
  source_ref = EXCLUDED.source_ref,
  updated_at = now();
""")
    header = f"""-- {title}
-- Source audit ref: {ref}
-- Rows: {len(inserts)}
"""
    return header + "\n".join(chunks)

lounge_sql = build_insert_migration(lounge_inserts, "Import Lounge Inventory", "UAX-AUD-929831")
store_sql = build_insert_migration(store_inserts, "Import Store Inventory", "UAX-AUD-957188")

with open(os.path.join(MIGRATION_DIR, "20261128000013_import_lounge_inventory.sql"), "w", encoding="utf-8") as f:
    f.write(lounge_sql)
with open(os.path.join(MIGRATION_OUTPUT_SQL, "13_import_lounge_inventory.sql"), "w", encoding="utf-8") as f:
    f.write(lounge_sql)

with open(os.path.join(MIGRATION_DIR, "20261128000014_import_store_inventory.sql"), "w", encoding="utf-8") as f:
    f.write(store_sql)
with open(os.path.join(MIGRATION_OUTPUT_SQL, "14_import_store_inventory.sql"), "w", encoding="utf-8") as f:
    f.write(store_sql)

print("Generated migrations 12, 13, 14 successfully.")
