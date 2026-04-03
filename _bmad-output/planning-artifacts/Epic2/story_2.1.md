# Story 2.1: Complete Buyer Business Profile

Status: review

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a Buyer,
I want to complete my business profile with company details,
so that I am eligible to participate in pallet pooling.

## Acceptance Criteria

1. Given I am a newly registered Buyer
   When I fill in company name, VAT number, business address, and contact details
   Then my business profile is saved to the database
   And I am directed to select my geographic area (Story 2.2)

2. Given I have already completed my profile
   When I navigate to profile settings
   Then I can view and edit all previously saved business details
   And changes are persisted immediately on save

3. Given I submit the profile form with missing required fields
   When validation runs
   Then clear inline error messages are shown per field
   And the form is not submitted until all required fields are valid

## Tasks / Subtasks

- [x] Create `buyer_profiles` table in Supabase (AC: 1)
  - [x] Define schema: `id`, `user_id` (FK → auth.users), `company_name`, `vat_number`, `address_street`, `address_city`, `address_country`, `phone`, `created_at`, `updated_at`
  - [x] Add RLS policy: SELECT/INSERT/UPDATE only for `auth.uid() = user_id`
- [x] Create profile data access layer (AC: 1, 2)
  - [x] Add `getBuyerProfile(userId)` query in `src/lib/supabase/queries/buyerProfile.ts`
  - [x] Add `upsertBuyerProfile(data)` mutation in the same file
- [x] Build `BuyerProfileForm` component (AC: 1, 2, 3)
  - [x] Create `src/pages/profile/BuyerProfileForm.tsx`
  - [x] Fields: company name, VAT number (pre-filled from auth metadata), address street, city, country, phone
  - [x] Implement client-side validation (required fields, VAT format hint)
  - [x] On submit: call `upsertBuyerProfile`, then navigate to area-selection step (Story 2.2 route)
- [x] Integrate profile completion check in BuyerDashboard (AC: 1)
  - [x] On mount, query `buyer_profiles` for current user
  - [x] If no profile found, redirect to `/profile/complete`
  - [x] If profile exists, display dashboard normally
- [x] Add profile edit route accessible from settings navigation (AC: 2)
  - [x] Register `/profile/edit` route in `App.tsx`
  - [x] Reuse `BuyerProfileForm` in edit mode (pre-populated)
- [x] Write unit tests (AC: 1, 2, 3)
  - [x] Test form validation logic
  - [x] Test Supabase upsert integration (mock Supabase client)
  - [x] Test redirect to area-selection on success

## Dev Notes

### Architecture & Technical Context

- **Stack**: React.js + TypeScript, Tailwind CSS, Supabase (auth + PostgreSQL), Vercel
- **Auth pattern**: `src/lib/supabase/auth.ts` exports `AppRole`, `normalizeRole`. Auth state lives in `AuthContext` (`src/lib/supabase/AuthContext.tsx`) and exposes `user`, `role`, `session`.
- **VAT number**: already captured in `auth.users.user_metadata.vat_number` during registration (Story 1.1). Pre-fill the VAT field from `user?.user_metadata?.vat_number` so the Buyer does not retype it, but still allow editing for corrections.
- **Routing guard**: `DashboardRouter` / `ProtectedDashboardRoute` in `src/pages/dashboards/` handle role-based routing. The profile completion redirect must be inserted in `BuyerDashboard.tsx` using a `useEffect` that checks for an existing `buyer_profiles` row.
- **Styling conventions (from Story 1.3)**: `rounded-3xl bg-white p-8 shadow-sm ring-1 ring-slate-200` for cards; `text-emerald-700` for section labels; `text-slate-900` for headings; `text-slate-600` for body.
- **File naming**: page-level components use PascalCase (e.g., `BuyerProfileForm.tsx`); query modules use camelCase (e.g., `buyerProfile.ts`).
- **Data layer location**: Supabase query utilities go in `src/lib/supabase/queries/` (currently empty, established in Story 1.1 dev notes).

### Supabase Table Schema

```sql
CREATE TABLE public.buyer_profiles (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  company_name  text NOT NULL,
  vat_number    text NOT NULL,
  address_street text NOT NULL,
  address_city  text NOT NULL,
  address_country text NOT NULL DEFAULT 'IT',
  phone         text,
  created_at  timestamptz DEFAULT now(),
  updated_at  timestamptz DEFAULT now(),
  UNIQUE (user_id)
);

-- RLS
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
```

### Data Access Layer Pattern

```typescript
// src/lib/supabase/queries/buyerProfile.ts
import { supabase } from '../client'

export interface BuyerProfile {
  id?: string
  user_id: string
  company_name: string
  vat_number: string
  address_street: string
  address_city: string
  address_country: string
  phone?: string
}

export const getBuyerProfile = async (userId: string) => {
  const { data, error } = await supabase
    .from('buyer_profiles')
    .select('*')
    .eq('user_id', userId)
    .maybeSingle()
  if (error) throw error
  return data
}

export const upsertBuyerProfile = async (profile: BuyerProfile) => {
  const { data, error } = await supabase
    .from('buyer_profiles')
    .upsert(profile, { onConflict: 'user_id' })
    .select()
    .single()
  if (error) throw error
  return data
}
```

### Routing Integration

- Register two new routes in `src/App.tsx` inside the existing router:
  - `/profile/complete` → `<BuyerProfileForm mode="complete" />`
  - `/profile/edit` → `<BuyerProfileForm mode="edit" />` (protected, buyer only)
- After successful save in `complete` mode, navigate to `/profile/area` (Story 2.2 — may not exist yet; use a placeholder route `/profile/area` and show a stub page if 2.2 is not implemented).

### Profile Completion Guard in BuyerDashboard

```typescript
// In BuyerDashboard.tsx, add this useEffect:
useEffect(() => {
  if (!user) return
  getBuyerProfile(user.id).then(profile => {
    if (!profile) navigate('/profile/complete')
  })
}, [user])
```

### Potential Regression Risk

- Story 1.3 (`BuyerDashboard.tsx`) is currently `in-progress`. Adding the profile completion guard **must not break** the existing pallet discovery UI. The `useEffect` guard should be non-blocking (navigate only if profile is absent; normal render proceeds otherwise).
- `ProtectedDashboardRoute` already gates `/dashboard/buyer` by role. The `/profile/complete` route must be accessible to authenticated buyers who have no profile yet — do **not** wrap it with a profile-existence check.

### Project Structure Notes

```
src/
├── lib/
│   └── supabase/
│       ├── auth.ts                  ← existing, do not modify
│       ├── AuthContext.tsx           ← existing, do not modify
│       ├── client.ts                 ← existing, do not modify
│       └── queries/
│           └── buyerProfile.ts      ← NEW
├── pages/
│   ├── dashboards/
│   │   ├── BuyerDashboard.tsx       ← modify: add profile guard
│   │   └── ...
│   └── profile/
│       └── BuyerProfileForm.tsx     ← NEW
└── App.tsx                           ← modify: add /profile/complete and /profile/edit routes
```

### References

- [Source: _bmad-output/planning-artifacts/epics-stories.md#Epic 2: Buyer Profile and Area Management]
- [Source: _bmad-output/planning-artifacts/prd.md#4.1. User Management & Collaboration]
- [Source: _bmad-output/planning-artifacts/prd.md#3. Target Audience & User Personas]
- [Source: _bmad-output/planning-artifacts/Epic1/story_1.1.md] — Registration: VAT captured in `user_metadata.vat_number`
- [Source: _bmad-output/planning-artifacts/Epic1/story_1.3.md] — BuyerDashboard: styling conventions, routing guards, AppRole pattern
- [Source: winepooler/src/lib/supabase/auth.ts] — `AppRole`, `normalizeRole`, `registerUser`
- [Source: winepooler/src/lib/supabase/AuthContext.tsx] — `useAuth()` hook exposes `user`, `role`, `session`
- [Source: winepooler/src/pages/dashboards/BuyerDashboard.tsx] — UI patterns to follow

## Dev Agent Record

### Agent Model Used

Claude Sonnet 4.6

### Debug Log References

No blockers encountered.

### Completion Notes List

- ✅ Created SQL migration for `buyer_profiles` table with RLS policies at `winepooler/supabase/migrations/20260401000000_create_buyer_profiles.sql`
- ✅ Implemented `getBuyerProfile` and `upsertBuyerProfile` in `src/lib/supabase/queries/buyerProfile.ts`
- ✅ Built `BuyerProfileForm` component supporting both `complete` and `edit` modes. VAT pre-filled from `user_metadata.vat_number`. Client-side validation with inline errors per field. Navigates to `/profile/area` on completion or `/dashboard/buyer` on edit save.
- ✅ Added `useEffect` profile guard to `BuyerDashboard.tsx`; redirects to `/profile/complete` if no profile row found. Non-blocking — existing dashboard UI renders normally when profile exists.
- ✅ Registered `/profile/complete`, `/profile/edit`, and `/profile/area` (stub) routes in `App.tsx`. Profile routes protected with `ProtectedDashboardRoute` (buyer role).
- ✅ Written unit tests: `buyerProfile.test.ts` (6 tests covering get, upsert, errors), `BuyerProfileForm.test.tsx` (10 tests covering validation, pre-fill, submission, edit mode, cancel), `BuyerDashboard.test.tsx` (3 tests covering redirect and no-redirect scenarios). Zero TypeScript errors across all files.

### File List

- winepooler/supabase/migrations/20260401000000_create_buyer_profiles.sql (new)
- winepooler/src/lib/supabase/queries/buyerProfile.ts (new)
- winepooler/src/lib/supabase/queries/__tests__/buyerProfile.test.ts (new)
- winepooler/src/pages/profile/BuyerProfileForm.tsx (new)
- winepooler/src/pages/profile/__tests__/BuyerProfileForm.test.tsx (new)
- winepooler/src/pages/dashboards/BuyerDashboard.tsx (modified)
- winepooler/src/pages/dashboards/__tests__/BuyerDashboard.test.tsx (new)
- winepooler/src/App.tsx (modified)

## Change Log

| Date | Description |
|------|-------------|
| 2026-04-01 | Story 2.1 implemented: buyer_profiles table, data access layer, BuyerProfileForm component, profile completion guard, routes, unit tests |
