-- Story 5.1: Claim authorized payments for capture
-- Atomically transitions 'authorized' → 'capture_pending' to prevent double-capture

CREATE OR REPLACE FUNCTION public.claim_authorized_payments_for_capture(
  p_pallet_id uuid
)
RETURNS TABLE (
  authorization_id uuid,
  stripe_payment_intent_id text,
  amount_cents integer
)
LANGUAGE sql
SECURITY DEFINER
AS $$
  UPDATE public.payment_authorizations
  SET status = 'capture_pending', updated_at = now()
  WHERE id IN (
    SELECT id
    FROM public.payment_authorizations
    WHERE pallet_id = p_pallet_id
      AND status = 'authorized'
  )
  RETURNING id AS authorization_id, stripe_payment_intent_id, amount_cents;
$$;

GRANT EXECUTE ON FUNCTION public.claim_authorized_payments_for_capture(uuid)
  TO authenticated;
