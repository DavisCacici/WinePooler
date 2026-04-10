-- Story 8.2: Add unit_type and unit_quantity columns to pallet_orders
-- unit_type records which selling unit the buyer ordered (bottle | case | pallet)
-- unit_quantity records the raw unit count; quantity column retains the bottle equivalent
-- Existing rows default to 'bottle' / NULL (legacy bottle-quantity rows)

ALTER TABLE public.pallet_orders
  ADD COLUMN IF NOT EXISTS unit_type     text    NOT NULL DEFAULT 'bottle',
  ADD COLUMN IF NOT EXISTS unit_quantity integer          DEFAULT NULL;

COMMENT ON COLUMN public.pallet_orders.unit_type     IS 'Selling unit used for this order (bottle | case | pallet)';
COMMENT ON COLUMN public.pallet_orders.unit_quantity IS 'Quantity in the selected unit; NULL means quantity is already in bottles (legacy)';
