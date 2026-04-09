-- Migration: Enhance macro_areas for scalable configuration
-- Story 6.6: Scalable Configuration
-- Adds: metadata JSONB, updated_at timestamp, indexes for performance

-- 1. Add metadata JSONB for extensible area properties
ALTER TABLE public.macro_areas
  ADD COLUMN IF NOT EXISTS metadata jsonb DEFAULT '{}'::jsonb;

-- 2. Add updated_at timestamp for change tracking
ALTER TABLE public.macro_areas
  ADD COLUMN IF NOT EXISTS updated_at timestamptz DEFAULT now();

-- 3. Create indexes for performance at scale
CREATE INDEX IF NOT EXISTS idx_macro_areas_is_active
  ON public.macro_areas (is_active);

CREATE INDEX IF NOT EXISTS idx_macro_areas_display_order
  ON public.macro_areas (display_order);

CREATE INDEX IF NOT EXISTS idx_macro_areas_slug
  ON public.macro_areas (slug);

-- 4. Auto-update updated_at on row modification
CREATE OR REPLACE FUNCTION public.handle_macro_areas_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_macro_areas_updated ON public.macro_areas;
CREATE TRIGGER on_macro_areas_updated
  BEFORE UPDATE ON public.macro_areas
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_macro_areas_updated_at();

-- 5. Comment on metadata column for documentation
COMMENT ON COLUMN public.macro_areas.metadata IS
  'Extensible JSONB for area properties: coordinates, region_group, timezone, etc. Schema: { "lat": number, "lng": number, "bounds": {...}, "region_group": string }';
