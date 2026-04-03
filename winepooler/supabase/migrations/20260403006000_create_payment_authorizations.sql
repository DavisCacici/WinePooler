-- Story 5.1: Escrow Pre-Authorization
-- Create payment_authorizations table and extend pallet_orders with FK

-- ============================================================
-- 1. payment_authorizations table
-- ============================================================
CREATE TABLE public.payment_authorizations (
  id                        uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  pallet_id                 uuid NOT NULL REFERENCES public.virtual_pallets(id) ON DELETE CASCADE,
  buyer_id                  uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  order_id                  uuid REFERENCES public.pallet_orders(id) ON DELETE SET NULL,
  stripe_payment_intent_id  text NOT NULL UNIQUE,
  amount_cents              integer NOT NULL CHECK (amount_cents > 0),
  currency                  text NOT NULL DEFAULT 'eur',
  status                    text NOT NULL CHECK (
    status IN ('authorized', 'capture_pending', 'captured', 'capture_failed', 'canceled', 'expired')
  ),
  capture_before            timestamptz,
  last_error                text,
  created_at                timestamptz DEFAULT now(),
  authorized_at             timestamptz DEFAULT now(),
  captured_at               timestamptz,
  updated_at                timestamptz DEFAULT now()
);

-- ============================================================
-- 2. RLS: buyers read own rows; writes via SECURITY DEFINER only
-- ============================================================
ALTER TABLE public.payment_authorizations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Buyer can read own payment authorizations"
  ON public.payment_authorizations FOR SELECT
  TO authenticated
  USING (auth.uid() = buyer_id);

-- ============================================================
-- 3. Add payment_authorization_id FK on pallet_orders
-- ============================================================
ALTER TABLE public.pallet_orders
  ADD COLUMN payment_authorization_id uuid
  REFERENCES public.payment_authorizations(id)
  ON DELETE SET NULL;

-- ============================================================
-- 4. Indexes for common query patterns
-- ============================================================
CREATE INDEX idx_payment_auth_pallet_status
  ON public.payment_authorizations (pallet_id, status);

CREATE INDEX idx_payment_auth_buyer
  ON public.payment_authorizations (buyer_id);
