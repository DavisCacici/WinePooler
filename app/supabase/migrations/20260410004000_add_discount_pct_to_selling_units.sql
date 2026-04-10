-- Story 8.3: Add discount_pct column to selling_units
-- Allows each unit type to carry an optional discount displayed as a marketing badge.
-- Discounts are informational/display-only; bulk_price_per_bottle is already the effective price.

ALTER TABLE public.selling_units
  ADD COLUMN IF NOT EXISTS discount_pct numeric(5,2) NOT NULL DEFAULT 0
    CHECK (discount_pct >= 0 AND discount_pct <= 100);

COMMENT ON COLUMN public.selling_units.discount_pct IS 'Discount percentage badge (0-100); display-only marketing hint';
