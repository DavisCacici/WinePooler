-- Story 2.1: Create buyer_profiles table
CREATE TABLE public.buyer_profiles (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  company_name    text NOT NULL,
  vat_number      text NOT NULL,
  address_street  text NOT NULL,
  address_city    text NOT NULL,
  address_country text NOT NULL DEFAULT 'IT',
  phone           text,
  created_at      timestamptz DEFAULT now(),
  updated_at      timestamptz DEFAULT now(),
  UNIQUE (user_id)
);

-- Row Level Security
ALTER TABLE public.buyer_profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Buyer can read own profile"
  ON public.buyer_profiles FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Buyer can insert own profile"
  ON public.buyer_profiles FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Buyer can update own profile"
  ON public.buyer_profiles FOR UPDATE
  USING (auth.uid() = user_id);
