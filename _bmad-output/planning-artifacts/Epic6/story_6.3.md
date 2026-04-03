# Story 6.3: Stripe Payment Integration

Status: ready-for-dev

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a developer,
I want Stripe Connect for payments,
so that financial operations are possible.

## Acceptance Criteria

1. Given Supabase integration is operational (Story 6.2)
   When Stripe is integrated into frontend and edge-function backend layers
   Then payment processing works end-to-end for manual-capture authorizations
   And the integration uses Stripe Connect-compatible account flows

2. Given required Stripe credentials are configured
   When the app and edge functions boot
   Then frontend uses only publishable key configuration
   And backend uses secret keys and webhook signing secrets
   And no secret appears in browser code or client-visible payloads

3. Given a buyer initiates checkout for an order
   When payment details are confirmed
   Then a Stripe PaymentIntent is created and confirmed with `capture_method = manual`
   And the platform stores Stripe identifiers in Supabase for reconciliation

4. Given Stripe sends payment lifecycle events
   When webhook events are received
   Then signatures are verified
   And relevant payment states are persisted idempotently in Supabase

5. Given a winery has a valid connected account
   When payout orchestration runs (Story 5.2)
   Then Stripe transfer calls succeed against the connected account
   And transfer identifiers are persisted for auditability

6. Given automated checks run in local/CI environments
   When Stripe integration tests execute with mocked Stripe API responses
   Then critical paths pass: authorization, capture, webhook handling, and transfer orchestration

## Tasks / Subtasks

- [ ] Add Stripe SDK dependencies and package hygiene (AC: 1, 3, 6)
  - [ ] Add frontend SDKs in [winepooler/package.json](winepooler/package.json): `@stripe/stripe-js`, `@stripe/react-stripe-js`
  - [ ] Add server SDK dependency guidance for Supabase Edge Functions using `npm:stripe` import pattern
  - [ ] Keep Stripe version pinning consistent across all edge functions to avoid API drift
- [ ] Establish Stripe environment contract (AC: 2)
  - [ ] Frontend env: `VITE_STRIPE_PUBLISHABLE_KEY`
  - [ ] Backend/edge env: `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`
  - [ ] Connect flow env (if needed): `STRIPE_CONNECT_CLIENT_ID` or account-link config values
  - [ ] Document env separation clearly in [winepooler/README.md](winepooler/README.md)
- [ ] Implement frontend Stripe bootstrap utilities (AC: 1, 3)
  - [ ] Create `src/lib/stripe/client.ts` for `loadStripe(import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY)`
  - [ ] Create payment UI provider wrapper under `src/components/payments/` for Stripe Elements mounting
  - [ ] Add guardrails for missing publishable key with developer-facing error messaging
- [ ] Implement payment intent orchestration edge functions (AC: 1, 3)
  - [ ] Create `supabase/functions/create-escrow-payment-intent/index.ts` for manual-capture PaymentIntent creation
  - [ ] Create `supabase/functions/commit-authorized-order/index.ts` to verify intent status and commit order via DB RPC
  - [ ] Ensure metadata consistency checks (`pallet_id`, `buyer_id`, `quantity`) before DB commit
  - [ ] Handle conflict rollback path: cancel authorization when DB commit fails
- [ ] Implement webhook processing baseline (AC: 4)
  - [ ] Create `supabase/functions/stripe-webhook/index.ts`
  - [ ] Verify `Stripe-Signature` using `STRIPE_WEBHOOK_SECRET`
  - [ ] Handle idempotently at minimum: `payment_intent.succeeded`, `payment_intent.canceled`, `payment_intent.payment_failed`
  - [ ] Persist event processing dedupe keys (event id) to avoid replay side effects
- [ ] Implement Stripe Connect account and transfer integration points (AC: 1, 5)
  - [ ] Add connected-account storage contract on `winery_profiles` (`stripe_connect_account_id`) if not already migrated
  - [ ] Add helper edge function for account validation/onboarding link generation (optional MVP booster)
  - [ ] Integrate transfer creation flow used by Story 5.2 payout processing
  - [ ] Ensure idempotency key strategy for transfers: one transfer per pallet payout
- [ ] Align with Epic 5 financial stories (AC: 1, 5)
  - [ ] Reuse Story 5.1 payment authorization schema/contracts (`payment_authorizations`, authorization status lifecycle)
  - [ ] Reuse Story 5.2 payout ledger schema/contracts (`pallet_payouts`, `pallet_payout_items`)
  - [ ] Keep Story 6.3 focused on infrastructure/integration enablement, not business-rule redesign
- [ ] Add Stripe integration tests (AC: 6)
  - [ ] Unit tests for amount and metadata assembly in PaymentIntent creation
  - [ ] Unit tests for webhook signature verification and idempotent event handling
  - [ ] Integration test for commit-authorized-order conflict cancellation path
  - [ ] Integration test for transfer creation idempotency under duplicate trigger
- [ ] Add operational runbook for Stripe dev/test/prod (AC: 2, 6)
  - [ ] Document Stripe test mode setup and key rotation procedure
  - [ ] Document webhook local tunneling strategy and test replay workflow
  - [ ] Document production cutover checklist (keys, webhook endpoint, monitored events)

## Dev Notes

### Architecture & Technical Context

- **Current repository state**: there is currently no Stripe code in frontend source and no `supabase/functions` payment endpoints in the workspace.
- **Dependency on Story 6.2**: Supabase auth/db/realtime baseline must be in place before Stripe edge functions and payout orchestration can be validated.
- **Dependency on Epic 5 contracts**:
  - Story 5.1 defines manual-capture PaymentIntent flow and payment authorization persistence.
  - Story 5.2 defines payout transfer and reconciliation model for wineries.
  Story 6.3 should provide the integration framework and plumbing that those stories use.
- **Security boundary**:
  - Browser: publishable key only.
  - Edge/server: secret key + webhook secret.
  - Never expose service-role or Stripe secrets in frontend bundles.
- **Idempotency baseline**:
  - PaymentIntent and transfer operations must include deterministic idempotency keys.
  - Webhook handler must deduplicate by Stripe event id.

### Stripe Integration Blueprint

```text
Frontend
  -> Stripe Elements + publishable key
  -> calls Supabase Edge Function for intent creation

Supabase Edge Functions
  -> Stripe secret key operations (PaymentIntent, capture, transfer)
  -> DB RPC calls for atomic order/payout state commits
  -> webhook verification and state synchronization

Supabase Database
  -> payment_authorizations (Story 5.1)
  -> pallet_payouts + pallet_payout_items (Story 5.2)
  -> winery_profiles.stripe_connect_account_id
```

### Environment Variables

Frontend (`Vite`):

- `VITE_STRIPE_PUBLISHABLE_KEY`
- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_ANON_KEY`

Edge Function runtime:

- `STRIPE_SECRET_KEY`
- `STRIPE_WEBHOOK_SECRET`
- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`

### Suggested Webhook Event Coverage (MVP)

- `payment_intent.succeeded`
- `payment_intent.canceled`
- `payment_intent.payment_failed`
- `transfer.created` (for payout observability)
- `transfer.failed` (for payout retry diagnostics)

Persist raw payload + normalized status outcome for debugging and audit.

### Testing Strategy

- Use mocked Stripe client responses for deterministic unit/integration tests.
- Keep one contract-level test per critical edge function:
  - create-escrow-payment-intent
  - commit-authorized-order
  - stripe-webhook
  - process-pallet-payout
- Validate idempotency by invoking each function twice with same business key and asserting single persisted side effect.

### Regression Risks

- Misconfigured secrets can silently break webhook verification and lead to stale payment state.
- If metadata validation is skipped in commit-authorized-order, malicious or stale intent reuse can corrupt order/payment linkage.
- Without webhook dedupe storage, Stripe retries can create duplicate status transitions.
- Inconsistent Stripe SDK versions across edge functions can cause subtle API behavior mismatches.

### Project Structure Notes

```text
winepooler/
├── src/
│   ├── lib/
│   │   ├── stripe/
│   │   │   └── client.ts                         ← NEW
│   │   └── supabase/
│   │       └── queries/
│   │           └── payments.ts                   ← NEW/extend
│   └── components/
│       └── payments/
│           ├── StripeElementsProvider.tsx        ← NEW
│           └── PaymentStatusBadge.tsx            ← from Story 5.1

supabase/
└── functions/
    ├── create-escrow-payment-intent/
    │   └── index.ts                              ← NEW
    ├── commit-authorized-order/
    │   └── index.ts                              ← NEW
    ├── stripe-webhook/
    │   └── index.ts                              ← NEW
    └── process-pallet-payout/
        └── index.ts                              ← from Story 5.2 integration
```

### References

- [Source: _bmad-output/planning-artifacts/epics-stories.md#Story 6.3: Stripe Payment Integration]
- [Source: _bmad-output/planning-artifacts/prd.md#4.4. Financial Automation (Fintech)]
- [Source: _bmad-output/planning-artifacts/prd.md#6. Technical Specifications]
- [Source: _bmad-output/planning-artifacts/Epic6/story_6.2.md]
- [Source: _bmad-output/planning-artifacts/Epic5/story_5.1.md]
- [Source: _bmad-output/planning-artifacts/Epic5/story_5.2.md]
- [Source: winepooler/package.json]

## Dev Agent Record

### Agent Model Used

GPT-5.4

### Debug Log References

### Completion Notes List

### File List
