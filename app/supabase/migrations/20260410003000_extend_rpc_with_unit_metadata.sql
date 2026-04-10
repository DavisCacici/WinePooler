-- Story 8.2: Extend add_order_with_authorization_and_increment RPC to accept unit metadata
-- New optional params p_unit_type and p_unit_quantity are backward-compatible (DEFAULT values)
-- The INSERT into pallet_orders now also stores unit_type and unit_quantity

CREATE OR REPLACE FUNCTION public.add_order_with_authorization_and_increment(
  p_pallet_id                 uuid,
  p_buyer_id                  uuid,
  p_quantity                  integer,
  p_payment_intent_id         text,
  p_authorized_amount_cents   integer,
  p_currency                  text DEFAULT 'eur',
  p_capture_before            timestamptz DEFAULT NULL,
  p_wine_label                text DEFAULT NULL,
  p_notes                     text DEFAULT NULL,
  p_unit_type                 text DEFAULT 'bottle',
  p_unit_quantity             integer DEFAULT NULL,
  OUT order_id                uuid,
  OUT authorization_id        uuid,
  OUT new_count               integer,
  OUT new_state               text
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

  -- 1. Insert order (with unit metadata)
  INSERT INTO public.pallet_orders (pallet_id, buyer_id, quantity, wine_label, notes, unit_type, unit_quantity)
  VALUES (p_pallet_id, p_buyer_id, p_quantity, p_wine_label, p_notes, p_unit_type, p_unit_quantity)
  RETURNING id INTO order_id;

  -- 2. Insert payment authorization
  INSERT INTO public.payment_authorizations (
    pallet_id,
    buyer_id,
    order_id,
    stripe_payment_intent_id,
    amount_cents,
    currency,
    status,
    capture_before
  )
  VALUES (
    p_pallet_id,
    p_buyer_id,
    order_id,
    p_payment_intent_id,
    p_authorized_amount_cents,
    p_currency,
    'authorized',
    p_capture_before
  )
  RETURNING id INTO authorization_id;

  -- 3. Link authorization back to order
  UPDATE public.pallet_orders
  SET payment_authorization_id = authorization_id
  WHERE id = order_id;

  -- 4. Atomically increment bottle_count and auto-freeze
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

  -- 5. Sync wine_inventory allocated_bottles (Story 4.2 integration)
  IF v_inventory_id IS NOT NULL THEN
    UPDATE public.wine_inventory
    SET
      allocated_bottles = allocated_bottles + p_quantity,
      updated_at = now()
    WHERE id = v_inventory_id;
  END IF;
END;
$$;

GRANT EXECUTE ON FUNCTION public.add_order_with_authorization_and_increment(
  uuid, uuid, integer, text, integer, text, timestamptz, text, text, text, integer
) TO authenticated;
