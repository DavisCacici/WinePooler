-- Story 8.1: Add display unit columns to virtual_pallets
-- These columns are set at pallet creation time from the winery's selling unit config
-- and are intentionally immutable: existing open pallets retain their original values.

ALTER TABLE public.virtual_pallets
  ADD COLUMN IF NOT EXISTS display_unit             text    DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS display_unit_label       text    DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS bottles_per_display_unit integer DEFAULT NULL;

COMMENT ON COLUMN public.virtual_pallets.display_unit             IS 'Winery-preferred display unit at creation time (bottle | case | pallet)';
COMMENT ON COLUMN public.virtual_pallets.display_unit_label       IS 'Human-readable label, e.g. "cases of 6" or "pallets of 60 cases"';
COMMENT ON COLUMN public.virtual_pallets.bottles_per_display_unit IS 'Bottle equivalent of one display unit; NULL for bottle unit type';
