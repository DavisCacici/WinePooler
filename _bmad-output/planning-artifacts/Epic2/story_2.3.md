# Story 2.3: Purchasing Preferences Configuration

Status: review

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a Buyer,
I want to configure my purchasing preferences including preferred wine categories and budget ranges,
so that the marketplace surfaces the most relevant offers for my business.

## Acceptance Criteria

1. Given I am on my profile settings page at `/profile/preferences`
   When I set one or more preferred wine types (e.g., Red, White, Sparkling, Rosé)
   Then my selections are saved to `buyer_preferences` in Supabase
   And the Buyer Dashboard header shows a "Preferences set" badge

2. Given I am on the preferences page
   When I enter optional preferred appellations (free-text tags, e.g., "Barolo", "Brunello")
   Then each tag is saved as part of my preferences
   And up to 10 appellations can be stored

3. Given I am on the preferences page
   When I set a monthly budget range (minimum and maximum in EUR)
   Then both values are saved to my preferences
   And the form validates that min ≤ max and both are positive numbers

4. Given my preferences are saved with wine types and/or appellations
   When I open the Buyer Dashboard
   Then pallets whose winery or area name matches any of my preferences are visually highlighted
   And unmatched pallets are shown normally without highlight

5. Given I have never set preferences
   When I open the Buyer Dashboard
   Then all pallets are shown without highlighting
   And a subtle "Set preferences" prompt link appears in the buyer navigation

6. Given I want to update existing preferences
   When I navigate to `/profile/preferences` from the buyer navigation
   Then the form is pre-filled with my current preferences
   And saving again overwrites the previous values

## Tasks / Subtasks

- [x] Create `buyer_preferences` table in Supabase (AC: 1, 2, 3)
  - [x] Define schema: `id`, `user_id` (FK → auth.users, UNIQUE), `preferred_wine_types` (text[]), `preferred_appellations` (text[]), `monthly_budget_min` (numeric), `monthly_budget_max` (numeric), `updated_at`
  - [x] Add RLS: SELECT/INSERT/UPDATE only for `auth.uid() = user_id`
- [x] Create preferences data access layer (AC: 1, 2, 3, 6)
  - [x] Add `getBuyerPreferences(userId)` query in `src/lib/supabase/queries/buyerPreferences.ts`
  - [x] Add `upsertBuyerPreferences(data)` mutation in the same file
- [x] Build `PurchasingPreferencesForm` component (AC: 1, 2, 3, 6)
  - [x] Create `src/pages/profile/PurchasingPreferencesForm.tsx`
  - [x] Wine type multi-select: checkbox group for Red, White, Sparkling, Rosé, Orange, Dessert
  - [x] Appellation tag input: free-text input that adds tags on Enter/comma; max 10 tags; show tag pills with × remove button
  - [x] Budget range: two number inputs (min/max EUR); validate min ≤ max, both > 0
  - [x] On mount: call `getBuyerPreferences(user.id)` and pre-fill if data exists
  - [x] On submit: call `upsertBuyerPreferences`, show success toast, stay on page
- [x] Register `/profile/preferences` route in `App.tsx` (AC: 1, 6)
  - [x] Wrap with `ProtectedDashboardRoute allowedRole="buyer"`
- [x] Add "Preferences" link to buyer navigation in `BuyerDashboard.tsx` (AC: 5)
  - [x] Append "Preferences" to `buyerNavigation` array
  - [x] If no preferences exist, show a subtle inline prompt (e.g., asterisk badge or secondary label)
- [x] Implement preference-based highlighting in `BuyerDashboard.tsx` (AC: 4, 5)
  - [x] On mount, load `getBuyerPreferences(user.id)` alongside the existing profile/area guard
  - [x] Mark a pallet as "preferred" if its `area` name or `winery` name contains any preferred appellation keyword (case-insensitive substring match)
  - [x] Preferred pallets: add `ring-2 ring-emerald-500` highlight to their card
  - [x] Non-preferred pallets: render unchanged
  - [x] If preferences are empty, skip all highlighting logic
- [x] Write unit tests (AC: 1, 3, 4, 5, 6)
  - [x] Test `upsertBuyerPreferences` calls upsert with correct args (mock Supabase)
  - [x] Test budget validation: min > max triggers error; non-positive values trigger error
  - [x] Test appellation tag limit (max 10)
  - [x] Test pallet highlight logic: matching winery/area name → preferred; no preferences → no highlight
  - [x] Test "Set preferences" prompt visible when preferences are null

## Dev Notes

### Architecture & Technical Context

- **Stack**: React.js + TypeScript, Tailwind CSS, Supabase (auth + PostgreSQL), Vercel
- **Auth**: `useAuth()` from `src/lib/supabase/AuthContext.tsx` — exposes `user`, `role`, `session`, `loading`
- **Styling conventions** (from Stories 1.3, 2.1, 2.2): `rounded-3xl bg-white p-8 shadow-sm ring-1 ring-slate-200` for cards; `text-emerald-700` accents; `rounded-full` pills; `text-slate-900` headings; `text-slate-600` body
- **File naming**: PascalCase pages (`PurchasingPreferencesForm.tsx`), camelCase queries (`buyerPreferences.ts`)
- **Preferences are optional**: unlike business profile and area, missing preferences must **not** block dashboard access — no guard redirect for this step
- **BuyerDashboard pallet data**: the static mock array has `area` and `winery` text fields; preference matching runs against these strings. Real semantic filtering (by wine type from DB) comes in Epic 4; this story establishes the highlight scaffolding
- **No new routing guards**: `/profile/preferences` is a soft settings page; `ProtectedDashboardRoute` is sufficient

### Supabase Schema

```sql
CREATE TABLE public.buyer_preferences (
  id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id               uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  preferred_wine_types  text[] NOT NULL DEFAULT '{}',
  preferred_appellations text[] NOT NULL DEFAULT '{}',
  monthly_budget_min    numeric CHECK (monthly_budget_min >= 0),
  monthly_budget_max    numeric CHECK (monthly_budget_max >= 0),
  updated_at            timestamptz DEFAULT now(),
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
```

### Data Access Layer

```typescript
// src/lib/supabase/queries/buyerPreferences.ts  (NEW)
import { supabase } from '../client'

export interface BuyerPreferences {
  user_id: string
  preferred_wine_types: string[]
  preferred_appellations: string[]
  monthly_budget_min: number | null
  monthly_budget_max: number | null
}

export const getBuyerPreferences = async (userId: string): Promise<BuyerPreferences | null> => {
  const { data, error } = await supabase
    .from('buyer_preferences')
    .select('user_id, preferred_wine_types, preferred_appellations, monthly_budget_min, monthly_budget_max')
    .eq('user_id', userId)
    .maybeSingle()
  if (error) throw error
  return data
}

export const upsertBuyerPreferences = async (prefs: BuyerPreferences): Promise<void> => {
  const { error } = await supabase
    .from('buyer_preferences')
    .upsert({ ...prefs, updated_at: new Date().toISOString() }, { onConflict: 'user_id' })
  if (error) throw error
}
```

### Preference Highlight Logic in BuyerDashboard

```typescript
// Helper — pure function, easy to unit test
export const isPalletPreferred = (
  pallet: { area: string; winery: string },
  prefs: BuyerPreferences | null
): boolean => {
  if (!prefs) return false
  const keywords = [
    ...prefs.preferred_appellations,
  ].map(k => k.toLowerCase())
  if (keywords.length === 0) return false
  const haystack = `${pallet.area} ${pallet.winery}`.toLowerCase()
  return keywords.some(k => haystack.includes(k))
}
```

> **Note**: `preferred_wine_types` (Red, White, etc.) cannot be matched against mock pallet data since the mock has no wine type field. Include wine types in the saved preferences but defer type-based matching to Epic 4 (Smart Marketplace). Only appellation keywords are matched now.

### Appellation Tag Input Pattern

```tsx
// Controlled tag input — minimal implementation, no extra library needed
const [tagInput, setTagInput] = useState('')
const [tags, setTags] = useState<string[]>(initialTags)

const addTag = (value: string) => {
  const trimmed = value.trim()
  if (trimmed && !tags.includes(trimmed) && tags.length < 10) {
    setTags(prev => [...prev, trimmed])
  }
  setTagInput('')
}

// onKeyDown on input: if key === 'Enter' or key === ',' → addTag(tagInput)
// On pill × click: setTags(prev => prev.filter(t => t !== tag))
```

### Routing Integration

```tsx
// App.tsx — add after /profile/area route (Story 2.2):
import PurchasingPreferencesForm from './pages/profile/PurchasingPreferencesForm'

<Route
  path="/profile/preferences"
  element={
    <ProtectedDashboardRoute allowedRole="buyer">
      <PurchasingPreferencesForm />
    </ProtectedDashboardRoute>
  }
/>
```

### BuyerDashboard Changes Summary

1. Add `getBuyerPreferences` call alongside existing profile guard (Story 2.1/2.2 `useEffect`):
   ```typescript
   const [preferences, setPreferences] = useState<BuyerPreferences | null>(null)
   // Inside the existing guard useEffect, after setting activeAreaName:
   getBuyerPreferences(user.id).then(setPreferences).catch(() => {/* non-blocking */})
   ```
2. Update pallet render to conditionally add highlight ring:
   ```tsx
   className={`rounded-2xl ... ${isPalletPreferred(pallet, preferences) ? 'ring-2 ring-emerald-500' : ''}`}
   ```
3. Add "Preferences" to `buyerNavigation` array (index 4 or last):
   ```typescript
   const buyerNavigation = ['Active Pallets', 'Area Demand', 'My Orders', 'Saved Wineries', 'Preferences']
   ```
4. Show "Set preferences" prompt when `preferences === null`:
   ```tsx
   {preferences === null && (
     <a href="/profile/preferences" className="text-xs text-emerald-600 underline">
       Set preferences to highlight matching pallets
     </a>
   )}
   ```

### Regression Risk

- The `useEffect` in `BuyerDashboard.tsx` now loads three async resources (profile, area guard → Story 2.1/2.2, and preferences). Preferences must be loaded **independently with a separate non-blocking call** — it must not block dashboard render or interact with the guard redirect logic.
- `preferred_wine_types` is stored in Supabase as `text[]`; when reading from Supabase the JS type will be `string[]`. Ensure the form checkbox state initialises from the loaded array correctly.
- The DB-level `budget_range_valid` CHECK constraint enforces min ≤ max server-side. The client form must also validate this before submit to show a user-friendly error, not rely on a Supabase error response.

### Project Structure Notes

```
src/
├── lib/
│   └── supabase/
│       └── queries/
│           ├── buyerProfile.ts      ← do not modify (owned by Stories 2.1/2.2)
│           ├── macroAreas.ts        ← do not modify (owned by Story 2.2)
│           └── buyerPreferences.ts  ← NEW
├── pages/
│   ├── dashboards/
│   │   └── BuyerDashboard.tsx      ← MODIFY: preferences load + highlight + nav link + prompt
│   └── profile/
│       ├── BuyerProfileForm.tsx     ← do not modify (Story 2.1)
│       ├── AreaSelectionPage.tsx    ← do not modify (Story 2.2)
│       └── PurchasingPreferencesForm.tsx  ← NEW
└── App.tsx                          ← MODIFY: add /profile/preferences route
```

### References

- [Source: _bmad-output/planning-artifacts/epics-stories.md#Story 2.3: Purchasing Preferences Configuration]
- [Source: _bmad-output/planning-artifacts/epics-stories.md#Epic 2: Buyer Profile and Area Management]
- [Source: _bmad-output/planning-artifacts/prd.md#4.3. Smart Marketplace] — Dynamic pricing and marketplace relevance
- [Source: _bmad-output/planning-artifacts/Epic2/story_2.1.md] — `buyer_profiles` table, `getBuyerProfile`, styling conventions, `useAuth()` pattern
- [Source: _bmad-output/planning-artifacts/Epic2/story_2.2.md] — `BuyerDashboard` guard chain, `ProtectedDashboardRoute` reuse, area-scoped pallet filtering
- [Source: _bmad-output/planning-artifacts/Epic1/story_1.3.md] — BuyerDashboard pallet card markup and Tailwind classes
- [Source: winepooler/src/pages/dashboards/BuyerDashboard.tsx] — existing `pallets` mock array, `buyerNavigation`, card markup to extend
- [Source: winepooler/src/App.tsx] — existing route structure to extend

## Dev Agent Record

### Agent Model Used

GPT-5.3-Codex

### Debug Log References

No blockers encountered.

### Completion Notes List

- Created Supabase migration for `buyer_preferences` table with constraints and RLS policies.
- Added preferences data access layer in `src/lib/supabase/queries/buyerPreferences.ts` with `getBuyerPreferences` and `upsertBuyerPreferences`.
- Built `PurchasingPreferencesForm` with wine-type multi-select, appellation tag input (max 10), budget validation (`min <= max`, positive values), prefill loading, and save success state.
- Registered `/profile/preferences` route in `App.tsx` behind buyer `ProtectedDashboardRoute`.
- Extended `BuyerDashboard.tsx` to load preferences non-blockingly, add preferences navigation link, render "Set preferences" prompt when absent, and highlight matching pallets with `ring-2 ring-emerald-500`.
- Added and updated tests for preferences query upsert, budget and tag validation, pallet highlight logic, and "Set preferences" prompt visibility.

### File List

- winepooler/supabase/migrations/20260401002000_create_buyer_preferences.sql (new)
- winepooler/src/lib/supabase/queries/buyerPreferences.ts (new)
- winepooler/src/pages/profile/PurchasingPreferencesForm.tsx (new)
- winepooler/src/App.tsx (modified)
- winepooler/src/pages/dashboards/BuyerDashboard.tsx (modified)
- winepooler/src/lib/supabase/queries/__tests__/buyerPreferences.test.ts (new)
- winepooler/src/pages/profile/__tests__/PurchasingPreferencesForm.test.tsx (new)
- winepooler/src/pages/dashboards/__tests__/BuyerDashboard.test.tsx (modified)
