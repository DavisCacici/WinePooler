# Story 3.1: Create Virtual Pallet

Status: review

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a Buyer,
I want to start a new virtual pallet for a specific winery and area,
so that orders can be aggregated.

## Acceptance Criteria

1. Given I am on the Buyer Dashboard
   When I click "New Pallet" in the buyer navigation
   Then a "Create Pallet" form/modal is presented
   And it shows a dropdown of available wineries and pre-selects my current Macro-Area

2. Given the Create Pallet form is open
   When I select a winery and confirm creation
   Then a new pallet record is inserted in Supabase with state `open` and `bottle_count = 0`
   And I see a success confirmation
   And the Buyer Dashboard pallet list refreshes to include the new pallet

3. Given a new pallet has been created
   When any buyer in the same Macro-Area views the dashboard
   Then the new pallet appears in both Map View and Grid View
   And it shows 0 bottles committed and a 0% progress bar

4. Given I try to create a pallet for a winery that already has an `open` pallet in my area
   When I submit the form
   Then creation is blocked with a clear error message
   And I am shown the existing open pallet instead

5. Given the winery list is loading
   When the fetch is in progress
   Then a loading state is shown in the winery dropdown
   And if the fetch fails an inline error message is shown with a retry option

## Tasks / Subtasks

- [x] Create `winery_profiles` table in Supabase (AC: 1, 2)
  - [x] Define schema: `id`, `user_id` (FK → auth.users, UNIQUE), `company_name`, `vat_number`, `created_at`
  - [x] RLS: authenticated users can SELECT; winery owner can INSERT/UPDATE own row
  - [x] Seed 3 rows matching existing BuyerDashboard mock wineries: Cantina Aurora, Tenuta Collina, Vigna Nuova (linked to placeholder user_ids for dev)
- [x] Create `virtual_pallets` table in Supabase (AC: 2, 3, 4)
  - [x] Define schema: `id`, `area_id` (FK → macro_areas), `winery_id` (FK → winery_profiles), `state` (text CHECK IN ('open','frozen','completed')), `bottle_count` (integer DEFAULT 0), `threshold` (integer DEFAULT 600), `created_by` (FK → auth.users), `created_at`, `updated_at`
  - [x] Add UNIQUE constraint on `(area_id, winery_id)` WHERE `state = 'open'` (partial unique index) to prevent duplicate open pallets per winery/area
  - [x] RLS: authenticated buyers can SELECT all pallets in their area; buyers can INSERT; no DELETE
- [x] Create pallet + winery data access layer (AC: 1, 2, 3, 4, 5)
  - [x] Add `getWineryProfiles()` in `src/lib/supabase/queries/wineryProfiles.ts`
  - [x] Add `getPalletsByArea(areaId)` in `src/lib/supabase/queries/virtualPallets.ts`
  - [x] Add `createVirtualPallet(data)` in the same file
  - [x] Add `getOpenPalletForWinery(areaId, wineryId)` for duplicate-check in the same file
- [x] Build `CreatePalletModal` component (AC: 1, 2, 4, 5)
  - [x] Create `src/pages/pallets/CreatePalletModal.tsx`
  - [x] Winery dropdown: loads from `getWineryProfiles()` with loading/error states
  - [x] Area field: pre-filled and read-only (from buyer's `macro_area_id`)
  - [x] On submit: call `getOpenPalletForWinery` first; if exists show error and link to existing pallet; else call `createVirtualPallet`
  - [x] On success: close modal and trigger pallet list refresh via callback prop
- [x] Replace static mock pallet data in `BuyerDashboard.tsx` with live DB query (AC: 2, 3)
  - [x] Load area-scoped pallets from `getPalletsByArea(profile.macro_area_id)` on mount and after pallet creation
  - [x] Map DB pallet fields to the existing card props (`id`, `area` from joined `macro_areas.name`, `winery` from joined `winery_profiles.company_name`, `bottles` from `bottle_count`, `progress` as `(bottle_count / threshold * 100).toFixed(0) + '%'`)
  - [x] Preserve Map View / Grid View toggle behavior
- [x] Wire "New Pallet" button in `BuyerDashboard.tsx` (AC: 1)
  - [x] Add "New Pallet" entry to `buyerNavigation` or as a highlighted CTA button in the pallet section header
  - [x] Toggle `showCreateModal` state to open `CreatePalletModal`
- [x] Write unit tests (AC: 2, 3, 4, 5)
  - [x] Test `createVirtualPallet`: mock Supabase insert, assert correct payload
  - [x] Test duplicate detection: `getOpenPalletForWinery` returning a row blocks creation
  - [x] Test `getPalletsByArea`: verifies area filter and join fields returned
  - [x] Test progress percentage calculation helper
  - [x] Test modal loading/error state for winery dropdown

## Dev Notes

### Architecture & Technical Context

- **Stack**: React.js + TypeScript, Tailwind CSS, Supabase (auth + PostgreSQL + Realtime eventually), Vercel
- **Auth / profile**: `useAuth()` from `AuthContext.tsx` → `user`, `role`. Buyer's `macro_area_id` lives in `buyer_profiles` (Story 2.1/2.2). Load it via `getBuyerProfile(user.id)` already established in `src/lib/supabase/queries/buyerProfile.ts`.
- **WineryDashboard**: winery users will eventually use `winery_profiles` too (Epic 3 winery-side stories). Creating the table here does not conflict; the winery portal simply has no UI for it yet.
- **Static mock → live data transition**: `BuyerDashboard.tsx` currently renders a constant `pallets` array. This story replaces it with a `useState` + `useEffect` that calls `getPalletsByArea`. Keep the same field names in the mapped object so Grid/Map View markup needs minimal changes.
- **Partial unique index**: PostgreSQL enforces `UNIQUE (area_id, winery_id) WHERE state = 'open'` — only one open pallet per winery per area at a time (FR3/FR4). Frozen/completed pallets are not affected.
- **Styling conventions** (established Stories 1.3 → 2.3): `rounded-3xl bg-white p-8 shadow-sm ring-1 ring-slate-200` cards; `text-emerald-700` accents; `text-slate-900` / `text-slate-600`; `rounded-full` pills for nav; `bg-emerald-600` progress fill.
- **Modal pattern**: use a simple `dialog`-style overlay; no external modal library. Tailwind `fixed inset-0 bg-black/40` backdrop + `rounded-3xl bg-white` panel.

### Supabase Schema

```sql
-- 1. Winery profiles (mirrors buyer_profiles pattern)
CREATE TABLE public.winery_profiles (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  company_name text NOT NULL,
  vat_number   text NOT NULL,
  created_at   timestamptz DEFAULT now(),
  UNIQUE (user_id)
);

ALTER TABLE public.winery_profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can read winery profiles"
  ON public.winery_profiles FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Winery can insert own profile"
  ON public.winery_profiles FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Winery can update own profile"
  ON public.winery_profiles FOR UPDATE
  USING (auth.uid() = user_id);

-- 2. Virtual pallets
CREATE TABLE public.virtual_pallets (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  area_id      uuid NOT NULL REFERENCES public.macro_areas(id),
  winery_id    uuid NOT NULL REFERENCES public.winery_profiles(id),
  state        text NOT NULL DEFAULT 'open'
               CHECK (state IN ('open', 'frozen', 'completed')),
  bottle_count integer NOT NULL DEFAULT 0 CHECK (bottle_count >= 0),
  threshold    integer NOT NULL DEFAULT 600 CHECK (threshold > 0),
  created_by   uuid NOT NULL REFERENCES auth.users(id),
  created_at   timestamptz DEFAULT now(),
  updated_at   timestamptz DEFAULT now()
);

-- Prevent two open pallets for the same winery in the same area
CREATE UNIQUE INDEX virtual_pallets_one_open_per_winery_area
  ON public.virtual_pallets (area_id, winery_id)
  WHERE state = 'open';

ALTER TABLE public.virtual_pallets ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can read all pallets"
  ON public.virtual_pallets FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Buyers can create pallets"
  ON public.virtual_pallets FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = created_by);
```

### Data Access Layer

```typescript
// src/lib/supabase/queries/wineryProfiles.ts  (NEW)
import { supabase } from '../client'

export interface WineryProfile {
  id: string
  user_id: string
  company_name: string
}

export const getWineryProfiles = async (): Promise<WineryProfile[]> => {
  const { data, error } = await supabase
    .from('winery_profiles')
    .select('id, user_id, company_name')
    .order('company_name')
  if (error) throw error
  return data ?? []
}
```

```typescript
// src/lib/supabase/queries/virtualPallets.ts  (NEW)
import { supabase } from '../client'

export interface VirtualPallet {
  id: string
  area_id: string
  winery_id: string
  state: 'open' | 'frozen' | 'completed'
  bottle_count: number
  threshold: number
  created_by: string
  // joined
  area_name?: string
  winery_name?: string
}

export const getPalletsByArea = async (areaId: string): Promise<VirtualPallet[]> => {
  const { data, error } = await supabase
    .from('virtual_pallets')
    .select(`
      id, area_id, winery_id, state, bottle_count, threshold, created_by,
      macro_areas(name),
      winery_profiles(company_name)
    `)
    .eq('area_id', areaId)
    .order('created_at', { ascending: false })
  if (error) throw error
  return (data ?? []).map(row => ({
    ...row,
    area_name: (row.macro_areas as any)?.name,
    winery_name: (row.winery_profiles as any)?.company_name,
  }))
}

export const getOpenPalletForWinery = async (
  areaId: string,
  wineryId: string
): Promise<VirtualPallet | null> => {
  const { data, error } = await supabase
    .from('virtual_pallets')
    .select('id, state, bottle_count, threshold')
    .eq('area_id', areaId)
    .eq('winery_id', wineryId)
    .eq('state', 'open')
    .maybeSingle()
  if (error) throw error
  return data
}

export const createVirtualPallet = async (payload: {
  area_id: string
  winery_id: string
  created_by: string
}): Promise<VirtualPallet> => {
  const { data, error } = await supabase
    .from('virtual_pallets')
    .insert(payload)
    .select()
    .single()
  if (error) throw error
  return data
}
```

### Progress Calculation Helper

Extract as a pure function (unit-testable):

```typescript
// src/lib/palletProgress.ts  (NEW — pure utility)
export const palletProgressPercent = (bottleCount: number, threshold: number): number =>
  threshold > 0 ? Math.min(Math.round((bottleCount / threshold) * 100), 100) : 0

export const palletProgressLabel = (bottleCount: number, threshold: number): string =>
  `${palletProgressPercent(bottleCount, threshold)}%`
```

### BuyerDashboard Data Layer Change

Replace the static `const pallets = [...]` constant with live state:

```typescript
// Add at top of component:
const { user } = useAuth()
const [pallets, setPallets] = useState<BuyerPalletCard[]>([])
const [loadingPallets, setLoadingPallets] = useState(true)
const [showCreateModal, setShowCreateModal] = useState(false)

// Mapped type for the card view:
interface BuyerPalletCard {
  id: string
  area: string
  winery: string
  progress: string  // e.g. "72%"
  bottles: number
}

// Load pallets on mount (after profile/area guard resolves areaId):
useEffect(() => {
  if (!areaId) return
  setLoadingPallets(true)
  getPalletsByArea(areaId)
    .then(rows => setPallets(rows.map(r => ({
      id: r.id,
      area: r.area_name ?? '',
      winery: r.winery_name ?? '',
      progress: palletProgressLabel(r.bottle_count, r.threshold),
      bottles: r.bottle_count,
    }))))
    .finally(() => setLoadingPallets(false))
}, [areaId])
```

> **`areaId` dependency**: the existing guards (Stories 2.1/2.2) should extract and store `macro_area_id` from the buyer profile into a local state variable (`areaId`) so the pallet `useEffect` can depend on it.

### Modal Integration in BuyerDashboard

```tsx
{/* Add inside the pallet section header, next to the Map/Grid toggle: */}
<button
  type="button"
  onClick={() => setShowCreateModal(true)}
  className="rounded-full bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-700"
>
  + New Pallet
</button>

{showCreateModal && areaId && user && (
  <CreatePalletModal
    areaId={areaId}
    buyerUserId={user.id}
    onClose={() => setShowCreateModal(false)}
    onCreated={() => {
      setShowCreateModal(false)
      // Re-trigger pallet load by bumping a refresh counter or re-calling getPalletsByArea
    }}
  />
)}
```

### CreatePalletModal API Contract

```typescript
// src/pages/pallets/CreatePalletModal.tsx  (NEW)
interface CreatePalletModalProps {
  areaId: string           // buyer's current macro_area_id
  buyerUserId: string      // auth.uid()
  onClose: () => void
  onCreated: () => void    // called after successful creation to trigger list refresh
}
```

### Regression Risk

- **BuyerDashboard.tsx mock → live**: the field names on the mapped `BuyerPalletCard` interface must match the existing card markup variables (`pallet.id`, `pallet.area`, `pallet.winery`, `pallet.progress`, `pallet.bottles`). Changing any of these names will silently break the card render.
- **Guard chain ordering** (Stories 2.1 → 2.3): the profile/area guard `useEffect` must resolve `areaId` into state **before** the pallet-loading `useEffect` runs. Use a separate `useEffect` with `areaId` as dependency, not chained inside the profile guard's `.then()`, to avoid race conditions.
- **Story 2.3 preferences load** is also in `BuyerDashboard.tsx` — keep all three loads independent: (1) profile+area guard, (2) preferences, (3) pallets. Do not combine them into one `useEffect`.
- **Partial unique index** is enforced at DB level; still gate with `getOpenPalletForWinery` in the UI for a friendly error before hitting the constraint.

### Project Structure Notes

```
src/
├── lib/
│   ├── palletProgress.ts                          ← NEW (pure utility)
│   └── supabase/
│       └── queries/
│           ├── buyerProfile.ts                    ← do not modify
│           ├── macroAreas.ts                      ← do not modify
│           ├── buyerPreferences.ts                ← do not modify
│           ├── wineryProfiles.ts                  ← NEW
│           └── virtualPallets.ts                  ← NEW
├── pages/
│   ├── dashboards/
│   │   └── BuyerDashboard.tsx                    ← MODIFY: mock→live data, "New Pallet" button, modal wiring
│   └── pallets/
│       └── CreatePalletModal.tsx                  ← NEW
└── App.tsx                                        ← no change needed (modal is inline, no new route)
```

### References

- [Source: _bmad-output/planning-artifacts/epics-stories.md#Story 3.1: Create Virtual Pallet]
- [Source: _bmad-output/planning-artifacts/epics-stories.md#Epic 3: Virtual Pallet Pooling]
- [Source: _bmad-output/planning-artifacts/prd.md#4.2. Geographic Pooling Engine]
- [Source: _bmad-output/planning-artifacts/Epic2/story_2.1.md] — `buyer_profiles` schema, `getBuyerProfile`, styling conventions
- [Source: _bmad-output/planning-artifacts/Epic2/story_2.2.md] — `macro_areas` schema, `macro_area_id` FK, guard chain pattern, `areaId` state
- [Source: _bmad-output/planning-artifacts/Epic2/story_2.3.md] — preferences load in BuyerDashboard, non-blocking independent `useEffect` pattern
- [Source: winepooler/src/pages/dashboards/BuyerDashboard.tsx] — full current markup and mock pallet array to replace
- [Source: winepooler/src/pages/dashboards/ProtectedDashboardRoute.tsx] — auth guard pattern (no new route needed here)
- [Source: winepooler/src/lib/supabase/client.ts] — Supabase client import pattern
- [Source: winepooler/src/lib/supabase/auth.ts] — `AppRole` type

## Dev Agent Record

### Agent Model Used

Claude Sonnet 4.6

### Debug Log References

No blockers encountered.

### Completion Notes List

- Created Supabase migration for `winery_profiles` and `virtual_pallets` tables with RLS policies and partial unique index for open-pallet uniqueness per winery/area.
- Added seed query for 3 dev wineries (Cantina Aurora, Tenuta Collina, Vigna Nuova) linked to first 3 auth users.
- Added `wineryProfiles.ts` with `getWineryProfiles()` and `virtualPallets.ts` with `getPalletsByArea`, `getOpenPalletForWinery`, `createVirtualPallet`.
- Added `palletProgress.ts` pure utility (`palletProgressPercent`, `palletProgressLabel`).
- Built `CreatePalletModal` with winery dropdown loads (loading/error/retry), read-only area field, duplicate guard (checks open pallet first), success/error states, and `onCreated` callback for list refresh.
- Replaced static `pallets` const in `BuyerDashboard.tsx` with live `getPalletsByArea` useEffect; extracted `areaId` state from profile guard; wired `+ New Pallet` CTA button with `showCreateModal` / `palletRefreshToken` pattern.
- Updated dashboard tests to mock `getPalletsByArea` and added new tests for progress helper, virtual pallet queries, and modal duplicate/loading/error behaviors.

### File List

- winepooler/supabase/migrations/20260401003000_create_winery_profiles_and_virtual_pallets.sql (new)
- winepooler/src/lib/palletProgress.ts (new)
- winepooler/src/lib/supabase/queries/wineryProfiles.ts (new)
- winepooler/src/lib/supabase/queries/virtualPallets.ts (new)
- winepooler/src/pages/pallets/CreatePalletModal.tsx (new)
- winepooler/src/pages/dashboards/BuyerDashboard.tsx (modified)
- winepooler/src/lib/__tests__/palletProgress.test.ts (new)
- winepooler/src/lib/supabase/queries/__tests__/virtualPallets.test.ts (new)
- winepooler/src/pages/pallets/__tests__/CreatePalletModal.test.tsx (new)
- winepooler/src/pages/dashboards/__tests__/BuyerDashboard.test.tsx (modified)
