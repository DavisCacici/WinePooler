# Story 4.1: Display Dynamic Pricing

Status: review

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a Buyer,
I want to see both bulk and retail prices for wines,
so that I can understand the value of pooling.

## Acceptance Criteria

1. Given I am viewing a pallet card on the Buyer Dashboard
   When the card renders
   Then both the Bulk Price (per bottle) and the Retail Market Price (per bottle) are displayed
   And the Bulk Price is visually highlighted as the active/lower price

2. Given the Bulk Price is lower than the Retail Market Price
   When I view the pricing section
   Then the difference (absolute or percentage saving) is shown alongside the prices
   And the saving is styled to draw attention (e.g. green badge)

3. Given a winery has set a bulk price but no retail reference price
   When the pallet card renders
   Then only the Bulk Price is shown
   And no saving badge or retail price line appears

4. Given I am on the Buyer Dashboard in Grid View
   When I scan the pallet cards
   Then each card shows the pricing inline without requiring a modal or hover

5. Given I am on the Buyer Dashboard in Map View
   When I view the mini pallet cards in the map section
   Then pricing is shown in a compact single-line format
   And the full pricing detail is available on hover or in a separate detail view

## Tasks / Subtasks

- [x] Add pricing columns to `virtual_pallets` table in Supabase (AC: 1, 2, 3)
  - [x] `ALTER TABLE public.virtual_pallets ADD COLUMN bulk_price_per_bottle numeric(10,2) CHECK (bulk_price_per_bottle > 0);`
  - [x] `ALTER TABLE public.virtual_pallets ADD COLUMN retail_price_per_bottle numeric(10,2) CHECK (retail_price_per_bottle > 0);`
  - [x] Both columns nullable (pricing may be set after pallet creation)
  - [x] Update seed/mock data: set `bulk_price_per_bottle = 8.50` and `retail_price_per_bottle = 14.00` for the existing dev pallets
- [x] Update `getPalletsByArea` query to include pricing fields (AC: 1)
  - [x] Add `bulk_price_per_bottle`, `retail_price_per_bottle` to the `.select(...)` in `virtualPallets.ts`
  - [x] Extend `VirtualPallet` interface with `bulk_price_per_bottle: number | null` and `retail_price_per_bottle: number | null`
- [x] Extend `BuyerPalletCard` interface with pricing (AC: 1, 2, 3)
  - [x] Add `bulkPrice: number | null` and `retailPrice: number | null` to `BuyerPalletCard` in `BuyerDashboard.tsx`
  - [x] Update the mapping from `getPalletsByArea` rows to populate these fields
- [x] Build `PalletPricingBadge` component (AC: 1, 2, 3)
  - [x] Create `src/components/pallets/PalletPricingBadge.tsx`
  - [x] Props: `bulkPrice: number | null`, `retailPrice: number | null`
  - [x] If both prices present: show bulk price highlighted + retail price struck-through + saving badge
  - [x] If only bulk price: show bulk price highlighted, no retail line
  - [x] If neither price: show "Price TBD" in muted text
  - [x] Saving calculation: `Math.round((1 - bulkPrice / retailPrice) * 100)` → display as "-XX%"
- [x] Integrate `PalletPricingBadge` into Grid View card (AC: 1, 4)
  - [x] Add inline pricing block below the progress bar in each Grid View `<article>` in `BuyerDashboard.tsx`
- [x] Integrate `PalletPricingBadge` into Map View card — compact mode (AC: 5)
  - [x] Add a compact single-line price chip below the winery name in each Map View `<article>`
  - [x] Show only bulk price in map cards; full `PalletPricingBadge` on a hover tooltip or in the future detail panel
- [x] Allow winery to set pricing when creating a pallet (AC: 1)
  - [x] Add optional `bulk_price_per_bottle` and `retail_price_per_bottle` fields to `CreatePalletModal.tsx`
  - [x] Pass them into `createVirtualPallet` payload
  - [x] Update `createVirtualPallet` function in `virtualPallets.ts` to accept and forward these fields
- [x] Write unit tests (AC: 1, 2, 3, 4)
  - [x] Test `PalletPricingBadge`: renders both prices + saving when both present
  - [x] Test `PalletPricingBadge`: renders only bulk price when retail is null
  - [x] Test `PalletPricingBadge`: renders "Price TBD" when both null
  - [x] Test saving percentage calculation: 8.50 bulk, 14.00 retail → 39% saving
  - [x] Test `getPalletsByArea` mapping includes pricing fields in returned `BuyerPalletCard`

## Dev Notes

### Architecture & Technical Context

- **Stack**: React.js + TypeScript, Tailwind CSS, Supabase (PostgreSQL), Vercel
- **Auth**: `useAuth()` → `user`; buyer's `areaId` drives the pallet query (Stories 2.2, 3.1)
- **`virtual_pallets` table**: created in Story 3.1. This story adds two nullable numeric columns — use `ALTER TABLE`, do not recreate the table
- **`VirtualPallet` interface** lives in `src/lib/supabase/queries/virtualPallets.ts`. Extend it in place; do not create a separate type file
- **`BuyerPalletCard` interface** is defined inside `BuyerDashboard.tsx`. Adding `bulkPrice` and `retailPrice` fields must not break the existing card markup — both are nullable, so cards that have no pricing simply show "Price TBD"
- **`createVirtualPallet` payload** currently accepts `{ area_id, winery_id, created_by }`. Extend with optional pricing fields without breaking the Story 3.1 call site (default to `null` if not provided)
- **No winery-side pricing UI beyond `CreatePalletModal`** in this story — the Winery Portal currently shows static analytics (Story 1.3 / `WineryDashboard.tsx`). Full winery pricing management is out of scope here
- **Styling conventions** (established Stories 1.3 → 3.x):
  - Buyer Dashboard: `text-emerald-700` accents, `bg-slate-50` cards, `ring-1 ring-slate-200`
  - Price highlight color: `text-emerald-700 font-semibold` for bulk price
  - Retail price: `text-slate-400 line-through text-sm`
  - Saving badge: `bg-emerald-100 text-emerald-800 rounded-full px-2 py-0.5 text-xs font-medium`

### Supabase Schema Change

```sql
-- Extend virtual_pallets with pricing columns (Story 3.1 table)
ALTER TABLE public.virtual_pallets
  ADD COLUMN bulk_price_per_bottle   numeric(10,2) CHECK (bulk_price_per_bottle > 0),
  ADD COLUMN retail_price_per_bottle numeric(10,2) CHECK (retail_price_per_bottle > 0);

-- Update dev seed pallets with example pricing
UPDATE public.virtual_pallets
SET
  bulk_price_per_bottle   = 8.50,
  retail_price_per_bottle = 14.00
WHERE state = 'open';
```

### Updated `VirtualPallet` Interface

```typescript
// Extend in src/lib/supabase/queries/virtualPallets.ts
export interface VirtualPallet {
  id: string
  area_id: string
  winery_id: string
  state: 'open' | 'frozen' | 'completed'
  bottle_count: number
  threshold: number
  created_by: string
  bulk_price_per_bottle: number | null    // ← NEW
  retail_price_per_bottle: number | null  // ← NEW
  // joined
  area_name?: string
  winery_name?: string
}
```

### Updated `getPalletsByArea` Select

```typescript
// Add pricing fields to the select string:
const { data, error } = await supabase
  .from('virtual_pallets')
  .select(`
    id, area_id, winery_id, state, bottle_count, threshold, created_by,
    bulk_price_per_bottle, retail_price_per_bottle,
    macro_areas(name),
    winery_profiles(company_name)
  `)
  .eq('area_id', areaId)
  .order('created_at', { ascending: false })
```

### Updated `BuyerPalletCard` Interface and Mapping

```typescript
// Inside BuyerDashboard.tsx — extend the interface:
interface BuyerPalletCard {
  id: string
  palletId: string
  area: string
  winery: string
  progress: string
  bottles: number
  state: 'open' | 'frozen' | 'completed'
  bulkPrice: number | null    // ← NEW
  retailPrice: number | null  // ← NEW
}

// In the mapping lambda (getPalletsByArea rows → BuyerPalletCard):
{
  id: r.id,
  palletId: r.id,
  area: r.area_name ?? '',
  winery: r.winery_name ?? '',
  progress: palletProgressLabel(r.bottle_count, r.threshold),
  bottles: r.bottle_count,
  state: r.state,
  bulkPrice: r.bulk_price_per_bottle,
  retailPrice: r.retail_price_per_bottle,
}
```

### `PalletPricingBadge` Component

```tsx
// src/components/pallets/PalletPricingBadge.tsx  (NEW)
interface PalletPricingBadgeProps {
  bulkPrice: number | null
  retailPrice: number | null
  compact?: boolean   // true = map view chip; false (default) = full grid view block
}

const formatEur = (n: number) =>
  new Intl.NumberFormat('it-IT', { style: 'currency', currency: 'EUR' }).format(n)

const PalletPricingBadge = ({ bulkPrice, retailPrice, compact = false }: PalletPricingBadgeProps) => {
  if (!bulkPrice) {
    return compact ? null : (
      <p className="text-xs text-slate-400">Price TBD</p>
    )
  }

  const savingPct = retailPrice && retailPrice > bulkPrice
    ? Math.round((1 - bulkPrice / retailPrice) * 100)
    : null

  if (compact) {
    return (
      <p className="mt-1 text-xs font-semibold text-emerald-700">
        {formatEur(bulkPrice)}/bottle
      </p>
    )
  }

  return (
    <div className="mt-3 space-y-1">
      <div className="flex items-center gap-2">
        <span className="text-sm font-semibold text-emerald-700">{formatEur(bulkPrice)}</span>
        <span className="text-xs text-slate-500">bulk / bottle</span>
        {savingPct && (
          <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-medium text-emerald-800">
            -{savingPct}%
          </span>
        )}
      </div>
      {retailPrice && (
        <p className="text-xs text-slate-400 line-through">
          Retail {formatEur(retailPrice)}/bottle
        </p>
      )}
    </div>
  )
}

export default PalletPricingBadge
```

### Grid View Card Integration

Inside the existing `<article>` for each Grid View pallet (after the progress bar):
```tsx
<PalletPricingBadge bulkPrice={pallet.bulkPrice} retailPrice={pallet.retailPrice} />
```

### Map View Card Integration (compact chip)

Inside each Map View `<article>` (after the winery name `<p>`):
```tsx
<PalletPricingBadge bulkPrice={pallet.bulkPrice} retailPrice={pallet.retailPrice} compact />
```

### Updated `createVirtualPallet` Payload

```typescript
// Extend the function signature in virtualPallets.ts:
export const createVirtualPallet = async (payload: {
  area_id: string
  winery_id: string
  created_by: string
  bulk_price_per_bottle?: number | null
  retail_price_per_bottle?: number | null
}): Promise<VirtualPallet> => { /* unchanged body */ }
```

In `CreatePalletModal.tsx`, add two optional number inputs for pricing and pass them through to `createVirtualPallet`. Both fields are optional; the modal submits successfully if they are left blank.

### Regression Risk

- **`BuyerPalletCard` extension**: adding `bulkPrice` and `retailPrice` is additive. Existing card markup does not reference these fields — no existing lines break. Only the new `<PalletPricingBadge>` uses them.
- **`getPalletsByArea` select string**: adding fields to an existing Supabase `.select()` is non-breaking. The mapping lambda is the only consumer; update both in the same commit.
- **`createVirtualPallet` payload**: the new pricing fields use `?` (optional) — all existing call sites (Story 3.1's `CreatePalletModal`) continue to work without modification.
- **`add_order_and_increment` RPC** (Story 3.4): does not touch pricing columns — no change needed.
- **`Intl.NumberFormat` locale**: using `'it-IT'` formats currency as `8,50 €`. If the project targets multiple locales, pass the browser locale instead. For now Italian formatting is appropriate given the target market (wineries in Italy).

### Project Structure Notes

```
src/
├── components/
│   ├── notifications/
│   │   └── FreezeNotification.tsx      ← do not modify (Story 3.3)
│   └── pallets/
│       └── PalletPricingBadge.tsx      ← NEW
├── lib/
│   └── supabase/
│       └── queries/
│           └── virtualPallets.ts       ← MODIFY: add pricing fields to VirtualPallet interface,
│                                           getPalletsByArea select, createVirtualPallet payload
├── pages/
│   ├── dashboards/
│   │   └── BuyerDashboard.tsx         ← MODIFY: BuyerPalletCard pricing fields, card markup
│   └── pallets/
│       └── CreatePalletModal.tsx       ← MODIFY: add optional pricing inputs
```

### References

- [Source: _bmad-output/planning-artifacts/epics-stories.md#Story 4.1: Display Dynamic Pricing]
- [Source: _bmad-output/planning-artifacts/epics-stories.md#Epic 4: Smart Marketplace]
- [Source: _bmad-output/planning-artifacts/prd.md#4.3. Smart Marketplace] — Dynamic Pricing (FR6)
- [Source: _bmad-output/planning-artifacts/Epic3/story_3.1.md] — `virtual_pallets` schema, `VirtualPallet` interface, `createVirtualPallet`, `BuyerPalletCard`
- [Source: _bmad-output/planning-artifacts/Epic3/story_3.4.md] — `add_order_and_increment` RPC (does not touch pricing)
- [Source: winepooler/src/pages/dashboards/BuyerDashboard.tsx] — current Map View and Grid View card markup
- [Source: winepooler/src/pages/dashboards/WineryDashboard.tsx] — styling reference (`stone-*` palette for winery; `slate-*` + `emerald-*` for buyer)
- [Source: winepooler/src/lib/supabase/client.ts] — Supabase client import

## Dev Agent Record

### Agent Model Used

Claude Opus 4.6

### Debug Log References

None

### Completion Notes List

- Added two nullable `numeric(10,2)` pricing columns to `virtual_pallets` via migration. Both have `CHECK > 0` constraints.
- Extended `VirtualPallet` interface with `bulk_price_per_bottle` and `retail_price_per_bottle` (both `number | null`).
- Updated `getPalletsByArea` select string and mapping to include pricing fields.
- Extended `createVirtualPallet` payload with optional pricing fields — backward compatible with existing call sites.
- Built `PalletPricingBadge` component with two modes: full (grid view) with saving badge + strikethrough retail, and compact (map view) showing only bulk price per bottle.
- Currency formatting uses `Intl.NumberFormat('it-IT')` for Italian locale (target market).
- Saving percentage: `Math.round((1 - bulk/retail) * 100)` — only shown when retail > bulk.
- Integrated pricing into both Grid View (below progress bar) and Map View (compact chip below winery name) in BuyerDashboard.
- Added pricing input fields (optional) to CreatePalletModal — both number inputs with step 0.01.
- 7 unit tests for PalletPricingBadge covering all rendering scenarios.
- Updated `getPalletsByArea` test to verify pricing fields are mapped.
- No regressions: `BuyerPalletCard` extension is additive, existing test mocks use module-level mocking that bypasses strict typing.

### Change Log

- 2026-04-03: Story 4.1 implemented — pricing columns, PalletPricingBadge, dashboard integration, CreatePalletModal pricing inputs + tests

### File List

- `winepooler/supabase/migrations/20260403003000_add_pricing_columns.sql` (NEW)
- `winepooler/src/components/pallets/PalletPricingBadge.tsx` (NEW)
- `winepooler/src/components/pallets/__tests__/PalletPricingBadge.test.tsx` (NEW)
- `winepooler/src/lib/supabase/queries/virtualPallets.ts` (MODIFIED)
- `winepooler/src/lib/supabase/queries/__tests__/virtualPallets.test.ts` (MODIFIED)
- `winepooler/src/pages/dashboards/BuyerDashboard.tsx` (MODIFIED)
- `winepooler/src/pages/pallets/CreatePalletModal.tsx` (MODIFIED)
