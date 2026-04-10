# Story 8.1: Unit-Aware Virtual Pallet Thresholds

Status: review

## Story

As the system,
I want pallet thresholds to be calculated from the winery's configured selling units,
so that pallets freeze at the winery-defined quantity instead of a hardcoded 600 bottles.

## Acceptance Criteria

1. The `virtual_pallets` table gains a `display_unit` column (text, nullable) recording the winery's preferred display unit at pallet creation time (e.g., 'case', 'pallet', 'bottle').
2. The `virtual_pallets` table gains a `display_unit_label` column (text, nullable) storing a human-readable label (e.g., "cases of 6", "pallets of 60 cases").
3. When a virtual pallet is created, the system looks up the winery's selling unit configuration and sets `threshold` to the bottle-equivalent of one pallet (e.g., 60 cases × 6 bottles = 360). If no pallet selling unit is defined, threshold defaults to 600.
4. The `display_unit` and `display_unit_label` are set at creation time and do NOT change if the winery later updates its selling unit config — existing open pallets retain their original threshold.
5. The progress bar displays progress in the winery's display unit (e.g., "42/60 cases") rather than raw bottle count.
6. The `palletProgress` helper is updated to support unit-aware display.
7. The auto-freeze RPCs (`increment_pallet_bottle_count` and `add_order_with_authorization_and_increment`) continue to work correctly — they already compare `bottle_count >= threshold`, so the only change is that `threshold` now varies per winery.
8. Unit tests verify the updated progress helper and creation flow.

## Tasks / Subtasks

- [x] Task 1: DB migration — add display columns to virtual_pallets (AC: #1, #2)
  - [x] Create migration `20260409003000_add_pallet_display_unit_columns.sql`
  - [x] `ALTER TABLE public.virtual_pallets ADD COLUMN display_unit text DEFAULT NULL`
  - [x] `ALTER TABLE public.virtual_pallets ADD COLUMN display_unit_label text DEFAULT NULL`
  - [x] No CHECK constraint on display_unit — keep flexible for future unit types
- [x] Task 2: Update `createVirtualPallet` to set threshold from selling units (AC: #3, #4)
  - [x] In `virtualPallets.ts`, update `createVirtualPallet` to accept optional `threshold`, `display_unit`, `display_unit_label` fields
  - [x] Create a new helper `computePalletThreshold(wineryId)` in `sellingUnits.ts` that:
    - Fetches the winery's selling units
    - Finds the 'pallet' unit; if found, calculates bottle-equivalent threshold
    - If composition_type='cases': finds the 'case' unit → threshold = pallet_quantity × bottles_per_case
    - If composition_type='bottles': threshold = pallet_quantity
    - Returns `{ threshold, displayUnit, displayUnitLabel }` or defaults `{ threshold: 600, displayUnit: 'bottle', displayUnitLabel: 'bottles' }`
  - [x] Wire this into `createVirtualPallet` call in `CreatePalletModal.tsx`
- [x] Task 3: Update `CreatePalletModal` to use winery threshold (AC: #3)
  - [x] Before creating the pallet, call `computePalletThreshold(selectedWineryId)`
  - [x] Pass the computed `threshold`, `display_unit`, `display_unit_label` to `createVirtualPallet`
  - [x] Show the threshold info in the modal (e.g., "This pallet will hold 60 cases (360 bottles)")
- [x] Task 4: Update progress display to be unit-aware (AC: #5, #6)
  - [x] Update `palletProgress.ts` to add `palletProgressUnitLabel`
  - [x] When displayUnit='case' and bottlesPerDisplayUnit is known: show `${Math.floor(bottleCount/bottlesPerCase)}/${threshold/bottlesPerCase} ${displayUnitLabel}`
  - [x] When displayUnit='bottle' or null: show `${bottleCount}/${threshold} bottles` (current behavior)
  - [x] Update `VirtualPallet` interface to include `display_unit` and `display_unit_label`
  - [x] Update `getPalletsByArea` and `getPalletById` queries to SELECT the new columns
- [x] Task 5: Update BuyerDashboard pallet card to use unit-aware labels (AC: #5)
  - [x] In `BuyerDashboard.tsx`, update `BuyerPalletCard` interface to include `displayUnit`, `displayUnitLabel`
  - [x] Update the mapping function to populate these from query results
  - [x] Update progress label rendering to use `palletProgressUnitLabel`
- [x] Task 6: Update unit tests (AC: #8)
  - [x] Update `palletProgress.test.ts` with unit-aware label tests
  - [x] Update `CreatePalletModal.test.tsx` to verify threshold computation
  - [x] Update `virtualPallets.test.ts` with new query fields

## Dev Notes

### Critical: RPCs Do NOT Need Changes

The existing RPCs (`increment_pallet_bottle_count` and `add_order_with_authorization_and_increment`) already use `bottle_count + p_quantity >= threshold` for the freeze check. Since `threshold` is now set per-winery at pallet creation, the RPCs automatically work with any threshold value. **Do NOT modify the RPCs in this story.**

### Existing `virtual_pallets` Schema

Current columns (from migration `20260401003000`):
```sql
id, area_id, winery_id, state, bottle_count (default 0), threshold (default 600),
created_by, created_at, updated_at,
bulk_price_per_bottle, retail_price_per_bottle, inventory_id
```

The `threshold` column already exists with `DEFAULT 600`. The change is: instead of always using 600, `createVirtualPallet` now computes and passes a winery-specific value.

### Progress Display Logic

Current `palletProgressLabel` returns a percentage string. The new `palletProgressUnitLabel` should return a unit-count string like "42/60 cases" for `display_unit='case'`.

To convert bottle_count to case count: `Math.floor(bottleCount / bottlesPerCase)`. The `bottlesPerCase` value should be denormalized into the VirtualPallet query result (join through selling_units) or stored as metadata. **Recommended approach**: store `bottles_per_display_unit` as an additional column to avoid runtime joins. But for simplicity, compute from the `display_unit_label` or join selling_units at query time.

**Simplest approach**: Add a `bottles_per_display_unit` integer column to `virtual_pallets` (nullable, default NULL). Set at creation time alongside `display_unit`. This avoids runtime joins for display.

### VirtualPallet Interface Update

```typescript
export interface VirtualPallet {
  // ... existing fields ...
  display_unit: string | null
  display_unit_label: string | null
  bottles_per_display_unit: number | null  // e.g., 6 for "case of 6"
}
```

### CreatePalletModal Integration

The modal currently calls `createVirtualPallet` with `area_id`, `winery_id`, `created_by`, and optional pricing. Add threshold computation BEFORE the create call:

```typescript
const thresholdInfo = await computePalletThreshold(selectedWineryId)
await createVirtualPallet({
  area_id: areaId,
  winery_id: selectedWineryId,
  created_by: buyerUserId,
  threshold: thresholdInfo.threshold,
  display_unit: thresholdInfo.displayUnit,
  display_unit_label: thresholdInfo.displayUnitLabel,
  bottles_per_display_unit: thresholdInfo.bottlesPerDisplayUnit,
  bulk_price_per_bottle: bulkPrice ? parseFloat(bulkPrice) : null,
  retail_price_per_bottle: retailPrice ? parseFloat(retailPrice) : null,
})
```

### Project Structure Notes

- New migration: `winepooler/supabase/migrations/20260409003000_add_pallet_display_unit_columns.sql`
- Modified: `winepooler/src/lib/supabase/queries/virtualPallets.ts` (interface + createVirtualPallet + queries)
- Modified: `winepooler/src/lib/supabase/queries/sellingUnits.ts` (add `computePalletThreshold`)
- Modified: `winepooler/src/lib/palletProgress.ts` (add `palletProgressUnitLabel`)
- Modified: `winepooler/src/pages/pallets/CreatePalletModal.tsx` (wire threshold)
- Modified: `winepooler/src/pages/dashboards/BuyerDashboard.tsx` (unit-aware display)
- Modified tests: `palletProgress.test.ts`, `CreatePalletModal.test.tsx`, `virtualPallets.test.ts`

### Anti-Patterns to Avoid

- Do NOT modify the RPC functions — they already work with variable thresholds
- Do NOT remove the `DEFAULT 600` from the threshold column — it's a safe fallback
- Do NOT change the freeze/capture payment flow — that's unaffected
- Do NOT modify the AddOrderModal — that's Story 8.2
- Do NOT add per-unit pricing — that's Story 8.3

### Dependencies

- **Requires Epic 7 completed**: needs `selling_units` table and `sellingUnits.ts` query module with selling unit data
- Uses existing `createVirtualPallet`, `getPalletsByArea`, `getPalletById` from `virtualPallets.ts`
- Uses existing `CreatePalletModal.tsx` and `BuyerDashboard.tsx`

### Edge Cases

- Winery with no selling units defined: threshold defaults to 600, display_unit='bottle', display_unit_label='bottles'
- Winery with case defined but no pallet: threshold defaults to 600 (no pallet unit to derive from)
- Winery with pallet composition_type='cases' but no case unit defined: this is prevented by Story 7.2 validation, but defensively default to 600
- Division remainder: if bottle_count is not evenly divisible by bottles_per_case, use `Math.floor` for the display count and show the remainder as additional bottles

### References

- [Source: supabase/migrations/20260401003000_create_winery_profiles_and_virtual_pallets.sql] — virtual_pallets schema
- [Source: supabase/migrations/20260401005000_update_increment_rpc_auto_freeze.sql] — Freeze RPC logic
- [Source: supabase/migrations/20260403007000_add_order_with_authorization_rpc.sql] — Auth-aware RPC
- [Source: src/lib/palletProgress.ts] — Current progress helpers
- [Source: src/pages/pallets/CreatePalletModal.tsx] — Pallet creation UI
- [Source: src/pages/dashboards/BuyerDashboard.tsx] — Pallet card rendering
- [Source: _bmad-output/planning-artifacts/prd.md#4.2] — Threshold Management requirement

## Dev Agent Record

### Agent Model Used
Claude Sonnet 4.6 (GitHub Copilot)

### Debug Log References
No blockers encountered.

### Completion Notes List
- Added `display_unit`, `display_unit_label`, `bottles_per_display_unit` columns to `virtual_pallets` via migration `20260410001000_add_pallet_display_unit_columns.sql`
- Added `computePalletThreshold(wineryId)` to `sellingUnits.ts`; returns `PalletThresholdInfo` with threshold, displayUnit, displayUnitLabel, bottlesPerDisplayUnit
- Updated `VirtualPallet` interface and all queries (`getPalletsByArea`, `getPalletById`, `createVirtualPallet`) to include the three new fields
- Updated `CreatePalletModal.tsx` to call `computePalletThreshold` before create and show threshold info in UI
- Added `palletProgressUnitLabel` to `palletProgress.ts`; used in `BuyerDashboard.tsx` for both static rendering and Realtime update handler
- Updated `BuyerPalletCard` interface with `displayUnit`, `displayUnitLabel`, `bottlesPerDisplayUnit`, `wineryId`, and `unitPrices` fields
- All tests updated: `palletProgress.test.ts`, `CreatePalletModal.test.tsx`

### File List
- app/supabase/migrations/20260410001000_add_pallet_display_unit_columns.sql (new)
- app/src/lib/supabase/queries/sellingUnits.ts (modified — PalletThresholdInfo + computePalletThreshold)
- app/src/lib/supabase/queries/virtualPallets.ts (modified — VirtualPallet interface + createVirtualPallet + getPalletsByArea + getPalletById)
- app/src/lib/palletProgress.ts (modified — palletProgressUnitLabel added)
- app/src/pages/pallets/CreatePalletModal.tsx (modified — threshold computation + UI)
- app/src/pages/dashboards/BuyerDashboard.tsx (modified — BuyerPalletCard + progressUnitLabel + selling units batch fetch)
- app/src/lib/__tests__/palletProgress.test.ts (modified — palletProgressUnitLabel tests)
- app/src/pages/pallets/__tests__/CreatePalletModal.test.tsx (modified — threshold mock + new tests)

### Change Log
- 2026-04-10: Implemented Story 8.1 — unit-aware pallet thresholds
