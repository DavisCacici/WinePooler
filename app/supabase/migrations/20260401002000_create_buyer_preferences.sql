-- Story 2.3: Buyer purchasing preferences
CREATE TABLE public.buyer_preferences (
  id                     uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id                uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  preferred_wine_types   text[] NOT NULL DEFAULT '{}',
  preferred_appellations text[] NOT NULL DEFAULT '{}',
  monthly_budget_min     numeric CHECK (monthly_budget_min >= 0),
  monthly_budget_max     numeric CHECK (monthly_budget_max >= 0),
  updated_at             timestamptz DEFAULT now(),
  UNIQUE (user_id),
  CONSTRAINT budget_range_valid CHECK (
    monthly_budget_min IS NULL OR
    monthly_budget_max IS NULL OR
    monthly_budget_min <= monthly_budget_max
  )
);

ALTER TABLE public.buyer_preferences ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Buyer can read own preferences"
  ON public.buyer_preferences FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Buyer can insert own preferences"
  ON public.buyer_preferences FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Buyer can update own preferences"
  ON public.buyer_preferences FOR UPDATE
  USING (auth.uid() = user_id);
