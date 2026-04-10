-- Migration: selling_units table
-- Story 7.1: Selling Unit Schema and Configuration API
-- Defines bottle/case/pallet selling unit definitions per winery

-- ────────────────────────────────────────────────────────────
-- 1. selling_units table
-- ────────────────────────────────────────────────────────────
CREATE TABLE public.selling_units (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  winery_id         uuid NOT NULL REFERENCES public.winery_profiles(id) ON DELETE CASCADE,
  unit_type         text NOT NULL CHECK (unit_type IN ('bottle', 'case', 'pallet')),
  bottles_per_case  integer CHECK (bottles_per_case >= 2),
  composition_type  text CHECK (composition_type IN ('bottles', 'cases')),
  pallet_quantity   integer CHECK (pallet_quantity >= 1),
  created_at        timestamptz DEFAULT now(),
  updated_at        timestamptz DEFAULT now(),
  CONSTRAINT selling_units_case_requires_bottles_per_case
    CHECK (unit_type != 'case' OR bottles_per_case IS NOT NULL),
  CONSTRAINT selling_units_pallet_requires_composition
    CHECK (unit_type != 'pallet' OR (composition_type IS NOT NULL AND pallet_quantity IS NOT NULL))
);

-- ────────────────────────────────────────────────────────────
-- 2. RLS policies
-- ────────────────────────────────────────────────────────────
ALTER TABLE public.selling_units ENABLE ROW LEVEL SECURITY;

-- All authenticated users can read selling units (marketplace visibility)
CREATE POLICY "selling_units_select_authenticated"
  ON public.selling_units
  FOR SELECT
  TO authenticated
  USING (true);

-- Only owning winery can insert
CREATE POLICY "selling_units_insert_winery"
  ON public.selling_units
  FOR INSERT
  TO winery
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.winery_profiles wp
      WHERE wp.id = selling_units.winery_id
        AND wp.user_id = auth.uid()
    )
  );

-- Only owning winery can update
CREATE POLICY "selling_units_update_winery"
  ON public.selling_units
  FOR UPDATE
  TO winery
  USING (
    EXISTS (
      SELECT 1 FROM public.winery_profiles wp
      WHERE wp.id = selling_units.winery_id
        AND wp.user_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.winery_profiles wp
      WHERE wp.id = selling_units.winery_id
        AND wp.user_id = auth.uid()
    )
  );

-- Only owning winery can delete
CREATE POLICY "selling_units_delete_winery"
  ON public.selling_units
  FOR DELETE
  TO winery
  USING (
    EXISTS (
      SELECT 1 FROM public.winery_profiles wp
      WHERE wp.id = selling_units.winery_id
        AND wp.user_id = auth.uid()
    )
  );

-- ────────────────────────────────────────────────────────────
-- 3. Enable Realtime
-- ────────────────────────────────────────────────────────────
ALTER PUBLICATION supabase_realtime ADD TABLE public.selling_units;
