-- Story 5.2: Stripe Connect account linkage on winery_profiles
-- Adds nullable column for Stripe Connect account reference

ALTER TABLE public.winery_profiles
  ADD COLUMN stripe_connect_account_id text;

-- Partial unique index — only one winery per Connect account
CREATE UNIQUE INDEX winery_profiles_stripe_connect_account_id_unique
  ON public.winery_profiles (stripe_connect_account_id)
  WHERE stripe_connect_account_id IS NOT NULL;
