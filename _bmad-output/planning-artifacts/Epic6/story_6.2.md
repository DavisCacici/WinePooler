# Story 6.2: Supabase Backend Integration

Status: ready-for-dev

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a developer,
I want Supabase for auth, database, and real-time features,
so that backend services are available.

## Acceptance Criteria

1. Given the React app baseline from Story 6.1
   When Supabase environment variables are configured correctly
   Then the app initializes a Supabase client successfully
   And auth/database calls can execute without client initialization errors

2. Given a user registers and logs in through existing auth screens
   When credentials are valid
   Then Supabase Auth creates and returns a session
   And role metadata (`buyer` / `winery`) is available in app state

3. Given database schema migrations are applied in Supabase
   When authenticated users access core app flows
   Then required tables exist with working foreign keys and constraints
   And row-level security policies protect data access as expected

4. Given realtime subscriptions are configured for pooled pallet updates
   When `virtual_pallets` rows change for an area
   Then subscribed clients receive update events
   And local UI state can be updated without full refresh

5. Given backend integration is complete
   When CI/local checks run
   Then auth, database access, and realtime baseline tests pass
   And configuration/documentation is sufficient for another developer to reproduce setup

## Tasks / Subtasks

- [ ] Stabilize Supabase client configuration and env validation (AC: 1, 5)
  - [ ] Keep client creation in [winepooler/src/lib/supabase/client.ts](winepooler/src/lib/supabase/client.ts)
  - [ ] Add explicit runtime guards for missing `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` with actionable error messages
  - [ ] Ensure no service-role keys are referenced from frontend code
  - [ ] Document required local env contract in [winepooler/README.md](winepooler/README.md)
- [ ] Formalize Supabase migration workflow (AC: 3, 5)
  - [ ] Add `supabase/` project folder (if missing) and migration scaffolding conventions
  - [ ] Convert schema assumptions from previous stories into migration files (tables, indexes, RLS, policies)
  - [ ] Ensure migration order respects dependencies (`macro_areas` -> `buyer_profiles`/`winery_profiles` -> `virtual_pallets` -> `pallet_orders` -> payment/inventory tables)
  - [ ] Add a rollback strategy note for dev environments
- [ ] Validate and harden auth integration (AC: 2)
  - [ ] Keep auth APIs in [winepooler/src/lib/supabase/auth.ts](winepooler/src/lib/supabase/auth.ts)
  - [ ] Verify role normalization path in `normalizeRole` and `AuthContext`
  - [ ] Ensure session hydration in [winepooler/src/lib/supabase/AuthContext.tsx](winepooler/src/lib/supabase/AuthContext.tsx) handles initial load and token refresh
  - [ ] Add explicit auth error mapping for common Supabase auth failures in [winepooler/src/pages/Login.tsx](winepooler/src/pages/Login.tsx) and [winepooler/src/pages/Register.tsx](winepooler/src/pages/Register.tsx)
- [ ] Confirm database access layer contracts (AC: 3)
  - [ ] Create/verify query module structure under `src/lib/supabase/queries/`
  - [ ] Ensure each query/mutation uses typed return contracts and throws deterministic errors
  - [ ] Add at least one health-check query (e.g., read from `macro_areas`) used for integration validation
- [ ] Establish realtime baseline integration (AC: 4)
  - [ ] Use `supabase.channel(...).on('postgres_changes', ...)` pattern for `virtual_pallets` updates
  - [ ] Validate server-side filter usage by `area_id` where supported
  - [ ] Ensure cleanup on unmount (`removeChannel`) to prevent leaks
  - [ ] Add a reusable helper wrapper for channel subscription lifecycle
- [ ] Add backend integration tests (AC: 5)
  - [ ] Extend Vitest setup to mock Supabase client behavior for auth/session/query/realtime flows
  - [ ] Add unit tests for `AuthContext` session bootstrapping and role extraction
  - [ ] Add tests for `registerUser`/`loginUser` error and success paths
  - [ ] Add realtime handler test: update event transforms local pallet state correctly
  - [ ] Add env guard tests for missing Supabase variables
- [ ] Add developer operations notes (AC: 5)
  - [ ] Document Supabase local/dev setup in [winepooler/README.md](winepooler/README.md)
  - [ ] Add commands for migration apply/reset and test data seeding
  - [ ] Document how to verify realtime using two browser sessions

## Dev Notes

### Architecture & Technical Context

- **Current baseline already includes partial Supabase integration**:
  - Client: [winepooler/src/lib/supabase/client.ts](winepooler/src/lib/supabase/client.ts)
  - Auth state provider: [winepooler/src/lib/supabase/AuthContext.tsx](winepooler/src/lib/supabase/AuthContext.tsx)
  - Auth API: [winepooler/src/lib/supabase/auth.ts](winepooler/src/lib/supabase/auth.ts)
  - Auth screens: [winepooler/src/pages/Login.tsx](winepooler/src/pages/Login.tsx), [winepooler/src/pages/Register.tsx](winepooler/src/pages/Register.tsx)
- **What is still missing for full Story 6.2**:
  - Formal migration source-of-truth under `supabase/migrations`
  - Realtime baseline helper and verified end-to-end event flow
  - Integration-level tests for env/auth/realtime contracts
  - Setup documentation for reproducible backend bootstrapping
- **Scope boundary with adjacent stories**:
  - Story 6.1 handled frontend scaffold stabilization.
  - Story 6.2 establishes Supabase auth/db/realtime operational baseline.
  - Story 6.3 introduces Stripe integration (do not mix payment logic into 6.2).

### Environment Contract

Frontend (`Vite`):

- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_ANON_KEY`

Server/Edge (not frontend):

- `SUPABASE_SERVICE_ROLE_KEY`
- `DATABASE_URL`
- future Stripe secrets for Story 6.3+

Do not expose non-`VITE_` secrets in browser bundles.

### Supabase CLI / Migration Workflow

```bash
# Example workflow (adapt to team tooling)
supabase init
supabase link --project-ref <project_ref>
supabase migration new init_core_schema
supabase db push
```

For local validation:

```bash
supabase start
supabase db reset
```

Use migration files as the canonical source for schema/RLS, not ad-hoc SQL in dashboards or manual console edits.

### Suggested Integration Health Checks

- **Auth health**:
  - register test user
  - login and verify session exists
  - ensure role metadata round-trips through `AuthContext`
- **DB health**:
  - read from a low-risk public/authenticated table (e.g., `macro_areas`)
  - write to an ownable row (e.g., buyer profile) and verify RLS constraints
- **Realtime health**:
  - open two sessions in same area
  - mutate one `virtual_pallets` row
  - verify second client receives event and updates local state

### Testing Strategy

- Keep test layer at integration-smoke level for 6.2:
  - Supabase client guard behavior
  - auth/session lifecycle behavior
  - basic query success/error handling
  - realtime event handling and cleanup
- Avoid end-to-end payment behavior here (belongs to Epic 5 and Story 6.3).

### Regression Risks

- Missing env guards in Supabase client can produce silent runtime failures and confusing null errors throughout app pages.
- Manual schema edits without migrations can drift between developer environments, breaking story reproducibility.
- Missing `removeChannel` cleanup can cause duplicate realtime handlers and stale updates after route changes.
- Inconsistent role metadata handling can break protected dashboard routing (`buyer` vs `winery`).

### Project Structure Notes

```text
winepooler/
├── src/
│   ├── lib/
│   │   └── supabase/
│   │       ├── client.ts                    ← env guards + client setup
│   │       ├── auth.ts                      ← auth APIs + role normalization
│   │       ├── AuthContext.tsx              ← session lifecycle
│   │       ├── queries/                     ← db access contracts
│   │       └── realtime/                    ← optional helper wrapper
│   ├── pages/
│   │   ├── Login.tsx                        ← auth error UX mapping
│   │   └── Register.tsx                     ← auth error UX mapping
│   └── test-setup.ts                        ← shared test setup
└── supabase/
    ├── migrations/                          ← canonical schema + rls
    └── config.toml                          ← local supabase config
```

### References

- [Source: _bmad-output/planning-artifacts/epics-stories.md#Story 6.2: Supabase Backend Integration]
- [Source: _bmad-output/planning-artifacts/prd.md#6. Technical Specifications]
- [Source: _bmad-output/planning-artifacts/prd.md#8. Non-Functional Requirements]
- [Source: _bmad-output/planning-artifacts/Epic6/story_6.1.md]
- [Source: winepooler/src/lib/supabase/client.ts]
- [Source: winepooler/src/lib/supabase/AuthContext.tsx]
- [Source: winepooler/src/lib/supabase/auth.ts]
- [Source: winepooler/src/pages/Login.tsx]
- [Source: winepooler/src/pages/Register.tsx]
- [Source: winepooler/src/pages/dashboards/ProtectedDashboardRoute.tsx]
- [Source: winepooler/src/test-setup.ts]

## Dev Agent Record

### Agent Model Used

GPT-5.4

### Debug Log References

### Completion Notes List

### File List
