# Story 6.5: Security Implementation

Status: ready-for-dev

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a developer,
I want RLS and encrypted variables,
so that data is secure.

## Acceptance Criteria

1. Given Supabase database tables exist
   When I enable Row Level Security policies
   Then every table has RLS enabled with explicit policies
   And users can only read/write data they own or are authorized to access
   And anonymous access is restricted to only public reference data (e.g., `macro_areas`)

2. Given the deferred work item "Client-side role metadata trusted without server enforcement [auth.ts:24]"
   When server-side role enforcement is implemented
   Then RLS policies use `auth.jwt() ->> 'role'` claims from Supabase Auth metadata
   And privilege escalation via client-side role tampering is impossible
   And buyer-role tokens cannot access winery-only data and vice versa

3. Given Edge Functions access sensitive Stripe and Supabase secrets
   When secrets are managed
   Then `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, and `SUPABASE_SERVICE_ROLE_KEY` are stored only in Vercel/Supabase environment settings
   And no secret values appear in client-side source maps, bundles, or runtime network payloads
   And only `VITE_*` prefixed variables are accessible from frontend code

4. Given webhook endpoints receive external requests
   When Stripe webhooks arrive at the `stripe-webhook` Edge Function
   Then the Stripe signature is verified before any processing
   And invalid/replayed signatures are rejected with appropriate HTTP status codes

5. Given RLS policies must be auditable and reproducible
   When security policies are defined
   Then all RLS policies are expressed in Supabase migration files (not ad-hoc SQL)
   And policies follow a consistent naming convention
   And a security audit summary documents which tables have which policies

## Tasks / Subtasks

- [ ] Audit all existing RLS policies across 18 migration files (AC: 1, 5)
  - [ ] Inventory every table and its current RLS status (enabled/disabled, policy names)
  - [ ] Identify tables missing RLS or with insufficient policies
  - [ ] Document findings in a security audit table
- [ ] Create comprehensive RLS migration for missing/incomplete policies (AC: 1, 2)
  - [ ] `buyer_profiles` — owner-only CRUD via `auth.uid() = user_id`
  - [ ] `buyer_preferences` — owner-only CRUD via join to `buyer_profiles.user_id`
  - [ ] `winery_profiles` — owner-only write, authenticated read for marketplace
  - [ ] `wine_inventory` — winery-owner write, authenticated read for marketplace
  - [ ] `virtual_pallets` — authenticated read (area-scoped), system-managed writes
  - [ ] `pallet_orders` — owner read/create, system-managed updates
  - [ ] `payment_authorizations` — owner-only read, Edge Function write via service role
  - [ ] `pallet_payouts` / `pallet_payout_items` — winery-owner read, Edge Function write
  - [ ] `macro_areas` — authenticated read (already exists), admin-only write
- [ ] Implement server-side role enforcement (AC: 2)
  - [ ] Verify Supabase Auth stores role in `raw_user_meta_data` or `raw_app_meta_data`
  - [ ] Create RLS policies that use `auth.jwt() ->> 'user_metadata' ->> 'role'` for role-based access
  - [ ] Add policies separating buyer-only and winery-only table access
  - [ ] Test that a buyer JWT cannot read `winery_profiles` owned data or `pallet_payouts`
- [ ] Validate environment variable security (AC: 3)
  - [ ] Audit `winepooler/src/` for any references to non-`VITE_` env vars
  - [ ] Verify Vercel env var scoping: Preview vs Production separation
  - [ ] Confirm Edge Functions use `Deno.env.get()` for secrets, not hardcoded values
  - [ ] Run a production build and verify no secrets leak into `dist/` output
- [ ] Validate webhook signature verification (AC: 4)
  - [ ] Review `stripe-webhook` Edge Function for `Stripe.webhooks.constructEvent` usage
  - [ ] Confirm 400/401 responses for invalid signatures
  - [ ] Verify idempotency: duplicate event IDs don't create duplicate state transitions
- [ ] Create security audit summary document (AC: 5)
  - [ ] Table of all database tables with RLS status, policy names, and access patterns
  - [ ] Environment variable inventory with scope (frontend/edge/server)
  - [ ] Webhook security verification checklist

## Dev Notes

### Architecture & Technical Context

- **18 existing migration files** in `supabase/migrations/` — some already have RLS (e.g., `macro_areas` has `SELECT` for authenticated users). This story must audit ALL tables and fill gaps.
- **Deferred work from code review 1.1** is the primary driver: "Client-side role metadata trusted without server enforcement [auth.ts:24] — needs server-side RLS/claims to prevent privilege escalation." This is a real security vulnerability that must be closed.
- **6 Edge Functions** exist under `supabase/functions/` — all use `STRIPE_SECRET_KEY` and `SUPABASE_SERVICE_ROLE_KEY` via `Deno.env.get()`. Verify no function accidentally exposes secrets in response bodies.
- **Env guard pattern** established in Story 6.2: `client.ts` throws on missing `VITE_SUPABASE_URL`/`VITE_SUPABASE_ANON_KEY`. Story 6.3 added a console.warn fallback for `VITE_STRIPE_PUBLISHABLE_KEY`.
- **No architecture document exists** — security patterns are derived from PRD NFR2, story files, and Supabase best practices.

### Key Tables Requiring RLS Audit

| Table | Expected Access Pattern |
|-------|------------------------|
| `buyer_profiles` | Owner CRUD, system read |
| `buyer_preferences` | Owner CRUD |
| `winery_profiles` | Owner write, authenticated read |
| `wine_inventory` | Winery-owner write, authenticated read |
| `virtual_pallets` | Authenticated read (area-scoped), system write |
| `pallet_orders` | Owner create/read, system update |
| `payment_authorizations` | Owner read, service-role write |
| `pallet_payouts` | Winery-owner read, service-role write |
| `pallet_payout_items` | Winery-owner read, service-role write |
| `macro_areas` | Authenticated read (exists), admin write |

### RLS Policy Naming Convention

Follow pattern: `{table}_{operation}_{role}` — e.g., `buyer_profiles_select_owner`, `virtual_pallets_select_authenticated`, `payment_authorizations_insert_service_role`.

### Previous Story Learnings

- Story 6.2: "Use migration files as the canonical source for schema/RLS, not ad-hoc SQL"
- Story 6.3: "Security boundary: Browser = publishable key only. Edge/server = secret key + webhook secret"
- Story 6.4: "No secret values should be present in client source maps or runtime network payloads"
- Story 6.2: "Existing test coverage: AuthContext (session bootstrap, role extraction)"

### Regression Risks

- Overly restrictive RLS can break existing dashboard queries (e.g., BuyerDashboard reads `virtual_pallets` by area).
- Changing role claim path in RLS can break if Auth metadata structure differs between `raw_user_meta_data` and JWT claims.
- New migration must not conflict with existing migration order — use timestamp after last existing migration.
- Edge Functions that use service role key bypass RLS intentionally — do not add RLS policies that block service role operations.

### Testing Strategy

- **Migration-level**: Apply new migration to local Supabase, verify all policies exist and tables have RLS enabled.
- **Role-based query tests**: Create test users with buyer and winery roles, verify cross-role data isolation.
- **Build audit**: Run `npm run build` and inspect `dist/` for leaked env vars.
- **Webhook test**: Send malformed signature to stripe-webhook and verify rejection.

### Project Structure Notes

```text
supabase/
└── migrations/
    └── YYYYMMDDHHMMSS_comprehensive_rls_policies.sql  ← NEW
winepooler/
└── docs/
    └── security-audit.md                               ← NEW (optional)
```

### References

- [Source: _bmad-output/planning-artifacts/epics-stories.md#Story 6.5: Security Implementation]
- [Source: _bmad-output/planning-artifacts/prd.md#8. Non-Functional Requirements — NFR2]
- [Source: _bmad-output/implementation-artifacts/deferred-work.md#code review of story_1.1]
- [Source: _bmad-output/planning-artifacts/Epic6/story_6.2.md — env contract, migration workflow]
- [Source: _bmad-output/planning-artifacts/Epic6/story_6.3.md — Stripe security boundary]
- [Source: _bmad-output/planning-artifacts/Epic6/story_6.4.md — Vercel env var scoping]
- [Source: winepooler/src/lib/supabase/client.ts — env guards]
- [Source: winepooler/src/lib/supabase/auth.ts — role metadata at line 24]
- [Source: supabase/functions/stripe-webhook/index.ts — webhook verification]
- [Source: supabase/migrations/ — 18 existing migration files]

## Dev Agent Record

### Agent Model Used

### Debug Log References

### Completion Notes List

### File List
