-- Migration: wine_inventory table, inventory_id FK on virtual_pallets, seed data
-- Story 4.2: Real-Time Inventory Sync

-- ────────────────────────────────────────────────────────────
-- 1. wine_inventory table
-- ────────────────────────────────────────────────────────────
CREATE TABLE public.wine_inventory (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  winery_id         uuid NOT NULL REFERENCES public.winery_profiles(id) ON DELETE CASCADE,
  wine_label        text NOT NULL,
  sku               text NOT NULL,
  allocated_bottles integer NOT NULL DEFAULT 0 CHECK (allocated_bottles >= 0),
  price             numeric,
  allocated_case    integer NOT NULL DEFAULT 0 CHECK (allocated_case >= 0),
  available         boolean NOT NULL DEFAULT true,
  updated_at        timestamptz DEFAULT now(),
  UNIQUE (winery_id, sku)
);

ALTER TABLE public.wine_inventory ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can read inventory"
  ON public.wine_inventory FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Winery can update own inventory"
  ON public.wine_inventory FOR UPDATE
  USING (auth.uid() = (SELECT user_id FROM public.winery_profiles WHERE id = winery_id));

CREATE POLICY "Winery can insert own inventory"
  ON public.wine_inventory FOR INSERT
  WITH CHECK (auth.uid() = (SELECT user_id FROM public.winery_profiles WHERE id = winery_id));

-- Enable Realtime for wine_inventory
ALTER PUBLICATION supabase_realtime ADD TABLE public.wine_inventory;

-- ────────────────────────────────────────────────────────────
-- 2. Link virtual_pallets to inventory
-- ────────────────────────────────────────────────────────────
ALTER TABLE public.virtual_pallets
  ADD COLUMN inventory_id uuid REFERENCES public.wine_inventory(id) ON DELETE SET NULL;

-- ────────────────────────────────────────────────────────────
-- 3. Seed inventory rows (one per mock winery from Story 3.1)
-- ────────────────────────────────────────────────────────────
INSERT INTO public.wine_inventory (winery_id, wine_label, sku, allocated_bottles, price, allocated_case, available)
VALUES
  ((SELECT id FROM public.winery_profiles WHERE company_name = 'Cantina Aurora'),  'Rosso Riserva',     'CAU-RR-001', 432, NULL, 800, true),
  ((SELECT id FROM public.winery_profiles WHERE company_name = 'Tenuta Collina'),  'Bianco Superiore',  'TCO-BS-001', 324, NULL, 700, true),
  ((SELECT id FROM public.winery_profiles WHERE company_name = 'Vigna Nuova'),     'Barolo DOCG',       'VNU-BA-001', 486, NULL, 900, true);

-- Link existing open pallets to their winery's inventory
UPDATE public.virtual_pallets vp
SET inventory_id = wi.id
FROM public.wine_inventory wi
WHERE vp.winery_id = wi.winery_id
  AND vp.state = 'open';
