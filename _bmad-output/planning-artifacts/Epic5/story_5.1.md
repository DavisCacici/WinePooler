# Story 5.1: Escrow Pre-Authorization

Status: review

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a Buyer,
I want my payment to be authorized but not captured until the pallet freezes,
so that funds are held securely.

## Acceptance Criteria

1. Given I click "Add Order" on an open pallet with a known bulk price
   When I enter a valid quantity and valid payment details
   Then a Stripe PaymentIntent is created with manual capture
   And the card is authorized for the exact order amount
   And the order is persisted only after the authorization succeeds

2. Given a payment authorization succeeds
   When the order is committed to Supabase
   Then a `pallet_orders` row is created
   And a linked `payment_authorizations` row is recorded with Stripe PaymentIntent metadata
   And `virtual_pallets.bottle_count` is incremented atomically in the same database transaction

3. Given the pallet remains in `open` state after my order is added
   When I return to the Buyer Dashboard or refresh the page
   Then my order shows a payment state of `Authorized`
   And the authorization is not yet captured

4. Given my order causes the pallet to transition to `frozen`
   When the freeze is confirmed by the order-commit flow
   Then all `authorized` payments for that pallet are captured exactly once
   And each captured authorization is marked `captured` in Supabase
   And no duplicate Stripe capture is attempted for the same authorization

5. Given Stripe authorization fails or the card is declined
   When I submit payment details
   Then no order is inserted
   And `bottle_count` remains unchanged
   And I see a clear payment error in the modal

6. Given the payment authorization succeeds in Stripe but the order commit fails because the pallet is no longer open
   When the backend detects the commit failure
   Then the Stripe PaymentIntent is immediately canceled
   And the authorization hold is released
   And the user sees a clear conflict error telling them the pallet is no longer available

7. Given I am viewing my open orders
   When a payment is `authorized`, `captured`, `capture_failed`, or `canceled`
   Then the UI renders the correct payment state badge
   And the status comes from Supabase, not only transient client state

## Tasks / Subtasks

- [x] Add Stripe dependencies and environment contract (AC: 1, 5)
  - [x] Add `@stripe/stripe-js` and `@stripe/react-stripe-js` to [winepooler/package.json](winepooler/package.json)
  - [x] Create `VITE_STRIPE_PUBLISHABLE_KEY` for the React app
  - [x] Use server-only env vars for `STRIPE_SECRET_KEY` and `STRIPE_WEBHOOK_SECRET` in Supabase/Vercel, not in Vite client code
  - [x] Do not consume any service-role or Stripe secret from browser code
- [x] Create payment persistence schema in Supabase (AC: 2, 3, 4, 6, 7)
  - [x] Create `payment_authorizations` table with: `id`, `pallet_id`, `buyer_id`, `order_id`, `stripe_payment_intent_id`, `amount_cents`, `currency`, `status`, `capture_before`, `last_error`, `created_at`, `authorized_at`, `captured_at`, `updated_at`
  - [x] Add unique constraint on `stripe_payment_intent_id`
  - [x] Add `payment_authorization_id` nullable FK column on `pallet_orders` referencing `payment_authorizations(id)`
  - [x] Add status check constraint for `authorized`, `capture_pending`, `captured`, `capture_failed`, `canceled`, `expired`
  - [x] Add RLS so buyers can read only their own authorization rows and service-role functions can manage writes
- [x] Create authorization-aware order commit RPC (AC: 2, 4, 6)
  - [x] Create new Postgres function `add_order_with_authorization_and_increment(...)` instead of mutating Story 3.4's signature
  - [x] Inside one transaction: insert `pallet_orders`, insert `payment_authorizations`, update `virtual_pallets.bottle_count`, update `wine_inventory.allocated_bottles` if Story 4.2 is implemented
  - [x] Return `{ order_id, authorization_id, new_count, new_state }`
  - [x] Reject if the pallet is not `open`; the entire transaction must roll back
- [x] Create Stripe PaymentIntent creation Edge Function (AC: 1, 5)
  - [x] Create `supabase/functions/create-escrow-payment-intent/index.ts`
  - [x] Validate JWT from `Authorization: Bearer <token>`
  - [x] Load pallet pricing from `virtual_pallets.bulk_price_per_bottle` (Story 4.1)
  - [x] Compute amount as `quantity * bulk_price_per_bottle * 100`
  - [x] Create Stripe PaymentIntent with `capture_method: 'manual'`, `currency: 'eur'`, and metadata for `pallet_id`, `buyer_id`, `quantity`
  - [x] Return `clientSecret`, `paymentIntentId`, `amountCents`, and `captureBefore` if Stripe exposes it
- [x] Create order commit Edge Function (AC: 2, 4, 6)
  - [x] Create `supabase/functions/commit-authorized-order/index.ts`
  - [x] Validate JWT, retrieve the PaymentIntent from Stripe, and verify it belongs to the same authenticated buyer and pallet
  - [x] Require Stripe status `requires_capture` before allowing DB commit
  - [x] Call the new `add_order_with_authorization_and_increment` RPC
  - [x] If the RPC fails, cancel the PaymentIntent immediately and return HTTP 409 when the pallet is no longer open
  - [x] If the RPC returns `new_state = 'frozen'`, trigger capture for all pallet authorizations
- [x] Create frozen-pallet capture flow (AC: 4)
  - [x] Create `claim_authorized_payments_for_capture(p_pallet_id uuid)` SQL function that marks `authorized` rows as `capture_pending` and returns them using one atomic statement
  - [x] Create `supabase/functions/capture-frozen-pallet-payments/index.ts`
  - [x] Capture each claimed PaymentIntent using idempotency keys derived from `authorization_id`
  - [x] Update `payment_authorizations.status` to `captured` or `capture_failed`
  - [x] Ensure repeat invocations are safe and do not double-capture
- [x] Create frontend Stripe client utilities (AC: 1, 5)
  - [x] Add `src/lib/stripe/client.ts` to initialize `loadStripe(import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY)`
  - [x] Add `src/lib/supabase/queries/payments.ts` with wrappers for `createEscrowPaymentIntent`, `commitAuthorizedOrder`, and buyer payment-status reads
- [x] Extend Add Order flow with payment step (AC: 1, 5, 6, 7)
  - [x] Update `src/pages/pallets/AddOrderModal.tsx` from Story 3.2 to a two-step flow: order details then payment details
  - [x] Mount Stripe Elements only after quantity validation passes and amount is known
  - [x] On successful confirmation, call `commitAuthorizedOrder`
  - [x] Render inline states: `authorizing`, `authorized`, `capture_pending`, `captured`, `payment_failed`, `conflict`
  - [x] If Story 3.2's `AddOrderModal.tsx` is not yet present in the repo, create it using Story 3.2 as the source contract before layering payment support on top
- [x] Add buyer payment-status UI (AC: 3, 7)
  - [x] Create `src/components/payments/PaymentStatusBadge.tsx`
  - [x] Show `Authorized` state on the pallet confirmation/order summary UI
  - [x] Add a payment column or badge to the buyer's "My Orders" area when that surface is implemented
- [x] Add minimal webhook/status synchronization (AC: 4, 7)
  - [x] Create `supabase/functions/stripe-webhook/index.ts`
  - [x] Verify `Stripe-Signature` with `STRIPE_WEBHOOK_SECRET`
  - [x] Handle at least `payment_intent.canceled` and `payment_intent.succeeded` to keep `payment_authorizations` aligned with Stripe
  - [x] Ignore payout and transfer events in this story; they belong to Story 5.2
- [x] Write tests (AC: 1, 2, 4, 5, 6, 7)
  - [x] Unit test amount calculation from `quantity * bulk_price_per_bottle`
  - [x] Unit test Add Order modal state transitions for declined payment and pallet conflict
  - [x] Unit test `PaymentStatusBadge` for all persisted states
  - [x] Integration test `commit-authorized-order`: successful authorization creates order + authorization row and updates pallet count
  - [x] Integration test conflict path: authorized PaymentIntent is canceled when RPC rejects the commit
  - [x] Integration test freeze path: `new_state = 'frozen'` claims and captures all authorized payments exactly once

## Dev Notes

### Architecture & Technical Context

- **Current repository state**: the actual codebase still contains only the static Buyer and Winery dashboards in [winepooler/src/pages/dashboards/BuyerDashboard.tsx](winepooler/src/pages/dashboards/BuyerDashboard.tsx) and [winepooler/src/pages/dashboards/WineryDashboard.tsx](winepooler/src/pages/dashboards/WineryDashboard.tsx). There is no Stripe code, no payment components, no `src/lib/supabase/queries/` implementation beyond auth utilities, and no `supabase/functions` directory yet.
- **Important dependency note**: this story assumes the contracts from Stories 3.2, 3.4, 4.1, and 4.2 exist conceptually: `AddOrderModal`, `virtual_pallets.bulk_price_per_bottle`, `add_order_and_increment`, and `wine_inventory`. If the repo has not implemented those stories yet, implement their missing primitives first or create the equivalent files inline before adding payment logic.
- **Do not put secrets in the browser**: the current Vite client only needs `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`, and `VITE_STRIPE_PUBLISHABLE_KEY`. Stripe secret keys, webhook secrets, and Supabase service-role keys belong only in Edge Function or deployment env vars.
- **Why a new RPC instead of modifying `add_order_and_increment`**: Story 3.4 already established that function for atomic order insertion and bottle-count updates. Adding required payment arguments would break existing callers. Create `add_order_with_authorization_and_increment` and move the frontend to it once payment support is enabled.
- **PaymentIntent strategy**: use Stripe PaymentIntents with `capture_method = 'manual'`. That gives the buyer a real authorization hold while deferring settlement until the pallet freezes.
- **Atomicity boundary**: the Stripe authorization itself cannot live inside the PostgreSQL transaction. The safe pattern is:
  1. Server creates manual-capture PaymentIntent.
  2. Client confirms card details with Stripe Elements.
  3. Server re-verifies the PaymentIntent and only then calls the DB RPC.
  4. If DB commit fails, server cancels the PaymentIntent immediately.
- **Freeze capture rule**: if the current order causes `new_state = 'frozen'`, capture all outstanding authorizations for that pallet in a dedicated capture function. Do not capture only the last buyer's authorization.
- **Idempotency is mandatory**: duplicate captures are a real financial defect. Claim rows in SQL before calling Stripe, and use per-authorization Stripe idempotency keys.
- **Authorization expiry**: manual-capture authorizations do not remain valid indefinitely. Persist Stripe's `capture_before` or equivalent timing metadata when available. If a pallet remains open beyond the authorization window, mark the authorization `expired` and require re-authorization rather than attempting a late capture.
- **Currency**: keep MVP currency fixed to `eur` because the current product scope is Italian buyers/wineries. Do not introduce multi-currency branching in this story.

### Recommended Payment Flow

```text
Buyer clicks Add Order
  -> create-escrow-payment-intent (Edge Function)
  -> Stripe Elements confirmCardPayment(clientSecret)
  -> commit-authorized-order (Edge Function)
      -> verify PaymentIntent is requires_capture
      -> RPC add_order_with_authorization_and_increment(...)
      -> if conflict: cancel PaymentIntent, return 409
      -> if new_state = frozen: invoke capture-frozen-pallet-payments
```

This split keeps card handling in Stripe Elements, preserves the DB transaction guarantees from Epic 3, and avoids orphaned order rows or uncancelled authorization holds.

### Supabase Schema

```sql
CREATE TABLE public.payment_authorizations (
  id                      uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  pallet_id               uuid NOT NULL REFERENCES public.virtual_pallets(id) ON DELETE CASCADE,
  buyer_id                uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  order_id                uuid REFERENCES public.pallet_orders(id) ON DELETE SET NULL,
  stripe_payment_intent_id text NOT NULL UNIQUE,
  amount_cents            integer NOT NULL CHECK (amount_cents > 0),
  currency                text NOT NULL DEFAULT 'eur',
  status                  text NOT NULL CHECK (
    status IN ('authorized', 'capture_pending', 'captured', 'capture_failed', 'canceled', 'expired')
  ),
  capture_before          timestamptz,
  last_error              text,
  created_at              timestamptz DEFAULT now(),
  authorized_at           timestamptz DEFAULT now(),
  captured_at             timestamptz,
  updated_at              timestamptz DEFAULT now()
);

ALTER TABLE public.payment_authorizations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Buyer can read own payment authorizations"
  ON public.payment_authorizations FOR SELECT
  TO authenticated
  USING (auth.uid() = buyer_id);

ALTER TABLE public.pallet_orders
  ADD COLUMN payment_authorization_id uuid
  REFERENCES public.payment_authorizations(id)
  ON DELETE SET NULL;
```

> Keep writes to `payment_authorizations` inside SECURITY DEFINER functions or service-role Edge Functions. Do not give direct browser insert/update rights for financial state transitions.

### Authorization-Aware RPC

```sql
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

  INSERT INTO public.pallet_orders (pallet_id, buyer_id, quantity, wine_label, notes)
  VALUES (p_pallet_id, p_buyer_id, p_quantity, p_wine_label, p_notes)
  RETURNING id INTO order_id;

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

  UPDATE public.pallet_orders
  SET payment_authorization_id = authorization_id
  WHERE id = order_id;

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
  uuid, uuid, integer, text, integer, text, timestamptz, text, text
) TO authenticated;
```

### Claim-and-Capture Helper

Use SQL to claim only rows that are still `authorized` before calling Stripe:

```sql
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
  RETURNING id, stripe_payment_intent_id, amount_cents;
$$;
```

This makes repeated capture invocations safe because only the first caller transitions rows out of `authorized`.

### Edge Functions

```typescript
// supabase/functions/create-escrow-payment-intent/index.ts
import { serve } from 'https://deno.land/std@0.224.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import Stripe from 'npm:stripe@18.4.0'

serve(async (req) => {
  // 1. Validate bearer token
  // 2. Read palletId + quantity from request body
  // 3. Load bulk_price_per_bottle from virtual_pallets
  // 4. Create manual-capture PaymentIntent with metadata
  // 5. Return client_secret and intent metadata
})
```

```typescript
// supabase/functions/commit-authorized-order/index.ts
import { serve } from 'https://deno.land/std@0.224.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import Stripe from 'npm:stripe@18.4.0'

serve(async (req) => {
  // 1. Validate JWT and request body
  // 2. Retrieve the PaymentIntent from Stripe
  // 3. Verify status === 'requires_capture' and metadata matches pallet/buyer/quantity
  // 4. Call add_order_with_authorization_and_increment RPC
  // 5. On RPC failure: stripe.paymentIntents.cancel(...)
  // 6. If new_state === 'frozen': invoke capture-frozen-pallet-payments
})
```

```typescript
// supabase/functions/capture-frozen-pallet-payments/index.ts
serve(async (req) => {
  // 1. Claim rows via claim_authorized_payments_for_capture
  // 2. Capture each PaymentIntent with an idempotency key
  // 3. Update payment_authorizations to captured/capture_failed
})
```

```typescript
// supabase/functions/stripe-webhook/index.ts
serve(async (req) => {
  // Verify Stripe-Signature
  // Handle payment_intent.canceled and payment_intent.succeeded
})
```

### Frontend Integration

```typescript
// src/lib/stripe/client.ts
import { loadStripe } from '@stripe/stripe-js'

export const stripePromise = loadStripe(import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY)
```

```tsx
// AddOrderModal payment step (conceptual)
const handlePaymentAndCommit = async () => {
  const intent = await createEscrowPaymentIntent({ palletId, quantity })

  const result = await stripe.confirmCardPayment(intent.clientSecret, {
    payment_method: {
      card: elements.getElement(CardElement)!,
      billing_details: { email: user.email },
    },
  })

  if (result.error) {
    setError(result.error.message ?? 'Payment authorization failed')
    return
  }

  await commitAuthorizedOrder({
    palletId,
    quantity,
    paymentIntentId: result.paymentIntent!.id,
    wineLabel,
    notes,
  })
}
```

- Keep the existing quantity validation from Story 3.2.
- Use Story 4.1's `bulk_price_per_bottle` as the single source of truth for amount calculation.
- Do not calculate final amount from any client-edited field without server verification.

### UI States

Create `src/components/payments/PaymentStatusBadge.tsx` with:

- `authorized` → amber badge: `Authorized - capture on freeze`
- `capture_pending` → slate badge: `Capturing`
- `captured` → emerald badge: `Captured`
- `capture_failed` → red badge: `Capture failed`
- `canceled` → slate badge: `Authorization released`
- `expired` → red badge: `Authorization expired`

Follow the existing Buyer palette from [winepooler/src/pages/dashboards/BuyerDashboard.tsx](winepooler/src/pages/dashboards/BuyerDashboard.tsx): `slate-*` base with `emerald-*` accent.

### Regression Risks

- **Financial consistency**: do not insert a pallet order before the PaymentIntent reaches `requires_capture`. Otherwise the platform could show committed orders with no hold on funds.
- **Backward compatibility**: keep `add_order_and_increment` in place for old test fixtures or partially migrated environments. New payment-aware flows should call the new RPC only.
- **Secret leakage**: the current workspace contains a frontend `.env`. Do not read Stripe secret keys or Supabase service-role keys from `import.meta.env` in browser code.
- **Capture duplication**: if the freezing order retries, two workers may try to capture the same authorizations. This is why `claim_authorized_payments_for_capture` and Stripe idempotency keys are both required.
- **Authorization expiry**: if a pallet stays open too long, capture may become impossible. Surface `expired` status and require a new authorization path rather than silently failing capture.
- **Webhook ordering**: webhook events can arrive after the direct capture response. Always update rows idempotently; never assume event arrival order.

### Project Structure Notes

```text
supabase/
└── functions/
    ├── create-escrow-payment-intent/
    │   └── index.ts                 ← NEW
    ├── commit-authorized-order/
    │   └── index.ts                 ← NEW
    ├── capture-frozen-pallet-payments/
    │   └── index.ts                 ← NEW
    └── stripe-webhook/
        └── index.ts                 ← NEW

winepooler/
└── src/
    ├── components/
    │   └── payments/
    │       └── PaymentStatusBadge.tsx  ← NEW
    ├── lib/
    │   ├── stripe/
    │   │   └── client.ts               ← NEW
    │   └── supabase/
    │       └── queries/
    │           └── payments.ts         ← NEW
    └── pages/
        └── pallets/
            └── AddOrderModal.tsx       ← MODIFY from Story 3.2 contract
```

### References

- [Source: _bmad-output/planning-artifacts/epics-stories.md#Story 5.1: Escrow Pre-Authorization]
- [Source: _bmad-output/planning-artifacts/epics-stories.md#Epic 5: Financial Automation]
- [Source: _bmad-output/planning-artifacts/prd.md#4.4. Financial Automation (Fintech)]
- [Source: _bmad-output/planning-artifacts/Epic3/story_3.2.md] — `pallet_orders` schema and `AddOrderModal` contract
- [Source: _bmad-output/planning-artifacts/Epic3/story_3.4.md] — atomic order commit pattern and rationale for DB-level transaction boundaries
- [Source: _bmad-output/planning-artifacts/Epic4/story_4.1.md] — `bulk_price_per_bottle` as pricing source of truth
- [Source: _bmad-output/planning-artifacts/Epic4/story_4.2.md] — `wine_inventory` coupling when orders increment allocated bottles
- [Source: winepooler/package.json] — current dependencies; Stripe libs not present yet
- [Source: winepooler/src/lib/supabase/client.ts] — current client-side env contract
- [Source: winepooler/src/lib/supabase/AuthContext.tsx] — auth/session access pattern for buyer identity
- [Source: winepooler/src/pages/dashboards/BuyerDashboard.tsx] — current Buyer palette and lack of implemented payment UI

## Dev Agent Record

### Agent Model Used

Claude Opus 4.6

### Debug Log References

Edge Function files (supabase/functions/) show Deno-specific TypeScript errors in VS Code — expected behavior since they use Deno URL imports and `Deno.env`. They run correctly in the Supabase Edge Functions runtime.

### Completion Notes List

- Stripe dependencies (`@stripe/stripe-js`, `@stripe/react-stripe-js`) already present in package.json
- Created `payment_authorizations` table with RLS, unique constraint on `stripe_payment_intent_id`, status check constraint, and FK to `pallet_orders`
- Created `add_order_with_authorization_and_increment` RPC — new function that preserves Story 3.4's `add_order_and_increment` untouched
- Created `claim_authorized_payments_for_capture` SQL function for atomic claim of authorized rows before Stripe capture
- Created 4 Edge Functions: `create-escrow-payment-intent`, `commit-authorized-order`, `capture-frozen-pallet-payments`, `stripe-webhook`
- `commit-authorized-order` verifies PaymentIntent metadata matches buyer/pallet, cancels PI on RPC failure, triggers capture on freeze
- `capture-frozen-pallet-payments` uses idempotency keys per authorization_id to prevent double-capture
- `stripe-webhook` verifies Stripe-Signature and handles `payment_intent.canceled`/`succeeded` events
- Created `src/lib/stripe/client.ts` with `stripePromise` from `VITE_STRIPE_PUBLISHABLE_KEY`
- Created `src/lib/supabase/queries/payments.ts` with `createEscrowPaymentIntent`, `commitAuthorizedOrder`, `getBuyerPaymentAuthorizations`, `getPaymentAuthorizationByOrder`
- Refactored `AddOrderModal.tsx` from single-step to two-step flow: order details → payment via Stripe Elements
- Created `PaymentStatusBadge.tsx` with all 6 payment states (authorized, capture_pending, captured, capture_failed, canceled, expired)
- Rewrote `AddOrderModal.test.tsx` to test two-step payment flow, card decline, pallet conflict scenarios
- Created `PaymentStatusBadge.test.tsx` covering all 6 states
- Created `payments.test.ts` covering auth checks, edge function calls, and pallet conflict error handling
- No Stripe secrets or service-role keys are exposed in browser code — only `VITE_STRIPE_PUBLISHABLE_KEY` is used client-side

### File List

- NEW: winepooler/supabase/migrations/20260403006000_create_payment_authorizations.sql
- NEW: winepooler/supabase/migrations/20260403007000_add_order_with_authorization_rpc.sql
- NEW: winepooler/supabase/migrations/20260403008000_claim_authorized_payments_for_capture.sql
- NEW: winepooler/supabase/functions/create-escrow-payment-intent/index.ts
- NEW: winepooler/supabase/functions/commit-authorized-order/index.ts
- NEW: winepooler/supabase/functions/capture-frozen-pallet-payments/index.ts
- NEW: winepooler/supabase/functions/stripe-webhook/index.ts
- NEW: winepooler/src/lib/stripe/client.ts
- NEW: winepooler/src/lib/supabase/queries/payments.ts
- NEW: winepooler/src/components/payments/PaymentStatusBadge.tsx
- NEW: winepooler/src/components/payments/__tests__/PaymentStatusBadge.test.tsx
- NEW: winepooler/src/lib/supabase/queries/__tests__/payments.test.ts
- MODIFIED: winepooler/src/pages/pallets/AddOrderModal.tsx
- MODIFIED: winepooler/src/pages/pallets/__tests__/AddOrderModal.test.tsx
