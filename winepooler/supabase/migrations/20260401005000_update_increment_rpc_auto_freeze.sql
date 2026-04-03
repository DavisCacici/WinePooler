-- Migration: update increment_pallet_bottle_count RPC with auto-freeze
-- Story 3.3: Automatic Pallet Freezing
-- Replaces the scalar-return version from Story 3.2 with OUT params + atomic freeze

CREATE OR REPLACE FUNCTION public.increment_pallet_bottle_count(
  p_pallet_id uuid,
  p_quantity  integer,
  OUT new_count integer,
  OUT new_state text
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Validate quantity (belt-and-suspenders)
  IF p_quantity <= 0 THEN
    RAISE EXCEPTION 'quantity must be positive';
  END IF;

  -- Atomically increment + conditionally freeze in a single UPDATE
  UPDATE public.virtual_pallets
  SET
    bottle_count = bottle_count + p_quantity,
    state        = CASE
                     WHEN bottle_count + p_quantity >= threshold THEN 'frozen'
                     ELSE state
                   END,
    updated_at   = now()
  WHERE id = p_pallet_id
    AND state = 'open'
  RETURNING bottle_count, state INTO new_count, new_state;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'pallet % not found or not open', p_pallet_id;
  END IF;
END;
$$;

-- Re-grant execute (CREATE OR REPLACE retains grants, but explicit for safety)
GRANT EXECUTE ON FUNCTION public.increment_pallet_bottle_count(uuid, integer)
  TO authenticated;
