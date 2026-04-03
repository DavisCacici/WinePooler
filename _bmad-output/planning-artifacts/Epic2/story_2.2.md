# Story 2.2: Geographic Area Selection

Status: review

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a Buyer,
I want to select my geofenced Macro-Area,
so that I see only pallets and wineries relevant to my territory.

## Acceptance Criteria

1. Given I have just completed my business profile (Story 2.1 flow)
   When I land on the area selection page at `/profile/area`
   Then I see a list of all active Macro-Areas loaded from the database
   And each area card shows name and a brief description

2. Given I am on the area selection page
   When I click a Macro-Area card
   Then my `buyer_profiles.macro_area_id` is updated in Supabase
   And I am immediately redirected to `/dashboard/buyer`
   And the Buyer Dashboard shows only pallets belonging to my selected area

3. Given I am on the Buyer Dashboard with a selected area
   When I click "Change Area" in the dashboard header navigation
   Then I am taken back to `/profile/area` to change my selection
   And re-selecting a different area updates the profile and re-scopes the dashboard

4. Given I am a Buyer with a complete business profile but no area selected
   When I navigate directly to `/dashboard/buyer`
   Then I am redirected to `/profile/area` before the dashboard renders

5. Given the area list is loading from Supabase
   When the fetch is in progress
   Then a loading skeleton is shown
   And if an error occurs a retry message is displayed

## Tasks / Subtasks

- [x] Create `macro_areas` table in Supabase (AC: 1)
  - [x] Define schema: `id`, `name`, `slug`, `description`, `display_order`, `is_active`, `created_at`
  - [x] Seed initial areas: North Milan, Lake Garda, Turin Center (matching BuyerDashboard mock data)
  - [x] No RLS restriction on SELECT (public read for all authenticated users)
- [x] Add `macro_area_id` FK column to `buyer_profiles` (AC: 2)
  - [x] `ALTER TABLE public.buyer_profiles ADD COLUMN macro_area_id uuid REFERENCES public.macro_areas(id);`
  - [x] Column is nullable (profile can exist without area selected yet)
- [x] Create area data access layer (AC: 1, 2, 3)
  - [x] Add `getMacroAreas()` query in `src/lib/supabase/queries/macroAreas.ts`
  - [x] Add `updateBuyerArea(userId, macroAreaId)` mutation in `src/lib/supabase/queries/buyerProfile.ts` (extend file from Story 2.1)
- [x] Build `AreaSelectionPage` component (AC: 1, 2, 3, 5)
  - [x] Create `src/pages/profile/AreaSelectionPage.tsx`
  - [x] Fetch active areas with `getMacroAreas()` on mount
  - [x] Render area cards with name + description + selection highlight
  - [x] Show loading skeleton while fetching; show error + retry on failure
  - [x] On card click: call `updateBuyerArea`, then navigate to `/dashboard/buyer`
- [x] Register `/profile/area` route in `App.tsx` (AC: 1, 4)
  - [x] Route must be accessible to authenticated Buyers regardless of profile completeness
  - [x] Wrap with an auth check (redirect to `/login` if unauthenticated)
- [x] Add area-missing guard to `BuyerDashboard.tsx` (AC: 4)
  - [x] After profile-existence check (Story 2.1), also check `macro_area_id !== null`
  - [x] If profile exists but `macro_area_id` is null → redirect to `/profile/area`
- [x] Scope pallet display in `BuyerDashboard.tsx` by selected area (AC: 2, 3)
  - [x] Pass selected `macro_area` name into the pallet filter (mock data for now; real query in Epic 3)
  - [x] Display the active area name in the dashboard header
  - [x] Add "Change Area" link to the buyer navigation bar
- [x] Write unit tests (AC: 1, 2, 4, 5)
  - [x] Test `getMacroAreas` returns only active areas
  - [x] Test `updateBuyerArea` calls upsert with correct args
  - [x] Test redirect to `/profile/area` when `macro_area_id` is null in BuyerDashboard
  - [x] Test loading and error states in `AreaSelectionPage`

## Dev Notes

### Architecture & Technical Context

- **Stack**: React.js + TypeScript, Tailwind CSS, Supabase (auth + PostgreSQL), Vercel
- **Auth pattern**: `useAuth()` from `src/lib/supabase/AuthContext.tsx` — exposes `user`, `role`, `session`, `loading`
- **BuyerProfile**: `buyer_profiles` table created in Story 2.1. This story adds the `macro_area_id` FK column to that table. Do **not** recreate the table — use `ALTER TABLE` only.
- **Routing**: `App.tsx` currently has routes for `/`, `/register`, `/login`, `/dashboard`, `/dashboard/buyer`, `/dashboard/winery`. Add `/profile/area` in this story. Also `/profile/complete` and `/profile/edit` will be added by Story 2.1 — treat them as present when implementing, but do not duplicate.
- **Styling conventions** (established in Story 1.3): `rounded-3xl bg-white p-8 shadow-sm ring-1 ring-slate-200` for cards; `text-emerald-700` for accent labels; `text-slate-900` headings; `text-slate-600` body text; use `rounded-full` pill-style buttons.
- **File naming**: page-level components PascalCase (`AreaSelectionPage.tsx`); query modules camelCase (`macroAreas.ts`).
- **Existing mock area names** in `BuyerDashboard.tsx`: `'North Milan'`, `'Lake Garda'`, `'Turin Center'` — the seed data for `macro_areas` must use these exact names so mock pallet filtering works correctly.

### Supabase Schema Changes

```sql
-- 1. Create macro_areas config table (NFR3: expansion via configuration)
CREATE TABLE public.macro_areas (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name          text NOT NULL UNIQUE,
  slug          text NOT NULL UNIQUE,
  description   text,
  display_order integer NOT NULL DEFAULT 0,
  is_active     boolean NOT NULL DEFAULT true,
  created_at    timestamptz DEFAULT now()
);

-- Seed initial areas (slugs mirror BuyerDashboard mock area labels)
INSERT INTO public.macro_areas (name, slug, description, display_order) VALUES
  ('North Milan',   'north-milan',   'Metropolitan Milan and northern hinterland', 1),
  ('Lake Garda',    'lake-garda',    'Garda lake basin and surrounding hills',      2),
  ('Turin Center',  'turin-center',  'Central Turin and Piedmont valley floor',     3);

-- All authenticated users can read active areas (no per-user restriction)
ALTER TABLE public.macro_areas ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated users can read active areas"
  ON public.macro_areas FOR SELECT
  TO authenticated
  USING (is_active = true);

-- 2. Extend buyer_profiles with macro_area FK
ALTER TABLE public.buyer_profiles
  ADD COLUMN macro_area_id uuid REFERENCES public.macro_areas(id) ON DELETE SET NULL;
```

### Data Access Layer

```typescript
// src/lib/supabase/queries/macroAreas.ts  (NEW)
import { supabase } from '../client'

export interface MacroArea {
  id: string
  name: string
  slug: string
  description: string | null
  display_order: number
}

export const getMacroAreas = async (): Promise<MacroArea[]> => {
  const { data, error } = await supabase
    .from('macro_areas')
    .select('id, name, slug, description, display_order')
    .eq('is_active', true)
    .order('display_order')
  if (error) throw error
  return data ?? []
}
```

```typescript
// Extend src/lib/supabase/queries/buyerProfile.ts  (MODIFY — append to existing file)
export const updateBuyerArea = async (userId: string, macroAreaId: string): Promise<void> => {
  const { error } = await supabase
    .from('buyer_profiles')
    .update({ macro_area_id: macroAreaId })
    .eq('user_id', userId)
  if (error) throw error
}
```

### BuyerDashboard Guard Logic (extend Story 2.1 guard)

```typescript
// In BuyerDashboard.tsx — extend existing profile guard useEffect:
useEffect(() => {
  if (!user) return
  getBuyerProfile(user.id).then(profile => {
    if (!profile) {
      navigate('/profile/complete')
    } else if (!profile.macro_area_id) {
      navigate('/profile/area')
    } else {
      setActiveAreaName(profile.macro_area_name ?? null) // join or store name separately
    }
  })
}, [user])
```

> **Note**: `buyer_profiles` JOIN with `macro_areas` — update `getBuyerProfile` query to add `.select('*, macro_areas(name)')` so `macro_area_name` is available in the dashboard header without a second query.

### BuyerDashboard Scoping by Area

The existing `BuyerDashboard.tsx` renders a static `pallets` array. In this story, filter that array by the buyer's selected area name:

```typescript
const visiblePallets = activeAreaName
  ? pallets.filter(p => p.area === activeAreaName)
  : pallets
```

Display the active area in the header section:

```tsx
<p className="text-sm font-semibold uppercase tracking-[0.2em] text-emerald-700">
  Buyer Dashboard · {activeAreaName ?? 'All Areas'}
</p>
```

Add a "Change Area" link inside `buyerNavigation` (or as a separate pill next to the area name).

### Routing Integration

```tsx
// App.tsx additions — place after /login route, before /dashboard routes:
import AreaSelectionPage from './pages/profile/AreaSelectionPage'
// (BuyerProfileForm imports added by Story 2.1)

// Inside Routes:
<Route
  path="/profile/area"
  element={
    <ProtectedDashboardRoute allowedRole="buyer">
      <AreaSelectionPage />
    </ProtectedDashboardRoute>
  }
/>
```

`ProtectedDashboardRoute` already redirects unauthenticated users to `/login` — reuse it here. Do **not** add an additional profile-existence check on `/profile/area` (that would create an infinite redirect for new buyers).

### Regression Risk

- Story 1.3 (`BuyerDashboard.tsx`) is `in-progress`. The area guard `useEffect` is an **extension** of the profile guard added in Story 2.1. Chain the checks sequentially: no profile → `/profile/complete`; profile but no area → `/profile/area`; both present → render dashboard.
- `getBuyerProfile` query selector must be updated from `'*'` to `'*, macro_areas(name)'`; ensure this change does not break Story 2.1's profile form which only reads scalar profile fields.
- The static `pallets` array in `BuyerDashboard.tsx` uses area names that match the seed data exactly (`'North Milan'`, `'Lake Garda'`, `'Turin Center'`). If the seed names differ, filtering will silently show zero pallets.

### Project Structure Notes

```
src/
├── lib/
│   └── supabase/
│       └── queries/
│           ├── buyerProfile.ts    ← MODIFY: add updateBuyerArea + update getBuyerProfile select
│           └── macroAreas.ts      ← NEW
├── pages/
│   ├── dashboards/
│   │   └── BuyerDashboard.tsx    ← MODIFY: area guard + area scoping + "Change Area" nav link
│   └── profile/
│       ├── BuyerProfileForm.tsx   ← created by Story 2.1, do not modify
│       └── AreaSelectionPage.tsx  ← NEW
└── App.tsx                        ← MODIFY: add /profile/area route
```

### References

- [Source: _bmad-output/planning-artifacts/epics-stories.md#Story 2.2: Geographic Area Selection]
- [Source: _bmad-output/planning-artifacts/epics-stories.md#Epic 2: Buyer Profile and Area Management]
- [Source: _bmad-output/planning-artifacts/prd.md#4.2. Geographic Pooling Engine] — Macro-Area concept
- [Source: _bmad-output/planning-artifacts/prd.md#8. Non-Functional Requirements] — NFR3 scalability via configuration
- [Source: _bmad-output/planning-artifacts/Epic2/story_2.1.md] — `buyer_profiles` schema, `getBuyerProfile`, profile guard pattern, styling conventions
- [Source: _bmad-output/planning-artifacts/Epic1/story_1.3.md] — BuyerDashboard patterns, `ProtectedDashboardRoute` usage
- [Source: winepooler/src/pages/dashboards/BuyerDashboard.tsx] — existing mock pallet data with area names; UI patterns to extend
- [Source: winepooler/src/App.tsx] — existing route structure to extend

## Dev Agent Record

### Agent Model Used

GPT-5.3-Codex

### Debug Log References

No runtime blockers encountered. Full test run was requested but skipped by user in terminal flow.

### Completion Notes List

- Implemented Supabase migration to create `macro_areas`, seed initial areas, add RLS policy for authenticated reads, and add nullable `buyer_profiles.macro_area_id` FK.
- Added `getMacroAreas()` query module in `src/lib/supabase/queries/macroAreas.ts`.
- Extended `src/lib/supabase/queries/buyerProfile.ts` with macro-area join in `getBuyerProfile` and `updateBuyerArea(userId, macroAreaId)` mutation.
- Built `AreaSelectionPage` with loading skeleton, error + retry UI, active area card list, and update + redirect flow to `/dashboard/buyer`.
- Registered `/profile/area` route in `App.tsx` behind existing buyer auth protection (`ProtectedDashboardRoute`).
- Extended `BuyerDashboard.tsx` guard chain: no profile -> `/profile/complete`; no `macro_area_id` -> `/profile/area`; otherwise load and display active area.
- Scoped displayed pallets to selected macro-area, surfaced active area in header, and added `Change Area` navigation link.
- Added/updated tests for macro area queries, buyer area updates, dashboard area redirect behavior, and area selection loading/error states.

### File List

- winepooler/supabase/migrations/20260401001000_create_macro_areas_and_buyer_profile_area_fk.sql (new)
- winepooler/src/lib/supabase/queries/macroAreas.ts (new)
- winepooler/src/pages/profile/AreaSelectionPage.tsx (new)
- winepooler/src/App.tsx (modified)
- winepooler/src/lib/supabase/queries/buyerProfile.ts (modified)
- winepooler/src/pages/dashboards/BuyerDashboard.tsx (modified)
- winepooler/src/lib/supabase/queries/__tests__/macroAreas.test.ts (new)
- winepooler/src/lib/supabase/queries/__tests__/buyerProfile.test.ts (modified)
- winepooler/src/pages/profile/__tests__/AreaSelectionPage.test.tsx (new)
- winepooler/src/pages/dashboards/__tests__/BuyerDashboard.test.tsx (modified)
