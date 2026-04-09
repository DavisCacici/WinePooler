# Story 5.2: Bulk Payout Processing

Status: review

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a Winery,
I want to receive a single payment for the entire pallet,
so that administrative overhead is reduced.

## Acceptance Criteria

1. Given a pallet has reached `frozen` and all associated buyer authorizations are captured
   When the winery confirms fulfillment/shipment
   Then the system calculates a single payout amount for that pallet
   And the payout equals total captured amount minus platform commission

2. Given a valid payout amount exists for a shipped pallet
   When the payout job runs
   Then one Stripe Connect transfer is created to the winery connected account
   And one Supabase payout record is persisted for audit

3. Given two payout triggers happen concurrently for the same pallet (duplicate click/retry/webhook race)
   When payout processing executes
   Then only one payout is created
   And repeated requests return the existing payout result without double-paying

4. Given payout creation fails (missing connected account, Stripe API error, insufficient platform balance)
   When processing fails
   Then payout status is marked `failed` with an error reason
   And the pallet remains eligible for retry
   And no duplicate transfer is recorded

5. Given payout is successful
   When the winery opens the Winery Portal analytics and picking list view
   Then the pallet row shows payout status `paid`
   And analytics reflect net paid amount and platform fee amount

6. Given payout is successful
   When finance/admin audits the pallet
   Then the system can trace payout to underlying captured authorizations and the Stripe transfer id
   And all values reconcile to cent precision

## Tasks / Subtasks

- [x] Add Stripe Connect linkage on winery profile (AC: 2, 4)
  - [x] Add `stripe_connect_account_id` nullable column to `public.winery_profiles`
  - [x] Add unique partial index where not null
  - [x] Preserve existing RLS policies; only winery owner can update own linked account
  - [x] Add validation pattern in app layer for `acct_` prefix
- [x] Create payout persistence schema (AC: 1, 2, 3, 4, 6)
  - [x] Create `pallet_payouts` table with: `id`, `pallet_id`, `winery_id`, `stripe_transfer_id`, `gross_amount_cents`, `commission_amount_cents`, `net_amount_cents`, `currency`, `status`, `failure_reason`, `processed_at`, `created_at`, `updated_at`
  - [x] Add unique constraint `UNIQUE (pallet_id)` to enforce one payout per pallet
  - [x] Add status constraint: `pending | processing | paid | failed`
  - [x] Add indexes on `winery_id`, `status`, `processed_at`
  - [x] Create `pallet_payout_items` table that stores per-authorization contribution: `payout_id`, `payment_authorization_id`, `amount_cents`
- [x] Add payout eligibility SQL function (AC: 1, 6)
  - [x] Create `get_pallet_payout_summary(p_pallet_id uuid)` returning: `gross_cents`, `captured_count`, `currency`, `is_eligible`
  - [x] Eligibility rules: pallet must be `completed`; all linked `payment_authorizations` must be `captured`; no existing `paid` payout row
  - [x] Base amounts on `payment_authorizations.amount_cents` to avoid float errors
- [x] Add idempotent payout claim function (AC: 3)
  - [x] Create `claim_pallet_for_payout(p_pallet_id uuid)` that atomically inserts or returns an existing payout row with `processing` lock semantics
  - [x] Ensure duplicate invocations cannot create multiple payout rows due to unique `pallet_id`
  - [x] Return deterministic outcome: `claimed | already_paid | already_processing | not_eligible`
- [x] Create payout processing Edge Function (AC: 1, 2, 3, 4, 6)
  - [x] Create `supabase/functions/process-pallet-payout/index.ts`
  - [x] Validate JWT and role (`winery` or admin/internal job context)
  - [x] Resolve caller winery profile and verify pallet belongs to that winery unless admin override
  - [x] Retrieve payout summary and commission rules
  - [x] Create Stripe Transfer to `stripe_connect_account_id` with idempotency key `pallet_payout:{pallet_id}`
  - [x] Persist/transition `pallet_payouts` row and write `pallet_payout_items`
  - [x] On failure set payout row to `failed` + reason; keep retriable
- [x] Add fulfillment confirmation endpoint (AC: 1)
  - [x] Create `supabase/functions/confirm-pallet-fulfillment/index.ts`
  - [x] Transition pallet state from `frozen` to `completed` (or verify already completed)
  - [x] Trigger `process-pallet-payout` after completion confirmation
  - [x] Return combined result: fulfillment status + payout status
- [x] Add commission configuration source (AC: 1, 5, 6)
  - [x] Create simple config table `platform_fees` or env-driven rate (e.g., 5%) with explicit decimal precision
  - [x] Store the exact commission rate used per payout row (`commission_bps` or equivalent)
  - [x] Round by integer cents only; no floating point math
- [x] Extend query layer for winery payout visibility (AC: 5)
  - [x] Add `getWineryPayouts(wineryId)` query module in `src/lib/supabase/queries/payouts.ts`
  - [x] Extend `getWineryPickingList` in `virtualPallets.ts` to include payout status fields
  - [x] Add `getPalletPayoutDetail(palletId)` for drill-down/audit view
- [x] Update Winery Dashboard UI (AC: 5)
  - [x] Add payout status column to the picking list table (`pending`, `processing`, `paid`, `failed`)
  - [x] Add net payout KPI and fees KPI cards
  - [x] Add retry action for `failed` payout rows (calls `process-pallet-payout`)
- [x] Add payout reconciliation tests (AC: 3, 4, 6)
  - [x] Test duplicate payout trigger race results in one transfer and one payout row
  - [x] Test failed Stripe transfer marks row `failed` and allows retry
  - [x] Test payout math: `gross = sum(captured authorizations)`, `net = gross - commission`
  - [x] Test reconciliation query returns transfer id and linked authorization item rows

## Dev Notes

### Architecture & Technical Context

- **Dependency on Story 5.1**: this story assumes `payment_authorizations` exists and records buyer payments through `authorized -> captured` transitions. Story 5.2 must not re-model buyer payment state; it consumes captured authorizations as payout input.
- **Payout trigger boundary**:
  - Capture happens at `frozen` (Story 5.1).
  - Payout happens at `completed` + shipped (this story).
  Keep these separated so shipment confirmation remains a release gate.
- **Current repository state**: payment and Stripe Connect code is not yet present in the workspace. This story intentionally defines new Supabase functions and query modules from scratch while preserving existing dashboard patterns.
- **One payout per pallet rule**: enforce at database level (`UNIQUE (pallet_id)`) and at Stripe level (idempotency key). Either layer alone is insufficient.
- **Precision**: all money values are `integer` cents. Never persist decimal currency values.
- **Commission strategy**: compute commission from gross captured cents using basis points (`bps`). Example: `500 bps = 5%`.
- **Stripe object choice**: use Stripe Connect `transfers` for explicit platform-to-connected-account payout control. Keep charge capture in Story 5.1 and transfer in Story 5.2.
- **Authorization reconciliation**: after successful transfer, write itemized links from payout to each contributing authorization for auditability.

### Supabase Schema

```sql
-- 1) Extend winery_profiles with Stripe Connect account reference
ALTER TABLE public.winery_profiles
  ADD COLUMN stripe_connect_account_id text;

CREATE UNIQUE INDEX winery_profiles_stripe_connect_account_id_unique
  ON public.winery_profiles (stripe_connect_account_id)
  WHERE stripe_connect_account_id IS NOT NULL;

-- 2) Payout aggregates (one row per pallet payout)
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

-- 3) Itemized contribution rows for finance traceability
CREATE TABLE public.pallet_payout_items (
  id                        uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  payout_id                 uuid NOT NULL REFERENCES public.pallet_payouts(id) ON DELETE CASCADE,
  payment_authorization_id  uuid NOT NULL REFERENCES public.payment_authorizations(id) ON DELETE RESTRICT,
  amount_cents              integer NOT NULL CHECK (amount_cents > 0),
  created_at                timestamptz DEFAULT now(),
  UNIQUE (payout_id, payment_authorization_id)
);

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
```

### Payout Summary and Claim Functions

```sql
-- Calculate gross payout source from captured authorizations
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
```

```sql
-- Idempotent claim-or-return function for payout processing
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
           WHEN pp.status = 'processing' THEN 'processing'
           WHEN pp.status = 'failed' THEN 'failed_existing'
           ELSE 'claimed'
         END
  FROM public.pallet_payouts pp
  WHERE pp.pallet_id = p_pallet_id;
END;
$$;
```

### Stripe Payout Function

```typescript
// supabase/functions/process-pallet-payout/index.ts
import { serve } from 'https://deno.land/std@0.224.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import Stripe from 'npm:stripe@18.4.0'

serve(async (req) => {
  // 1. Validate auth token and caller role/context
  // 2. Read palletId from payload
  // 3. Fetch payout summary + winery connect account
  // 4. Calculate commission and net in cents
  // 5. Claim payout row via claim_pallet_for_payout(...)
  // 6. If already_paid: return existing row, no-op
  // 7. Create Stripe transfer with idempotency key `pallet_payout:{palletId}`
  // 8. Update pallet_payouts -> paid + stripe_transfer_id + processed_at
  // 9. Insert pallet_payout_items from captured payment_authorizations
  // 10. On failure: set pallet_payouts.status='failed', store reason
})
```

### Fulfillment Confirmation Function

```typescript
// supabase/functions/confirm-pallet-fulfillment/index.ts
serve(async (req) => {
  // 1. Validate JWT
  // 2. Verify pallet belongs to calling winery
  // 3. Transition virtual_pallets.state to 'completed' if currently 'frozen'
  // 4. Invoke process-pallet-payout for this pallet
  // 5. Return completed state + payout outcome
})
```

### Commission Formula

Use basis points to guarantee deterministic integer math:

$$
\text{commission\_cents} = \left\lfloor \frac{\text{gross\_cents} \times \text{commission\_bps}}{10000} \right\rfloor
$$

$$
\text{net\_cents} = \text{gross\_cents} - \text{commission\_cents}
$$

Persist both values in `pallet_payouts` so historical payouts remain auditable even if commission configuration changes later.

### Winery UI Integration

- Extend picking-list rows with payout fields (`payout_status`, `net_amount_cents`, `commission_amount_cents`, `stripe_transfer_id`).
- In `WineryDashboard`, add:
  - KPI: `Net payouts this month`
  - KPI: `Platform fees this month`
  - Table column: `Payout Status`
  - Retry button only on `failed` rows
- Keep existing `stone-*` + `amber-*` visual language from the current Winery dashboard implementation.

### Regression Risks

- **Double payout risk**: if both webhook and manual retry run simultaneously, without DB claim semantics and Stripe idempotency you can pay twice.
- **Premature payout**: payout must not run while pallet is still `frozen` and not confirmed shipped.
- **Missing Connect account**: this should fail fast and mark payout `failed`; do not fallback to platform-held funds silently.
- **Ledger drift**: payout gross must reconcile exactly to captured authorization sums; never source payout gross from pallet bottle count times price at payout time.
- **Retry safety**: failed payouts should be retriable without creating additional payout rows.

### Project Structure Notes

```text
supabase/
└── functions/
    ├── confirm-pallet-fulfillment/
    │   └── index.ts                    ← NEW
    └── process-pallet-payout/
        └── index.ts                    ← NEW

winepooler/
└── src/
    └── lib/
        └── supabase/
            └── queries/
                └── payouts.ts          ← NEW

winepooler/
└── src/
    └── pages/
        └── dashboards/
            └── WineryDashboard.tsx     ← MODIFY (payout status + KPIs)
```

### References

- [Source: _bmad-output/planning-artifacts/epics-stories.md#Story 5.2: Bulk Payout Processing]
- [Source: _bmad-output/planning-artifacts/prd.md#4.4. Financial Automation (Fintech)]
- [Source: _bmad-output/planning-artifacts/Epic5/story_5.1.md] — payment authorization and capture model this story builds upon
- [Source: _bmad-output/planning-artifacts/Epic3/story_3.1.md] — `winery_profiles` schema and winery ownership model
- [Source: winepooler/src/pages/dashboards/WineryDashboard.tsx] — current portal surface to extend for payout status and net revenue KPIs

## Dev Agent Record

### Agent Model Used

GPT-5.4

### Debug Log References

### Completion Notes List

### File List
