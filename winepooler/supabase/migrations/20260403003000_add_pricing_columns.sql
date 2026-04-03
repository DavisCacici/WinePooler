-- Migration: Add pricing columns to virtual_pallets
-- Story 4.1: Display Dynamic Pricing

ALTER TABLE public.virtual_pallets
  ADD COLUMN bulk_price_per_bottle   numeric(10,2) CHECK (bulk_price_per_bottle > 0),
  ADD COLUMN retail_price_per_bottle numeric(10,2) CHECK (retail_price_per_bottle > 0);

-- Seed existing dev pallets with example pricing
UPDATE public.virtual_pallets
SET
  bulk_price_per_bottle   = 8.50,
  retail_price_per_bottle = 14.00
WHERE state = 'open';
