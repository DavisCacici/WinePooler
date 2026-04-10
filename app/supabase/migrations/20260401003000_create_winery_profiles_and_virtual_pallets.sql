-- Story 3.1: Winery profiles and virtual pallets
CREATE TABLE public.winery_profiles (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  company_name text NOT NULL,
  vat_number   text NOT NULL,
  created_at   timestamptz DEFAULT now(),
  UNIQUE (user_id)
);

ALTER TABLE public.winery_profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can read winery profiles"
  ON public.winery_profiles FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Winery can insert own profile"
  ON public.winery_profiles FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Winery can update own profile"
  ON public.winery_profiles FOR UPDATE
  USING (auth.uid() = user_id);

-- Seed wineries using first three available auth users in dev environments.
INSERT INTO public.winery_profiles (user_id, company_name, vat_number)
SELECT u.id, v.company_name, v.vat_number
FROM (
  VALUES
    (1, 'Cantina Aurora', 'IT00000000001'),
    (2, 'Tenuta Collina', 'IT00000000002'),
    (3, 'Vigna Nuova', 'IT00000000003')
) AS v(ord, company_name, vat_number)
JOIN (
  SELECT id, row_number() OVER (ORDER BY created_at, id) AS ord
  FROM auth.users
) AS u ON u.ord = v.ord
ON CONFLICT (user_id) DO NOTHING;

CREATE TABLE public.virtual_pallets (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  area_id      uuid NOT NULL REFERENCES public.macro_areas(id),
  winery_id    uuid NOT NULL REFERENCES public.winery_profiles(id),
  state        text NOT NULL DEFAULT 'open'
               CHECK (state IN ('open', 'frozen', 'completed')),
  bottle_count integer NOT NULL DEFAULT 0 CHECK (bottle_count >= 0),
  threshold    integer NOT NULL DEFAULT 600 CHECK (threshold > 0),
  created_by   uuid NOT NULL REFERENCES auth.users(id),
  created_at   timestamptz DEFAULT now(),
  updated_at   timestamptz DEFAULT now()
);

CREATE UNIQUE INDEX virtual_pallets_one_open_per_winery_area
  ON public.virtual_pallets (area_id, winery_id)
  WHERE state = 'open';

ALTER TABLE public.virtual_pallets ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can read all pallets"
  ON public.virtual_pallets FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Buyers can create pallets"
  ON public.virtual_pallets FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = created_by);
