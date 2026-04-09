-- Migration: product_selling_units join table
-- Story 7.1: Selling Unit Schema and Configuration API
-- Links wine_inventory items to selling_units with enable/disable toggle

-- ────────────────────────────────────────────────────────────
-- 1. product_selling_units table
-- ────────────────────────────────────────────────────────────
CREATE TABLE public.product_selling_units (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  inventory_id    uuid NOT NULL REFERENCES public.wine_inventory(id) ON DELETE CASCADE,
  selling_unit_id uuid NOT NULL REFERENCES public.selling_units(id) ON DELETE CASCADE,
  enabled         boolean NOT NULL DEFAULT true,
  created_at      timestamptz DEFAULT now(),
  UNIQUE (inventory_id, selling_unit_id)
);

-- ────────────────────────────────────────────────────────────
-- 2. RLS policies
-- ────────────────────────────────────────────────────────────
ALTER TABLE public.product_selling_units ENABLE ROW LEVEL SECURITY;

-- All authenticated users can read (marketplace visibility)
CREATE POLICY "product_selling_units_select_authenticated"
  ON public.product_selling_units
  FOR SELECT
  TO authenticated
  USING (true);

-- Only owning winery can insert (via selling_units → winery_profiles ownership)
CREATE POLICY "product_selling_units_insert_winery"
  ON public.product_selling_units
  FOR INSERT
  TO winery
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.selling_units su
      JOIN public.winery_profiles wp ON wp.id = su.winery_id
      WHERE su.id = product_selling_units.selling_unit_id
        AND wp.user_id = auth.uid()
    )
  );

-- Only owning winery can update
CREATE POLICY "product_selling_units_update_winery"
  ON public.product_selling_units
  FOR UPDATE
  TO winery
  USING (
    EXISTS (
      SELECT 1 FROM public.selling_units su
      JOIN public.winery_profiles wp ON wp.id = su.winery_id
      WHERE su.id = product_selling_units.selling_unit_id
        AND wp.user_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.selling_units su
      JOIN public.winery_profiles wp ON wp.id = su.winery_id
      WHERE su.id = product_selling_units.selling_unit_id
        AND wp.user_id = auth.uid()
    )
  );

-- Only owning winery can delete
CREATE POLICY "product_selling_units_delete_winery"
  ON public.product_selling_units
  FOR DELETE
  TO winery
  USING (
    EXISTS (
      SELECT 1 FROM public.selling_units su
      JOIN public.winery_profiles wp ON wp.id = su.winery_id
      WHERE su.id = product_selling_units.selling_unit_id
        AND wp.user_id = auth.uid()
    )
  );

-- ────────────────────────────────────────────────────────────
-- 3. Enable Realtime
-- ────────────────────────────────────────────────────────────
ALTER PUBLICATION supabase_realtime ADD TABLE public.product_selling_units;
