-- Migration: Atomic add-order-and-increment RPC
-- Story 3.4: Concurrent Update Handling
-- Replaces the two-step INSERT + increment_pallet_bottle_count RPC with a single
-- atomic PL/pgSQL function that inserts the order row AND increments/freezes the pallet
-- in one transaction. PostgreSQL row-level locking on the UPDATE serializes concurrent calls.

CREATE OR REPLACE FUNCTION public.add_order_and_increment(
  p_pallet_id  uuid,
  p_buyer_id   uuid,
  p_quantity   integer,
  p_wine_label text DEFAULT NULL,
  p_notes      text DEFAULT NULL,
  OUT order_id  uuid,
  OUT new_count integer,
  OUT new_state text
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  IF p_quantity <= 0 THEN
    RAISE EXCEPTION 'quantity must be positive';
  END IF;

  -- Insert the order row
  INSERT INTO public.pallet_orders (pallet_id, buyer_id, quantity, wine_label, notes)
  VALUES (p_pallet_id, p_buyer_id, p_quantity, p_wine_label, p_notes)
  RETURNING id INTO order_id;

  -- Atomically increment and conditionally freeze
  -- PostgreSQL row-level lock on the target row serializes concurrent calls
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
    -- Pallet not open (already frozen or doesn't exist) — the INSERT is rolled back
    -- automatically because the RAISE EXCEPTION aborts the entire function's transaction
    RAISE EXCEPTION 'pallet % is not open or does not exist', p_pallet_id;
  END IF;
END;
$$;

GRANT EXECUTE ON FUNCTION public.add_order_and_increment(uuid, uuid, integer, text, text)
  TO authenticated;
