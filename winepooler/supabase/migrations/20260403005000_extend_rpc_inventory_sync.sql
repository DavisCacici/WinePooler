-- Migration: Extend add_order_and_increment to sync wine_inventory.allocated_bottles
-- Story 4.2: Real-Time Inventory Sync
-- Replaces the Story 3.4 version to also increment allocated_bottles when inventory is linked.

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
DECLARE
  v_inventory_id uuid;
BEGIN
  IF p_quantity <= 0 THEN
    RAISE EXCEPTION 'quantity must be positive';
  END IF;

  -- Insert the order row
  INSERT INTO public.pallet_orders (pallet_id, buyer_id, quantity, wine_label, notes)
  VALUES (p_pallet_id, p_buyer_id, p_quantity, p_wine_label, p_notes)
  RETURNING id INTO order_id;

  -- Atomically increment and conditionally freeze
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
  RETURNING bottle_count, state, inventory_id INTO new_count, new_state, v_inventory_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'pallet % is not open or does not exist', p_pallet_id;
  END IF;

  -- Sync allocated_bottles in wine_inventory (if pallet has linked inventory)
  IF v_inventory_id IS NOT NULL THEN
    UPDATE public.wine_inventory
    SET
      allocated_bottles = allocated_bottles + p_quantity,
      updated_at        = now()
    WHERE id = v_inventory_id;
  END IF;
END;
$$;

GRANT EXECUTE ON FUNCTION public.add_order_and_increment(uuid, uuid, integer, text, text)
  TO authenticated;
