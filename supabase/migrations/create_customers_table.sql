-- ============================================================
-- Migration: Add customers table for repeat customer autofill
-- Run this in your Supabase SQL Editor
-- ============================================================

CREATE TABLE IF NOT EXISTS public.customers (
  phone TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Index for high-speed phone lookups
CREATE INDEX IF NOT EXISTS idx_customers_phone ON public.customers(phone);
CREATE INDEX IF NOT EXISTS idx_customers_updated_at ON public.customers(updated_at DESC);

-- Enable Row Level Security
ALTER TABLE public.customers ENABLE ROW LEVEL SECURITY;

-- Drop any previous policies
DROP POLICY IF EXISTS "Allow authenticated read customers" ON public.customers;
DROP POLICY IF EXISTS "Allow authenticated insert customers" ON public.customers;
DROP POLICY IF EXISTS "Allow authenticated update customers" ON public.customers;

-- Active staff & admin can read customers for instant billing autofill
CREATE POLICY "Allow authenticated read customers"
  ON public.customers FOR SELECT
  TO authenticated
  USING (public.is_active_user());

-- Active staff & admin can insert customers
CREATE POLICY "Allow authenticated insert customers"
  ON public.customers FOR INSERT
  TO authenticated
  WITH CHECK (public.is_active_user());

-- Active staff & admin can update customers
CREATE POLICY "Allow authenticated update customers"
  ON public.customers FOR UPDATE
  TO authenticated
  USING (public.is_active_user())
  WITH CHECK (public.is_active_user());

-- Add to Realtime publication
ALTER PUBLICATION supabase_realtime ADD TABLE public.customers;
