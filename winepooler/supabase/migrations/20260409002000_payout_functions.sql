-- Story 5.2: Payout eligibility and idempotent claim functions

-- 1. Get pallet payout summary from captured authorizations
CREATE OR REPLACE FUNCTION public.get_pallet_payout_summary(
  p_pallet_id uuid
)
RETURNS TABLE (
  pallet_id uuid,
  winery_id uuid,
  currency text,
  gross_cents integer,
  captured_count integer,
  is_eligible boolean
)
LANGUAGE sql
SECURITY DEFINER
AS $$
  SELECT
    vp.id,
    vp.winery_id,
    COALESCE(MAX(pa.currency), 'eur') AS currency,
    COALESCE(SUM(pa.amount_cents), 0)::integer AS gross_cents,
    COUNT(pa.id)::integer AS captured_count,
    (
      vp.state = 'completed'
      AND COUNT(pa.id) > 0
      AND BOOL_AND(pa.status = 'captured')
      AND NOT EXISTS (
        SELECT 1 FROM public.pallet_payouts pp
        WHERE pp.pallet_id = vp.id
          AND pp.status = 'paid'
      )
    ) AS is_eligible
  FROM public.virtual_pallets vp
  LEFT JOIN public.payment_authorizations pa ON pa.pallet_id = vp.id
  WHERE vp.id = p_pallet_id
  GROUP BY vp.id, vp.winery_id, vp.state;
$$;

GRANT EXECUTE ON FUNCTION public.get_pallet_payout_summary(uuid)
  TO authenticated;

-- 2. Idempotent claim-or-return function
CREATE OR REPLACE FUNCTION public.claim_pallet_for_payout(
  p_pallet_id uuid,
  p_winery_id uuid,
  p_gross_cents integer,
  p_commission_cents integer,
  p_net_cents integer,
  p_currency text,
  p_commission_bps integer
)
RETURNS TABLE (
  payout_id uuid,
  claim_status text
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Attempt insert; ON CONFLICT keeps existing row
  INSERT INTO public.pallet_payouts (
    pallet_id,
    winery_id,
    gross_amount_cents,
    commission_amount_cents,
    net_amount_cents,
    currency,
    commission_bps,
    status
  )
  VALUES (
    p_pallet_id,
    p_winery_id,
    p_gross_cents,
    p_commission_cents,
    p_net_cents,
    p_currency,
    p_commission_bps,
    'processing'
  )
  ON CONFLICT (pallet_id) DO NOTHING;

  RETURN QUERY
  SELECT pp.id,
         CASE
           WHEN pp.status = 'paid' THEN 'already_paid'
           WHEN pp.status = 'processing' THEN 'claimed'
           WHEN pp.status = 'failed' THEN 'failed_existing'
           ELSE 'claimed'
         END
  FROM public.pallet_payouts pp
  WHERE pp.pallet_id = p_pallet_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.claim_pallet_for_payout(uuid, uuid, integer, integer, integer, text, integer)
  TO authenticated;
