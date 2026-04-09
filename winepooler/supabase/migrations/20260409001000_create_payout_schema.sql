-- Story 5.2: Payout persistence schema
-- pallet_payouts: one-per-pallet aggregate payout record
-- pallet_payout_items: per-authorization contribution for audit

-- 1. Payout aggregates
CREATE TABLE public.pallet_payouts (
  id                      uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  pallet_id               uuid NOT NULL REFERENCES public.virtual_pallets(id) ON DELETE CASCADE,
  winery_id               uuid NOT NULL REFERENCES public.winery_profiles(id) ON DELETE CASCADE,
  stripe_transfer_id      text,
  gross_amount_cents      integer NOT NULL CHECK (gross_amount_cents >= 0),
  commission_amount_cents integer NOT NULL CHECK (commission_amount_cents >= 0),
  net_amount_cents        integer NOT NULL CHECK (net_amount_cents >= 0),
  currency                text NOT NULL DEFAULT 'eur',
  commission_bps          integer NOT NULL CHECK (commission_bps >= 0),
  status                  text NOT NULL CHECK (status IN ('pending', 'processing', 'paid', 'failed')),
  failure_reason          text,
  processed_at            timestamptz,
  created_at              timestamptz DEFAULT now(),
  updated_at              timestamptz DEFAULT now(),
  UNIQUE (pallet_id)
);

CREATE INDEX pallet_payouts_winery_status_idx
  ON public.pallet_payouts (winery_id, status, processed_at DESC);

-- 2. Itemized per-authorization contribution
CREATE TABLE public.pallet_payout_items (
  id                        uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  payout_id                 uuid NOT NULL REFERENCES public.pallet_payouts(id) ON DELETE CASCADE,
  payment_authorization_id  uuid NOT NULL REFERENCES public.payment_authorizations(id) ON DELETE RESTRICT,
  amount_cents              integer NOT NULL CHECK (amount_cents > 0),
  created_at                timestamptz DEFAULT now(),
  UNIQUE (payout_id, payment_authorization_id)
);

-- 3. RLS
ALTER TABLE public.pallet_payouts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pallet_payout_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Winery can read own payouts"
  ON public.pallet_payouts FOR SELECT
  TO authenticated
  USING (
    winery_id IN (
      SELECT id FROM public.winery_profiles WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Winery can read own payout items"
  ON public.pallet_payout_items FOR SELECT
  TO authenticated
  USING (
    payout_id IN (
      SELECT pp.id
      FROM public.pallet_payouts pp
      JOIN public.winery_profiles wp ON wp.id = pp.winery_id
      WHERE wp.user_id = auth.uid()
    )
  );

-- 4. Platform fees config table
CREATE TABLE public.platform_fees (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  commission_bps  integer NOT NULL DEFAULT 500 CHECK (commission_bps >= 0 AND commission_bps <= 10000),
  effective_from  timestamptz NOT NULL DEFAULT now(),
  created_at      timestamptz DEFAULT now()
);

ALTER TABLE public.platform_fees ENABLE ROW LEVEL SECURITY;

-- Only service-role can write; authenticated reads for transparency
CREATE POLICY "Authenticated can read platform fees"
  ON public.platform_fees FOR SELECT
  TO authenticated
  USING (true);

-- Insert default 5% commission
INSERT INTO public.platform_fees (commission_bps) VALUES (500);
