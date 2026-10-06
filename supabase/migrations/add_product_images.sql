-- ============================================================
-- Migration: Add product image support
-- Run this in your Supabase SQL Editor
-- ============================================================

-- 1. Add image_url column to products table
ALTER TABLE public.products
ADD COLUMN IF NOT EXISTS image_url TEXT;

-- 2. Create the public storage bucket for product images
INSERT INTO storage.buckets (id, name, public)
VALUES ('product-images', 'product-images', true)
ON CONFLICT (id) DO NOTHING;

-- 3. Storage RLS Policies
-- Allow all authenticated users to view product images (POS billing page)
CREATE POLICY "Allow authenticated read product images"
  ON storage.objects FOR SELECT
  TO authenticated
  USING (bucket_id = 'product-images');

-- Only admins can upload product images
CREATE POLICY "Allow admin upload product images"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (bucket_id = 'product-images' AND public.is_admin());

-- Only admins can update product images
CREATE POLICY "Allow admin update product images"
  ON storage.objects FOR UPDATE
  TO authenticated
  USING (bucket_id = 'product-images' AND public.is_admin());

-- Only admins can delete product images
CREATE POLICY "Allow admin delete product images"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (bucket_id = 'product-images' AND public.is_admin());
