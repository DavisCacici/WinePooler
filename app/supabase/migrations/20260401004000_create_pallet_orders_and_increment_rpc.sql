-- Migration: pallet_orders table + atomic increment RPC
-- Story 3.2: Add Order to Pallet

-- ────────────────────────────────────────────────────────────
-- 1. pallet_orders table
-- ────────────────────────────────────────────────────────────
CREATE TABLE public.pallet_orders (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  pallet_id   uuid NOT NULL REFERENCES public.virtual_pallets(id) ON DELETE CASCADE,
  buyer_id    uuid NOT NULL REFERENCES auth.users(id),
  quantity    integer NOT NULL CHECK (quantity > 0),
  wine_label  text,
  notes       text,
  created_at  timestamptz DEFAULT now()
);

ALTER TABLE public.pallet_orders ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Buyer can insert own orders"
  ON public.pallet_orders FOR INSERT
  WITH CHECK (auth.uid() = buyer_id);

CREATE POLICY "Authenticated users can read orders"
  ON public.pallet_orders FOR SELECT
  TO authenticated
  USING (true);

-- ────────────────────────────────────────────────────────────
-- 2. Atomic bottle-count increment RPC
-- ────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.increment_pallet_bottle_count(
  p_pallet_id uuid,
  p_quantity  integer
)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_new_count integer;
BEGIN
  -- Validate quantity (belt-and-suspenders; CHECK constraint handles client path)
  IF p_quantity <= 0 THEN
    RAISE EXCEPTION 'quantity must be positive';
  END IF;

  UPDATE public.virtual_pallets
  SET
    bottle_count = bottle_count + p_quantity,
    updated_at   = now()
  WHERE id = p_pallet_id
    AND state = 'open'
  RETURNING bottle_count INTO v_new_count;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'pallet % not found or not open', p_pallet_id;
  END IF;

  RETURN v_new_count;
END;
$$;

-- Grant execute to authenticated role
GRANT EXECUTE ON FUNCTION public.increment_pallet_bottle_count(uuid, integer)
  TO authenticated;
