# Story 8.3: Per-Unit Dynamic Pricing

Status: ready-for-dev

## Story

As a buyer,
I want to see bulk and retail prices per selling unit,
so that I can compare value across unit types.

## Acceptance Criteria

1. Pallet cards in the BuyerDashboard display prices for each enabled selling unit type (e.g., "€8.50/bottle · €51.00/case · €3,060/pallet").
2. Case price = bottle price × bottles_per_case (with optional case discount percentage).
3. Pallet price = unit price × pallet quantity (with optional pallet discount percentage).
4. The `PalletPricingBadge` component is updated to render multi-unit pricing when selling unit data is available.
5. Retail price comparison (strikethrough + savings badge) works for each unit type.
6. If no selling units are configured for the product, the component falls back to current per-bottle pricing display.
7. The Winery Portal pricing section (in CreatePalletModal or future winery product management) allows setting optional case_discount_pct and pallet_discount_pct.
8. Unit tests verify multi-unit price rendering, discount calculations, and fallback behavior.

## Tasks / Subtasks

- [ ] Task 1: DB migration — add discount columns to selling_units (AC: #2, #3, #7)
  - [ ] Create migration `20260409006000_add_discount_columns_to_selling_units.sql`
  - [ ] `ALTER TABLE public.selling_units ADD COLUMN discount_pct numeric(5,2) DEFAULT 0 CHECK (discount_pct >= 0 AND discount_pct <= 100)`
  - [ ] This allows each selling unit to have its own discount (e.g., case: 5% off, pallet: 15% off)
- [ ] Task 2: Create price computation helper (AC: #2, #3)
  - [ ] In `sellingUnits.ts`, add:
    ```typescript
    export interface UnitPrice {
      unitType: string
      unitLabel: string
      bulkPrice: number       // per-unit bulk price after discounts
      retailPrice: number | null  // per-unit retail price (no discount)
      savingPct: number | null    // savings vs retail
      bottleEquivalent: number    // bottles in one unit
    }
    
    export const computeUnitPrices = (
      bulkPricePerBottle: number,
      retailPricePerBottle: number | null,
      sellingUnits: SellingUnit[]
    ): UnitPrice[]
    ```
  - [ ] For bottle: `{ bulkPrice: bulkPricePerBottle, retailPrice: retailPricePerBottle, ... }`
  - [ ] For case: `bulkPrice = bulkPricePerBottle × bottles_per_case × (1 - discount_pct/100)`
  - [ ] For pallet: compute bottle equivalent, then `bulkPrice = bulkPricePerBottle × bottleEquivalent × (1 - discount_pct/100)`
  - [ ] Retail price per unit = retailPricePerBottle × bottleEquivalent (no discount on retail — discount only on bulk)
  - [ ] savingPct = Math.round((1 - bulkPrice / retailPrice) * 100) when retailPrice available
- [ ] Task 3: Update PalletPricingBadge for multi-unit display (AC: #1, #4, #5, #6)
  - [ ] Add optional `unitPrices: UnitPrice[]` prop to `PalletPricingBadge`
  - [ ] When `unitPrices` is provided and has >1 entry, render a multi-line pricing display:
    ```
    €8.50/bottle
    €48.45/case (6 bottles) -5%
    €2,601/pallet (60 cases) -15%
    ```
  - [ ] Each line shows: bulk price, unit label, discount badge if discount > 0
  - [ ] Retail comparison with strikethrough on each line (if retail price available)
  - [ ] When `unitPrices` is not provided, fall back to existing per-bottle display (backward compatible)
  - [ ] `compact` mode: show only the primary unit price (first in list)
- [ ] Task 4: Wire unit prices into BuyerDashboard pallet cards (AC: #1)
  - [ ] When loading pallets via `getPalletsByArea`, also fetch selling units for each pallet's winery
  - [ ] Compute `UnitPrice[]` using `computeUnitPrices` for each pallet
  - [ ] Pass `unitPrices` to `PalletPricingBadge`
  - [ ] Optimize: batch-fetch selling units per winery (not per pallet) since multiple pallets may share a winery
- [ ] Task 5: Update SellingUnit query module with discount field (AC: #7)
  - [ ] Update `SellingUnit` interface to include `discount_pct: number`
  - [ ] Ensure `getSellingUnitsByWinery` returns the new field
  - [ ] Update `SellingUnitConfig.tsx` (Story 7.2 component) to show an optional discount percentage input per unit type
- [ ] Task 6: Unit tests (AC: #8)
  - [ ] Test `computeUnitPrices` with bottle-only, case+bottle, all three units
  - [ ] Test discount calculations (0%, 5%, 15%)
  - [ ] Test `PalletPricingBadge` with unitPrices prop (multi-unit mode)
  - [ ] Test `PalletPricingBadge` without unitPrices (fallback mode)
  - [ ] Test savings percentage calculation accuracy

## Dev Notes

### PalletPricingBadge Current Implementation

The component currently accepts `bulkPrice`, `retailPrice` (both per bottle), and an optional `compact` flag. It renders:
- Bulk price with `/bottle` label
- Savings percentage badge (if retail > bulk)
- Retail strikethrough line

The update keeps this as the fallback and adds a multi-unit mode activated by the `unitPrices` prop.

### Pricing Component Design

Multi-unit display (not compact):
```
┌──────────────────────────────────┐
│ €8.50 bulk / bottle              │
│ ├ €48.45 / case (6)      -5%    │
│ └ €2,601 / pallet (360)  -15%   │
│ Retail €14.00/bottle ──────      │
└──────────────────────────────────┘
```

Design tokens to match existing PalletPricingBadge:
- Bulk price: `text-sm font-semibold text-emerald-700`
- Unit label: `text-xs text-slate-500`
- Discount badge: `rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-800`
- Savings badge: `rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-medium text-emerald-800`
- Retail strikethrough: `text-xs text-slate-400 line-through`

### EUR Formatting

Use the existing `formatEur` function from `PalletPricingBadge.tsx`:
```typescript
const formatEur = (n: number) =>
  new Intl.NumberFormat('it-IT', { style: 'currency', currency: 'EUR' }).format(n)
```

### Performance Optimization for BuyerDashboard

Fetching selling units per winery per pallet would be N+1. Instead:
1. After `getPalletsByArea`, collect unique `winery_id` values
2. Batch-fetch selling units for all unique wineries: `Promise.all(wineryIds.map(getSellingUnitsByWinery))`
3. Build a `Map<wineryId, SellingUnit[]>` for O(1) lookup per pallet
4. Compute unit prices per pallet using the map

### Discount Storage Design

Discount is stored per selling unit (not per product). This means:
- "All cases get 5% off" — the case selling unit has discount_pct=5
- "All pallets get 15% off" — the pallet selling unit has discount_pct=15

This is simpler than per-product-per-unit discounts (which would require a column on `product_selling_units`). If per-product discounts are needed later, it can be added as a future enhancement.

### Project Structure Notes

- New migration: `winepooler/supabase/migrations/20260409006000_add_discount_columns_to_selling_units.sql`
- Modified: `winepooler/src/lib/supabase/queries/sellingUnits.ts` (add `computeUnitPrices`, `UnitPrice` interface, update `SellingUnit` interface)
- Modified: `winepooler/src/components/pallets/PalletPricingBadge.tsx` (multi-unit pricing display)
- Modified: `winepooler/src/pages/dashboards/BuyerDashboard.tsx` (fetch selling units, compute prices, pass to badge)
- Modified: `winepooler/src/pages/winery/SellingUnitConfig.tsx` (add discount input)
- Modified tests: `PalletPricingBadge.test.tsx`, new `sellingUnits` price computation tests

### Anti-Patterns to Avoid

- Do NOT change the payment amount calculation — escrow is always based on raw bottle equivalent × bulk_price_per_bottle. Discounts apply to display pricing only. **Wait** — discounts should affect the actual payment too. Clarification: the discount changes the effective price the buyer pays. So the escrow amount must be based on the discounted unit price. This means the Edge Function `create-escrow-payment-intent` needs to be aware of the selected unit and its discount.
- **CORRECTION**: For Story 8.3, the discount is a display-layer computation that also affects the payment amount. However, changing the Edge Function is complex. **Simplest approach**: compute the discounted `effectivePricePerBottle` on the client, pass it to the Edge Function as a new param, and let the Edge Function validate it against the DB. **OR** store the discount result as the actual `bulk_price_per_bottle` on the pallet. This is a design decision to confirm with the user.
- **Recommended for MVP**: Discounts are informational/display-only in this story. The `bulk_price_per_bottle` on the pallet IS the effective bottle price. Case/pallet prices are simple multiples. Discount percentages are shown as marketing badges ("Save 5% ordering by the case!") but the actual bulk_price is already the discounted rate set by the winery. This avoids Edge Function changes entirely.
- Do NOT create separate pricing tables — use the existing `bulk_price_per_bottle` as the base
- Do NOT modify the order flow — Story 8.2 handles that

### Dependencies

- **Requires Epic 7 completed**: needs selling unit data with discount field
- **Requires Story 8.1 completed**: needs updated VirtualPallet interface
- **Requires Story 8.2 completed**: order flow uses selling units (this story only changes display)
- Uses existing `PalletPricingBadge.tsx`, `BuyerDashboard.tsx`

### References

- [Source: src/components/pallets/PalletPricingBadge.tsx] — Current pricing badge implementation
- [Source: src/pages/dashboards/BuyerDashboard.tsx] — Pallet card rendering and data flow
- [Source: src/lib/supabase/queries/sellingUnits.ts] — Selling unit data (from Epic 7)
- [Source: _bmad-output/planning-artifacts/prd.md#4.3] — Dynamic Pricing per selling unit requirement

## Dev Agent Record

### Agent Model Used

### Debug Log References

### Completion Notes List

### File List
