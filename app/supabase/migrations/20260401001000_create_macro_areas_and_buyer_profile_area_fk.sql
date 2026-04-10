-- Story 2.2: Create macro_areas and link buyer_profiles.macro_area_id
CREATE TABLE public.macro_areas (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name          text NOT NULL UNIQUE,
  slug          text NOT NULL UNIQUE,
  description   text,
  display_order integer NOT NULL DEFAULT 0,
  is_active     boolean NOT NULL DEFAULT true,
  created_at    timestamptz DEFAULT now()
);

INSERT INTO public.macro_areas (name, slug, description, display_order)
VALUES
  ('North Milan', 'north-milan', 'Metropolitan Milan and northern hinterland', 1),
  ('Lake Garda', 'lake-garda', 'Garda lake basin and surrounding hills', 2),
  ('Turin Center', 'turin-center', 'Central Turin and Piedmont valley floor', 3);

ALTER TABLE public.macro_areas ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can read active areas"
  ON public.macro_areas FOR SELECT
  TO authenticated
  USING (is_active = true);

ALTER TABLE public.buyer_profiles
  ADD COLUMN macro_area_id uuid REFERENCES public.macro_areas(id) ON DELETE SET NULL;
