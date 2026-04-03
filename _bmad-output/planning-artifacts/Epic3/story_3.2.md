# Story 3.2: Add Order to Pallet

Status: review

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a Buyer,
I want to add my wine order to an open pallet,
so that it contributes to reaching the threshold.

## Acceptance Criteria

1. Given an open pallet exists in my Macro-Area
   When I click "Add Order" on a pallet card in the Buyer Dashboard
   Then an "Add Order" form/modal is presented
   And it shows the pallet's winery name, current bottle count, threshold, and progress

2. Given the Add Order form is open
   When I enter a valid bottle quantity (positive integer) and optional wine label/notes
   Then my order is inserted in Supabase as a `pallet_orders` row
   And `virtual_pallets.bottle_count` is incremented by the ordered quantity atomically
   And the pallet card on the dashboard updates to reflect the new count and progress bar

3. Given the pallet currently has 580 bottles and I order 25
   When I confirm my order
   Then my order row is saved with quantity 25
   And `bottle_count` becomes 605
   And the pallet is NOT frozen by this story (freezing is handled in Story 3.3)
   And the progress bar shows 100% capped (605 / 600)

4. Given I try to order 0 or a negative quantity
   When I submit the form
   Then validation blocks the submission with a clear inline error
   And no database write occurs

5. Given the pallet is already in `frozen` or `completed` state
   When I open the pallet card
   Then the "Add Order" button is disabled or absent
   And a label shows the pallet state

6. Given my order is submitted successfully
   When other buyers in the same Macro-Area are viewing the dashboard
   Then their pallet progress bars update in real-time via Supabase Realtime subscription

## Tasks / Subtasks

- [x] Create `pallet_orders` table in Supabase (AC: 2)
  - [x] Schema: `id`, `pallet_id` (FK → virtual_pallets), `buyer_id` (FK → auth.users), `quantity` (integer CHECK > 0), `wine_label` (text, nullable), `notes` (text, nullable), `created_at`
  - [x] RLS: buyer can INSERT own orders (`auth.uid() = buyer_id`); authenticated users can SELECT orders on pallets in their area
- [x] Create atomic bottle-count increment function/RPC in Supabase (AC: 2, 3)
  - [x] Create Postgres function `increment_pallet_bottle_count(p_pallet_id uuid, p_quantity integer)` that atomically increments `bottle_count` and updates `updated_at` using `UPDATE ... RETURNING`
  - [x] Ensure function runs as SECURITY DEFINER with explicit permission check
  - [x] Expose via Supabase RPC: `supabase.rpc('increment_pallet_bottle_count', { p_pallet_id, p_quantity })`
- [x] Extend `virtualPallets.ts` query module (AC: 2, 3)
  - [x] Add `addOrderToPallet(palletId, buyerId, quantity, wineLabel?, notes?)` — wraps INSERT into `pallet_orders` then calls RPC `increment_pallet_bottle_count`
  - [x] Add `getPalletById(palletId)` — used to refresh a single pallet card after order
- [x] Build `AddOrderModal` component (AC: 1, 2, 3, 4, 5)
  - [x] Create `src/pages/pallets/AddOrderModal.tsx`
  - [x] Props: `pallet: VirtualPallet`, `buyerUserId: string`, `onClose: () => void`, `onOrderAdded: (updatedBottleCount: number) => void`
  - [x] Show pallet context: winery name, current bottle count, threshold, progress bar
  - [x] Quantity input: integer only; validate > 0; show inline error on invalid value
  - [x] Optional wine label and notes text inputs
  - [x] On submit: call `addOrderToPallet`; on success call `onOrderAdded(newCount)` then close
  - [x] Disable submit while loading; show error message if RPC fails
- [x] Wire "Add Order" button on pallet cards in `BuyerDashboard.tsx` (AC: 1, 5)
  - [x] Map View cards: add "Add Order" button, disabled if `pallet.state !== 'open'`
  - [x] Grid View cards: same button logic
  - [x] State badge: show `FROZEN` or `COMPLETED` label when `state !== 'open'`
  - [x] `onOrderAdded` callback: update the specific pallet in `pallets` state array (replace by id) to reflect new `bottle_count` and recalculated `progress`
- [x] Subscribe to Supabase Realtime for `virtual_pallets` updates (AC: 6)
  - [x] In `BuyerDashboard.tsx`, subscribe to `UPDATE` events on `virtual_pallets` filtered by `area_id = eq.{areaId}`
  - [x] On event: update the matching pallet in local `pallets` state with new `bottle_count` and `state`
  - [x] Unsubscribe on component unmount (cleanup in `useEffect` return)
- [x] Write unit tests (AC: 2, 3, 4, 5, 6)
  - [x] Test `addOrderToPallet`: mock Supabase insert + RPC call; verify both are called with correct args
  - [x] Test quantity validation: 0 and negative values blocked; positive integers pass
  - [x] Test `onOrderAdded` updates correct pallet in local state array
  - [x] Test "Add Order" button disabled when state is `frozen` or `completed`
  - [x] Test Realtime update handler: receiving an UPDATE event modifies the matching pallet in state

## Dev Notes

### Architecture & Technical Context

- **Stack**: React.js + TypeScript, Tailwind CSS, Supabase (auth + PostgreSQL + Realtime), Vercel
- **Auth**: `useAuth()` → `user`, `role`; buyer's `areaId` resolved by guard chain (Stories 2.1/2.2) and stored in `BuyerDashboard` local state
- **Pallet data state**: Story 3.1 replaces the static mock with `useState<BuyerPalletCard[]>`. This story extends `BuyerPalletCard` to include `state` and `palletId` (raw UUID) so the "Add Order" button can check `state` and the modal gets the real pallet record
- **Atomic increment**: use a PostgreSQL RPC, NOT a read-then-write from the client, to prevent race conditions (NFR1). Story 3.4 uses a DB-level lock; this RPC is the correct building block. The RPC increments with `UPDATE ... WHERE id = p_pallet_id RETURNING bottle_count` which is atomic in PostgreSQL
- **Progress bar cap**: `palletProgressPercent` (from `src/lib/palletProgress.ts`, Story 3.1) already clamps to 100. Use it here; do not re-implement
- **Realtime pattern**: Supabase Realtime channel subscription for `virtual_pallets` UPDATE events. Filter server-side by `area_id` to avoid receiving events for other areas. Subscribe once in a `useEffect` with `areaId` as dependency; return unsubscribe cleanup
- **Modal pattern**: same `fixed inset-0 bg-black/40` backdrop + `rounded-3xl bg-white` panel established in Story 3.1 (`CreatePalletModal`). Reuse the same visual pattern
- **Styling conventions**: `rounded-3xl bg-white shadow-sm ring-1 ring-slate-200`; `text-emerald-700`; `bg-emerald-600` progress fill; `text-slate-900`/`text-slate-600`

### Supabase Schema

```sql
-- pallet_orders table
CREATE TABLE public.pallet_orders (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  pallet_id   uuid NOT NULL REFERENCES public.virtual_pallets(id) ON DELETE CASCADE,
  buyer_id    uuid NOT NULL REFERENCES auth.users(id),
  quantity    integer NOT NULL CHECK (quantity > 0),
  wine_label  text,
  notes       text,
  created_at  timestamptz DEFAULT now()
);

ALTER TABLE public.pallet_orders ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Buyer can insert own orders"
  ON public.pallet_orders FOR INSERT
  WITH CHECK (auth.uid() = buyer_id);

CREATE POLICY "Authenticated users can read orders"
  ON public.pallet_orders FOR SELECT
  TO authenticated
  USING (true);

-- Atomic increment RPC
CREATE OR REPLACE FUNCTION public.increment_pallet_bottle_count(
  p_pallet_id uuid,
  p_quantity  integer
)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_new_count integer;
BEGIN
  -- Validate quantity
  IF p_quantity <= 0 THEN
    RAISE EXCEPTION 'quantity must be positive';
  END IF;

  UPDATE public.virtual_pallets
  SET
    bottle_count = bottle_count + p_quantity,
    updated_at   = now()
  WHERE id = p_pallet_id
    AND state = 'open'
  RETURNING bottle_count INTO v_new_count;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'pallet % not found or not open', p_pallet_id;
  END IF;

  RETURN v_new_count;
END;
$$;

-- Grant execute to authenticated role
GRANT EXECUTE ON FUNCTION public.increment_pallet_bottle_count(uuid, integer)
  TO authenticated;
```

### Data Access Layer Extension

```typescript
// Extend src/lib/supabase/queries/virtualPallets.ts  (MODIFY — append)

export const getPalletById = async (palletId: string): Promise<VirtualPallet | null> => {
  const { data, error } = await supabase
    .from('virtual_pallets')
    .select(`
      id, area_id, winery_id, state, bottle_count, threshold, created_by,
      macro_areas(name),
      winery_profiles(company_name)
    `)
    .eq('id', palletId)
    .maybeSingle()
  if (error) throw error
  if (!data) return null
  return {
    ...data,
    area_name: (data.macro_areas as any)?.name,
    winery_name: (data.winery_profiles as any)?.company_name,
  }
}

export const addOrderToPallet = async (
  palletId: string,
  buyerId: string,
  quantity: number,
  wineLabel?: string,
  notes?: string
): Promise<number> => {
  // Insert order row
  const { error: insertError } = await supabase
    .from('pallet_orders')
    .insert({ pallet_id: palletId, buyer_id: buyerId, quantity, wine_label: wineLabel, notes })
  if (insertError) throw insertError

  // Atomically increment bottle_count via RPC — returns new count
  const { data: newCount, error: rpcError } = await supabase
    .rpc('increment_pallet_bottle_count', { p_pallet_id: palletId, p_quantity: quantity })
  if (rpcError) throw rpcError
  return newCount as number
}
```

### BuyerPalletCard Type Extension

Story 3.1 defines `BuyerPalletCard` with `{ id, area, winery, progress, bottles }`. **Extend** it to add `state` and `palletId` (the raw UUID needed by the modal):

```typescript
interface BuyerPalletCard {
  id: string           // display id (same as palletId for now, or keep as PAL-XXX alias)
  palletId: string     // raw uuid from virtual_pallets.id — used by AddOrderModal
  area: string
  winery: string
  progress: string
  bottles: number
  state: 'open' | 'frozen' | 'completed'
}

// In the mapping from getPalletsByArea rows:
{
  id: r.id,
  palletId: r.id,
  area: r.area_name ?? '',
  winery: r.winery_name ?? '',
  progress: palletProgressLabel(r.bottle_count, r.threshold),
  bottles: r.bottle_count,
  state: r.state,
}
```

### onOrderAdded Callback — Local State Update

Avoid a full re-fetch after each order (reduces DB calls). Update the specific card in place:

```typescript
const handleOrderAdded = (palletId: string, newBottleCount: number) => {
  setPallets(prev => prev.map(p =>
    p.palletId === palletId
      ? {
          ...p,
          bottles: newBottleCount,
          progress: palletProgressLabel(newBottleCount, 600), // threshold is always 600 for now
        }
      : p
  ))
}
```

> Pass `threshold` per pallet if variable thresholds are needed in the future; for now 600 is the constant (FR4).

### Supabase Realtime Subscription

```typescript
// In BuyerDashboard.tsx, add alongside the pallet-loading useEffect:
useEffect(() => {
  if (!areaId) return

  const channel = supabase
    .channel(`pallets-area-${areaId}`)
    .on(
      'postgres_changes',
      {
        event: 'UPDATE',
        schema: 'public',
        table: 'virtual_pallets',
        filter: `area_id=eq.${areaId}`,
      },
      (payload) => {
        const updated = payload.new as { id: string; bottle_count: number; state: string; threshold: number }
        setPallets(prev => prev.map(p =>
          p.palletId === updated.id
            ? {
                ...p,
                bottles: updated.bottle_count,
                progress: palletProgressLabel(updated.bottle_count, updated.threshold),
                state: updated.state as BuyerPalletCard['state'],
              }
            : p
        ))
      }
    )
    .subscribe()

  return () => { supabase.removeChannel(channel) }
}, [areaId])
```

> **Realtime prerequisite**: Supabase Realtime must be enabled on the `virtual_pallets` table in the Supabase dashboard (Table → Replication → enable for UPDATE events). Document this as a deployment step.

### "Add Order" Button on Pallet Cards

**Map View card** (inside `BuyerDashboard.tsx` map section):
```tsx
<article key={pallet.palletId} className="rounded-2xl bg-white/90 p-4 shadow-sm">
  <p className="text-xs font-semibold uppercase tracking-wide text-emerald-700">{pallet.area}</p>
  <p className="mt-2 text-base font-semibold text-slate-900">{pallet.winery}</p>
  <p className="mt-1 text-sm text-slate-600">Progress {pallet.progress}</p>
  {pallet.state === 'open' ? (
    <button
      type="button"
      onClick={() => setActivePalletForOrder(pallet)}
      className="mt-3 rounded-full bg-emerald-600 px-3 py-1 text-xs font-medium text-white hover:bg-emerald-700"
    >
      Add Order
    </button>
  ) : (
    <span className="mt-3 inline-block rounded-full bg-slate-200 px-3 py-1 text-xs font-medium text-slate-600 uppercase">
      {pallet.state}
    </span>
  )}
</article>
```

Use `activePalletForOrder: BuyerPalletCard | null` state to control which modal is open:
```typescript
const [activePalletForOrder, setActivePalletForOrder] = useState<BuyerPalletCard | null>(null)

// Modal:
{activePalletForOrder && user && (
  <AddOrderModal
    pallet={/* map BuyerPalletCard → VirtualPallet shape */}
    buyerUserId={user.id}
    onClose={() => setActivePalletForOrder(null)}
    onOrderAdded={(newCount) => {
      handleOrderAdded(activePalletForOrder.palletId, newCount)
      setActivePalletForOrder(null)
    }}
  />
)}
```

### Regression Risk

- **`BuyerPalletCard` extension**: adding `state` and `palletId` fields must be done carefully — the Map View and Grid View card markup in Story 3.1 uses `pallet.id` as the React `key`. Change `key` to `pallet.palletId` if `id` stays as a display alias, otherwise keep `id === palletId` and update consistently.
- **`palletProgressLabel` import**: it is defined in `src/lib/palletProgress.ts` (Story 3.1). Do not reimport from `virtualPallets.ts`. Import directly from the utility file.
- **RPC failure handling**: if the RPC (`increment_pallet_bottle_count`) raises an exception (pallet not open), the order INSERT has already run. Consider wrapping both operations in a Supabase transaction (Edge Function) for future hardening; for now document this as a known limitation deferred to Story 3.4.
- **Realtime + local update**: both `handleOrderAdded` (local) and the Realtime subscription update the same `pallets` state. When the current buyer adds an order, both will fire. Use the Realtime payload as the single source of truth: the local `handleOrderAdded` can be removed once Realtime is confirmed working, or kept as an optimistic update to avoid the 100–500ms Realtime latency.

### Project Structure Notes

```
src/
├── lib/
│   ├── palletProgress.ts                       ← do not modify (Story 3.1)
│   └── supabase/
│       └── queries/
│           ├── virtualPallets.ts               ← MODIFY: add getPalletById, addOrderToPallet
│           └── wineryProfiles.ts               ← do not modify (Story 3.1)
├── pages/
│   ├── dashboards/
│   │   └── BuyerDashboard.tsx                 ← MODIFY: BuyerPalletCard extension, Add Order button,
│   │                                              activePalletForOrder state, Realtime subscription
│   └── pallets/
│       ├── CreatePalletModal.tsx               ← do not modify (Story 3.1)
│       └── AddOrderModal.tsx                   ← NEW
└── App.tsx                                     ← no change needed
```

### References

- [Source: _bmad-output/planning-artifacts/epics-stories.md#Story 3.2: Add Order to Pallet]
- [Source: _bmad-output/planning-artifacts/epics-stories.md#Epic 3: Virtual Pallet Pooling]
- [Source: _bmad-output/planning-artifacts/prd.md#4.2. Geographic Pooling Engine] — Virtual Pallet Logic, Threshold Management, Real-time Progress
- [Source: _bmad-output/planning-artifacts/prd.md#8. Non-Functional Requirements] — NFR1 concurrency
- [Source: _bmad-output/planning-artifacts/Epic3/story_3.1.md] — `virtual_pallets` schema, `VirtualPallet` type, `BuyerPalletCard` interface, `palletProgress.ts`, `CreatePalletModal` modal pattern, `BuyerDashboard` data-load `useEffect` structure
- [Source: _bmad-output/planning-artifacts/Epic2/story_2.2.md] — `areaId` state in `BuyerDashboard`, guard chain ordering
- [Source: winepooler/src/pages/dashboards/BuyerDashboard.tsx] — current card markup for Map View and Grid View to extend
- [Source: winepooler/src/lib/supabase/client.ts] — `supabase` client for Realtime channel creation

## Dev Agent Record

### Agent Model Used

Claude Sonnet 4.6

### Debug Log References

No blockers encountered.

### Completion Notes List

- Created Supabase migration for `pallet_orders` table with RLS and `increment_pallet_bottle_count` SECURITY DEFINER RPC function that atomically increments `bottle_count` and validates pallet is open.
- Extended `virtualPallets.ts` with `getPalletById` (select with joins, maybeSingle) and `addOrderToPallet` (INSERT order row then RPC call returning new bottle count).
- Extended `BuyerPalletCard` interface with `palletId`, `state`, and `threshold` fields; updated pallet mapping in useEffect accordingly.
- Built `AddOrderModal` with pallet context display (winery, count/threshold, progress bar), quantity validation (positive integer required), optional wine label and notes inputs, loading state, and error display.
- Wired `activePalletForOrder` state and "Add Order" button on both Map View and Grid View pallet cards with `disabled` when `state !== 'open'`. Added state badge (FROZEN/COMPLETED) on non-open pallets.
- Added `handleOrderAdded` callback that optimistically updates the matching pallet card in local state without a re-fetch.
- Added Supabase Realtime `postgres_changes` UPDATE subscription on `virtual_pallets` filtered by `area_id`, updating local pallet state on receipt. Subscription cleaned up on unmount.
- Added tests: `getPalletById` (found/not found), `addOrderToPallet` (success, insert failure, RPC failure), `AddOrderModal` (context render, quantity validation 0/negative/empty, success callback, RPC error, cancel), `BuyerDashboard` Add Order button disabled for frozen/completed, enabled for open, and Realtime channel subscription verified.

### File List

- winepooler/supabase/migrations/20260401004000_create_pallet_orders_and_increment_rpc.sql (new)
- winepooler/src/lib/supabase/queries/virtualPallets.ts (modified)
- winepooler/src/pages/pallets/AddOrderModal.tsx (new)
- winepooler/src/pages/dashboards/BuyerDashboard.tsx (modified)
- winepooler/src/lib/supabase/queries/__tests__/virtualPallets.test.ts (modified)
- winepooler/src/pages/pallets/__tests__/AddOrderModal.test.tsx (new)
- winepooler/src/pages/dashboards/__tests__/BuyerDashboard.test.tsx (modified)
