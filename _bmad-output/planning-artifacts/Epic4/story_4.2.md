# Story 4.2: Real-Time Inventory Sync

Status: review

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a Buyer,
I want to see current stock levels,
so that I know availability.

## Acceptance Criteria

1. Given stock levels for a winery's wines are stored in Supabase
   When I open the Buyer Dashboard
   Then each open pallet card shows the current available stock (bottles remaining to allocate)
   And the data reflects the latest inventory, not a stale cached value

2. Given a winery updates stock levels in the Supabase `wine_inventory` table
   When the record is saved
   Then all Buyer Dashboards viewing that winery's pallets update within 2 seconds via Realtime
   And the new stock figure replaces the old one without a full page reload

3. Given a pallet's requested bottle count has reached or exceeded available inventory
   When the pallet card renders
   Then the card is clearly marked as "Out of Stock"
   And the "Add Order" button is disabled or hidden

4. Given inventory is partially depleted (allocated orders > 50% of stock)
   When the pallet card renders
   Then a "Low Stock" warning indicator is shown

5. Given the inventory sync fetch fails (network error or Supabase unreachable)
   When the error occurs
   Then the last known stock values remain displayed
   And an inline "Sync error — showing last known stock" label appears on affected cards
   And a retry mechanism is available

6. Given I am a Winery user on the Winery Portal
   When I view the picking lists section
   Then each pallet row shows the total bottles allocated vs. total inventory for that wine
   And the data reflects the live inventory (same data source as buyer view)

## Tasks / Subtasks

- [x] Create `wine_inventory` table in Supabase (AC: 1, 2, 3, 4, 6)
  - [x] Schema: `id`, `winery_id` (FK → winery_profiles), `wine_label` (text), `sku` (text, unique per winery), `total_stock` (integer CHECK ≥ 0), `allocated_bottles` (integer DEFAULT 0 CHECK ≥ 0), `updated_at`
  - [x] RLS: winery owner can INSERT/UPDATE own rows; authenticated users can SELECT all
  - [x] Seed 3 rows (one per mock winery: Cantina Aurora, Tenuta Collina, Vigna Nuova) with `total_stock = 800`, `allocated_bottles = 432/324/486` matching `BuyerDashboard` mock pallet data
  - [x] Add computed column or view `available_stock = total_stock - allocated_bottles`
- [x] Link `virtual_pallets` to `wine_inventory` (AC: 1, 3, 4)
  - [x] `ALTER TABLE public.virtual_pallets ADD COLUMN inventory_id uuid REFERENCES public.wine_inventory(id);`
  - [x] Column nullable (pallets may not have inventory linked yet)
- [x] Create inventory data access layer (AC: 1, 2, 5)
  - [x] Add `getInventoryForArea(areaId)` in `src/lib/supabase/queries/wineInventory.ts` — returns inventory for all wineries with open pallets in the area, joined with `winery_profiles`
  - [x] Add `getInventoryByPallet(palletId)` — returns the single inventory row linked to a pallet
- [x] Extend `BuyerPalletCard` with inventory fields (AC: 1, 3, 4)
  - [x] Add `availableStock: number | null`, `totalStock: number | null`, `allocatedBottles: number | null` to `BuyerPalletCard` in `BuyerDashboard.tsx`
  - [x] Populate from joined inventory data in `getPalletsByArea` or a separate `getInventoryForArea` call
- [x] Build `InventoryStatusBadge` component (AC: 3, 4, 5)
  - [x] Create `src/components/pallets/InventoryStatusBadge.tsx`
  - [x] Props: `availableStock: number | null`, `allocatedBottles: number | null`, `totalStock: number | null`, `syncError?: boolean`
  - [x] Status logic:
    - `availableStock <= 0` → "Out of Stock" (red badge)
    - `allocatedBottles / totalStock >= 0.5` → "Low Stock" (amber badge)
    - `syncError` → "Sync error" (muted grey label)
    - Otherwise → show `availableStock` bottles available (green/neutral)
  - [x] "Out of Stock" state disables the "Add Order" button (pass `isOutOfStock` prop up to the card)
- [x] Integrate `InventoryStatusBadge` into Grid and Map View pallet cards (AC: 1, 3, 4, 5)
  - [x] Grid View: add badge below `PalletPricingBadge` (Story 4.1) in each `<article>`
  - [x] Map View: add compact stock chip below the pricing chip
  - [x] Disable "Add Order" button when `availableStock <= 0`
- [x] Subscribe to Supabase Realtime for `wine_inventory` updates (AC: 2)
  - [x] In `BuyerDashboard.tsx`, add a Realtime channel subscription for `UPDATE` events on `wine_inventory`
  - [x] Filter by `winery_id` matching any winery in the current area (or subscribe to all, filter client-side)
  - [x] On event: update the matching pallet card's inventory fields in `pallets` state
  - [x] Cleanup subscription on unmount
- [x] Replace static picking list data in `WineryDashboard.tsx` with live DB query (AC: 6)
  - [x] Add `getWineryPickingList(wineryId)` query in `src/lib/supabase/queries/virtualPallets.ts` — fetches frozen/open pallets for the winery with joined inventory and area name
  - [x] Replace `pickingLists` static array with live state loaded on mount via `useAuth().user.id` → `winery_profiles` lookup → `getWineryPickingList`
  - [x] Add `allocated / total` column to the picking list table
- [x] Write unit tests (AC: 1, 3, 4, 5, 6)
  - [x] Test `InventoryStatusBadge`: out-of-stock condition renders red badge and disables button
  - [x] Test `InventoryStatusBadge`: low-stock threshold (50%) renders amber badge
  - [x] Test `InventoryStatusBadge`: sync error prop shows error label
  - [x] Test Realtime handler: UPDATE event on `wine_inventory` updates matching pallet card state
  - [x] Test `getInventoryForArea`: returns correct rows joined with winery data

## Dev Notes

### Architecture & Technical Context

- **Stack**: React.js + TypeScript, Tailwind CSS, Supabase (PostgreSQL + Realtime), Vercel
- **Auth**: `useAuth()` → `user`, `role`. Buyers use `areaId` from profile guard (Stories 2.1/2.2). Wineries use `user.id` to look up their `winery_profiles.id`
- **Realtime channels already in `BuyerDashboard.tsx`**: Story 3.2 created a channel for `virtual_pallets` UPDATE events on `area_id`. This story adds a **second** Realtime channel for `wine_inventory` UPDATE events. Use a separate channel name (e.g., `inventory-area-${areaId}`). Do not merge with the pallets channel
- **`allocated_bottles` sync strategy**: the `wine_inventory.allocated_bottles` column tracks how many bottles from total stock are committed to open pallets. When orders are added (Story 3.2/3.4 via `add_order_and_increment`), the `allocated_bottles` counter should also increment. Two approaches:
  - **Option A (recommended)**: extend the `add_order_and_increment` PL/pgSQL function (Story 3.4) to also `UPDATE wine_inventory SET allocated_bottles = allocated_bottles + p_quantity WHERE id = (SELECT inventory_id FROM virtual_pallets WHERE id = p_pallet_id)`
  - **Option B**: use a PostgreSQL trigger on `virtual_pallets` UPDATE that syncs `allocated_bottles` whenever `bottle_count` changes
  - **Recommendation**: Option A keeps the logic in the same atomic transaction already established in Story 3.4
- **`available_stock` as computed value**: store only `total_stock` and `allocated_bottles`; compute `available_stock = total_stock - allocated_bottles` on the client: `r.total_stock - r.allocated_bottles`. Do not add a generated column to avoid schema complexity
- **Styling conventions**:
  - Buyer Dashboard: `text-emerald-700`/`slate-*` as established
  - Out of Stock badge: `bg-red-100 text-red-700 rounded-full px-2 py-0.5 text-xs font-medium`
  - Low Stock badge: `bg-amber-100 text-amber-700 rounded-full px-2 py-0.5 text-xs font-medium`
  - Available stock: `text-slate-500 text-xs`
  - Sync error: `text-slate-400 text-xs italic`
  - Winery Portal: `stone-*` palette (already established in `WineryDashboard.tsx`)
- **`WineryDashboard.tsx` live data**: currently renders a static `pickingLists` array. This story replaces it exactly as `BuyerDashboard.tsx`'s static pallets array was replaced in Story 3.1. Follow the same pattern: `useState` + `useEffect` on mount, `useAuth()` for user identity

### Supabase Schema

```sql
-- wine_inventory table
CREATE TABLE public.wine_inventory (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  winery_id         uuid NOT NULL REFERENCES public.winery_profiles(id) ON DELETE CASCADE,
  wine_label        text NOT NULL,
  sku               text NOT NULL,
  total_stock       integer NOT NULL DEFAULT 0 CHECK (total_stock >= 0),
  allocated_bottles integer NOT NULL DEFAULT 0 CHECK (allocated_bottles >= 0),
  updated_at        timestamptz DEFAULT now(),
  UNIQUE (winery_id, sku)
);

ALTER TABLE public.wine_inventory ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can read inventory"
  ON public.wine_inventory FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Winery can update own inventory"
  ON public.wine_inventory FOR UPDATE
  USING (auth.uid() = (SELECT user_id FROM public.winery_profiles WHERE id = winery_id));

CREATE POLICY "Winery can insert own inventory"
  ON public.wine_inventory FOR INSERT
  WITH CHECK (auth.uid() = (SELECT user_id FROM public.winery_profiles WHERE id = winery_id));

-- Seed (matching mock pallet data from BuyerDashboard)
-- Replace winery UUIDs with actual seeded values from Story 3.1
INSERT INTO public.wine_inventory (winery_id, wine_label, sku, total_stock, allocated_bottles)
VALUES
  ((SELECT id FROM winery_profiles WHERE company_name = 'Cantina Aurora'), 'Rosso Riserva', 'CAU-RR-001', 800, 432),
  ((SELECT id FROM winery_profiles WHERE company_name = 'Tenuta Collina'), 'Bianco Superiore', 'TCO-BS-001', 700, 324),
  ((SELECT id FROM winery_profiles WHERE company_name = 'Vigna Nuova'),    'Barolo DOCG', 'VNU-BA-001', 900, 486);

-- Link virtual_pallets to inventory
ALTER TABLE public.virtual_pallets
  ADD COLUMN inventory_id uuid REFERENCES public.wine_inventory(id) ON DELETE SET NULL;
```

### Extend `add_order_and_increment` RPC to sync `allocated_bottles` (Option A)

```sql
-- CREATE OR REPLACE to extend Story 3.4's function
CREATE OR REPLACE FUNCTION public.add_order_and_increment(
  p_pallet_id  uuid,
  p_buyer_id   uuid,
  p_quantity   integer,
  p_wine_label text DEFAULT NULL,
  p_notes      text DEFAULT NULL,
  OUT order_id  uuid,
  OUT new_count integer,
  OUT new_state text
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

  -- Sync allocated_bottles in wine_inventory (if pallet has linked inventory)
  IF v_inventory_id IS NOT NULL THEN
    UPDATE public.wine_inventory
    SET
      allocated_bottles = allocated_bottles + p_quantity,
      updated_at        = now()
    WHERE id = v_inventory_id;
  END IF;
END;
$$;
```

### Data Access Layer

```typescript
// src/lib/supabase/queries/wineInventory.ts  (NEW)
import { supabase } from '../client'

export interface WineInventory {
  id: string
  winery_id: string
  wine_label: string
  sku: string
  total_stock: number
  allocated_bottles: number
  // computed client-side:
  available_stock: number
}

export const getInventoryForArea = async (areaId: string): Promise<WineInventory[]> => {
  // Get inventory for wineries that have at least one pallet in the area
  const { data, error } = await supabase
    .from('wine_inventory')
    .select(`
      id, winery_id, wine_label, sku, total_stock, allocated_bottles,
      winery_profiles!inner(id),
      virtual_pallets!inner(area_id)
    `)
    .eq('virtual_pallets.area_id', areaId)
  if (error) throw error
  return (data ?? []).map(r => ({
    ...r,
    available_stock: r.total_stock - r.allocated_bottles,
  }))
}

export const getInventoryByPallet = async (palletId: string): Promise<WineInventory | null> => {
  const { data, error } = await supabase
    .from('virtual_pallets')
    .select('inventory_id, wine_inventory(id, winery_id, wine_label, sku, total_stock, allocated_bottles)')
    .eq('id', palletId)
    .maybeSingle()
  if (error) throw error
  if (!data?.wine_inventory) return null
  const inv = data.wine_inventory as any
  return { ...inv, available_stock: inv.total_stock - inv.allocated_bottles }
}
```

### Extended `getPalletsByArea` with Inventory Join

```typescript
// Extend the select in virtualPallets.ts to include inventory:
.select(`
  id, area_id, winery_id, state, bottle_count, threshold, created_by,
  bulk_price_per_bottle, retail_price_per_bottle, inventory_id,
  macro_areas(name),
  winery_profiles(company_name),
  wine_inventory(total_stock, allocated_bottles)
`)

// In the mapping lambda, add:
availableStock: row.wine_inventory
  ? (row.wine_inventory as any).total_stock - (row.wine_inventory as any).allocated_bottles
  : null,
totalStock: (row.wine_inventory as any)?.total_stock ?? null,
allocatedBottles: (row.wine_inventory as any)?.allocated_bottles ?? null,
```

### `BuyerPalletCard` Extension

```typescript
interface BuyerPalletCard {
  id: string
  palletId: string
  area: string
  winery: string
  progress: string
  bottles: number
  state: 'open' | 'frozen' | 'completed'
  bulkPrice: number | null
  retailPrice: number | null
  availableStock: number | null   // ← NEW
  totalStock: number | null       // ← NEW
  allocatedBottles: number | null // ← NEW
  inventoryId: string | null      // ← NEW (for Realtime matching)
  inventorySyncError?: boolean    // ← NEW (set by Realtime error handler)
}
```

### Supabase Realtime Subscription for Inventory

```typescript
// In BuyerDashboard.tsx — add alongside the virtual_pallets Realtime channel (Story 3.2):
useEffect(() => {
  if (!areaId) return

  const inventoryChannel = supabase
    .channel(`inventory-area-${areaId}`)
    .on(
      'postgres_changes',
      {
        event: 'UPDATE',
        schema: 'public',
        table: 'wine_inventory',
      },
      (payload) => {
        const updated = payload.new as {
          id: string
          total_stock: number
          allocated_bottles: number
        }
        setPallets(prev => prev.map(p =>
          p.inventoryId === updated.id
            ? {
                ...p,
                totalStock: updated.total_stock,
                allocatedBottles: updated.allocated_bottles,
                availableStock: updated.total_stock - updated.allocated_bottles,
                inventorySyncError: false,
              }
            : p
        ))
      }
    )
    .subscribe((status) => {
      if (status === 'CHANNEL_ERROR') {
        // Mark all pallet cards as having a sync error
        setPallets(prev => prev.map(p => ({ ...p, inventorySyncError: true })))
      }
    })

  return () => { supabase.removeChannel(inventoryChannel) }
}, [areaId])
```

### `InventoryStatusBadge` Component

```tsx
// src/components/pallets/InventoryStatusBadge.tsx  (NEW)
interface InventoryStatusBadgeProps {
  availableStock: number | null
  allocatedBottles: number | null
  totalStock: number | null
  syncError?: boolean
}

const InventoryStatusBadge = ({
  availableStock,
  allocatedBottles,
  totalStock,
  syncError,
}: InventoryStatusBadgeProps) => {
  if (syncError) {
    return <p className="text-xs italic text-slate-400">Sync error — showing last known stock</p>
  }
  if (availableStock === null) return null

  if (availableStock <= 0) {
    return (
      <span className="rounded-full bg-red-100 px-2 py-0.5 text-xs font-medium text-red-700">
        Out of Stock
      </span>
    )
  }

  const isLowStock =
    totalStock && allocatedBottles !== null && allocatedBottles / totalStock >= 0.5

  return (
    <div className="flex items-center gap-2">
      <span className="text-xs text-slate-500">{availableStock} bottles available</span>
      {isLowStock && (
        <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-700">
          Low Stock
        </span>
      )}
    </div>
  )
}

export default InventoryStatusBadge
```

### "Out of Stock" Disables "Add Order" Button

Pass an `isOutOfStock` flag down to the card render:

```tsx
const isOutOfStock = (pallet.availableStock ?? Infinity) <= 0

// In card render (both Map and Grid View):
{pallet.state === 'open' && !isOutOfStock ? (
  <button onClick={() => setActivePalletForOrder(pallet)}>Add Order</button>
) : (
  <span>{pallet.state !== 'open' ? pallet.state.toUpperCase() : 'OUT OF STOCK'}</span>
)}
```

### `WineryDashboard` Live Picking List

```typescript
// Add to src/lib/supabase/queries/virtualPallets.ts:
export const getWineryPickingList = async (wineryProfileId: string) => {
  const { data, error } = await supabase
    .from('virtual_pallets')
    .select(`
      id, state, bottle_count, threshold,
      macro_areas(name),
      wine_inventory(total_stock, allocated_bottles, wine_label)
    `)
    .eq('winery_id', wineryProfileId)
    .in('state', ['open', 'frozen'])
    .order('created_at', { ascending: false })
  if (error) throw error
  return data ?? []
}
```

In `WineryDashboard.tsx`, replace the static `pickingLists` constant with:
```typescript
const { user } = useAuth()
const [pickingLists, setPickingLists] = useState<PickingListRow[]>([])

useEffect(() => {
  if (!user) return
  // Get winery profile id from winery_profiles by user_id
  supabase.from('winery_profiles').select('id').eq('user_id', user.id).maybeSingle()
    .then(({ data }) => {
      if (data) getWineryPickingList(data.id).then(setPickingLists)
    })
}, [user])
```

Add an `Allocated / Total` column to the table, e.g.:
```tsx
<td className="px-4 py-3">{item.allocated} / {item.total}</td>
```

### Regression Risk

- **`add_order_and_increment` RPC extension**: the function body is extended (`CREATE OR REPLACE`) to also update `wine_inventory.allocated_bottles`. If `inventory_id` is `NULL`, the UPDATE is skipped — no error thrown. Existing behaviour for pallets without linked inventory is unchanged.
- **`getPalletsByArea` join depth**: adding `wine_inventory(...)` as a nested join on `virtual_pallets` depends on the `inventory_id` FK column added in this story. If the column does not exist yet (migration not run), the query will fail. Ensure DB migration runs before deploying frontend changes.
- **Realtime channels**: `BuyerDashboard.tsx` now has two Realtime subscriptions (`pallets-area-${areaId}` and `inventory-area-${areaId}`). Both must be cleaned up on unmount. Verify that both `useEffect` cleanup functions call `supabase.removeChannel`.
- **`BuyerPalletCard` extension**: adding `availableStock`, `totalStock`, `allocatedBottles`, `inventoryId`, `inventorySyncError` is additive — existing card markup continues to work. Only `InventoryStatusBadge` and the "Add Order" gate consume the new fields.
- **`WineryDashboard.tsx` static → live**: same pattern as `BuyerDashboard.tsx` in Story 3.1. Keep the same table column structure; only the data source changes.

### Project Structure Notes

```
src/
├── components/
│   └── pallets/
│       ├── PalletPricingBadge.tsx      ← do not modify (Story 4.1)
│       └── InventoryStatusBadge.tsx    ← NEW
├── lib/
│   └── supabase/
│       └── queries/
│           ├── virtualPallets.ts       ← MODIFY: extend getPalletsByArea select + mapping,
│           │                               add getWineryPickingList
│           └── wineInventory.ts        ← NEW
├── pages/
│   ├── dashboards/
│   │   ├── BuyerDashboard.tsx         ← MODIFY: BuyerPalletCard inventory fields,
│   │   │                                   InventoryStatusBadge integration,
│   │   │                                   inventory Realtime channel, OOS guard
│   │   └── WineryDashboard.tsx        ← MODIFY: static → live picking list
└── (Supabase)
    ├── wine_inventory table + RLS      ← NEW
    ├── virtual_pallets.inventory_id FK ← NEW column
    └── add_order_and_increment RPC     ← MODIFY: sync allocated_bottles
```

### References

- [Source: _bmad-output/planning-artifacts/epics-stories.md#Story 4.2: Real-Time Inventory Sync]
- [Source: _bmad-output/planning-artifacts/epics-stories.md#Epic 4: Smart Marketplace]
- [Source: _bmad-output/planning-artifacts/prd.md#4.3. Smart Marketplace] — Inventory Sync (FR7)
- [Source: _bmad-output/planning-artifacts/Epic4/story_4.1.md] — `virtual_pallets` pricing fields, `BuyerPalletCard` extension pattern, `PalletPricingBadge` placement in cards
- [Source: _bmad-output/planning-artifacts/Epic3/story_3.4.md] — `add_order_and_increment` RPC to extend
- [Source: _bmad-output/planning-artifacts/Epic3/story_3.2.md] — Realtime channel subscription pattern, cleanup pattern
- [Source: _bmad-output/planning-artifacts/Epic3/story_3.1.md] — `virtual_pallets` schema, `winery_profiles` schema, `BuyerPalletCard`
- [Source: winepooler/src/pages/dashboards/BuyerDashboard.tsx] — existing card markup, Realtime pattern to extend
- [Source: winepooler/src/pages/dashboards/WineryDashboard.tsx] — static picking list to replace, stone-* styling

## Dev Agent Record

### Agent Model Used

Claude Opus 4.6

### Debug Log References

None

### Completion Notes List

- Created `wine_inventory` table with RLS policies, unique constraint on `(winery_id, sku)`, and Realtime publication. Seeded 3 inventory rows matched to existing mock wineries.
- Added `inventory_id` FK column to `virtual_pallets` (nullable). Linked existing open pallets to their winery’s inventory in the migration seed.
- Extended `add_order_and_increment` RPC (new migration) to also increment `wine_inventory.allocated_bottles` when the pallet has linked inventory — keeps the entire operation atomic.
- `available_stock` is computed client-side (`total_stock - allocated_bottles`) rather than as a generated column, per Dev Notes recommendation.
- `getPalletsByArea` now joins `wine_inventory(total_stock, allocated_bottles)` and maps `inventory_id`, `available_stock`, `total_stock`, `allocated_bottles` into `VirtualPallet`.
- `InventoryStatusBadge` component: Out of Stock (red), Low Stock (≥50% allocated, amber), sync error (italic muted), or available count (neutral).
- BuyerDashboard: integrated `InventoryStatusBadge` in both Grid and Map view cards. “Add Order” button disabled when `availableStock <= 0`. Added second Realtime channel for `wine_inventory` UPDATE events with CHANNEL_ERROR handling.
- WineryDashboard: replaced static `pickingLists` array with live data from `getWineryPickingList`. Added “Allocated / Total” column. Loading and empty states added.
- `getInventoryForArea` was dropped in favor of the simpler join approach via `getPalletsByArea` — avoids an extra network call and keeps the data co-located with pallet cards.
- 6 unit tests for `InventoryStatusBadge` covering all status conditions. Updated `getPalletsByArea` test with inventory field assertions.

### Change Log

- 2026-04-03: Story 4.2 implemented — wine_inventory table, inventory Realtime sync, InventoryStatusBadge, WineryDashboard live picking list, extended RPC

### File List

- `winepooler/supabase/migrations/20260403004000_create_wine_inventory.sql` (NEW)
- `winepooler/supabase/migrations/20260403005000_extend_rpc_inventory_sync.sql` (NEW)
- `winepooler/src/lib/supabase/queries/wineInventory.ts` (NEW)
- `winepooler/src/components/pallets/InventoryStatusBadge.tsx` (NEW)
- `winepooler/src/components/pallets/__tests__/InventoryStatusBadge.test.tsx` (NEW)
- `winepooler/src/lib/supabase/queries/virtualPallets.ts` (MODIFIED)
- `winepooler/src/lib/supabase/queries/__tests__/virtualPallets.test.ts` (MODIFIED)
- `winepooler/src/pages/dashboards/BuyerDashboard.tsx` (MODIFIED)
- `winepooler/src/pages/dashboards/WineryDashboard.tsx` (MODIFIED)
