-- =============================================================================
-- 04_storage_buckets.sql
-- Urban Auto Express — Storage Buckets & Policies (Optional Fallback)
-- =============================================================================
-- NOTE: Urban Auto Express uses Cloudflare R2 (@aws-sdk/client-s3 in
-- src/lib/actions.ts) for all production image and APK storage (`profile/`,
-- `products/`, `system/`, `app/`). R2 remains the active storage provider.
--
-- This script optionally creates a `public-assets` bucket in Supabase Storage
-- with matching folder policies in case you ever choose to store assets in
-- Supabase Storage alongside Cloudflare R2.
-- =============================================================================

BEGIN;

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'public-assets',
  'public-assets',
  true,
  52428800, -- 50 MB
  ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'image/avif', 'application/vnd.android.package-archive']
)
ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS "public_assets_read" ON storage.objects;
CREATE POLICY "public_assets_read" ON storage.objects
  FOR SELECT USING (bucket_id = 'public-assets');

DROP POLICY IF EXISTS "public_assets_staff_upload" ON storage.objects;
CREATE POLICY "public_assets_staff_upload" ON storage.objects
  FOR INSERT WITH CHECK (
    bucket_id = 'public-assets'
    AND public.is_staff()
  );

DROP POLICY IF EXISTS "public_assets_admin_delete" ON storage.objects;
CREATE POLICY "public_assets_admin_delete" ON storage.objects
  FOR DELETE USING (
    bucket_id = 'public-assets'
    AND public.is_admin()
  );

COMMIT;
