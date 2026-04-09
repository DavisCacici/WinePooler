# Story 7.3: Per-Product Selling Unit Assignment

Status: ready-for-dev

## Story

As a winery operator,
I want to assign selling unit settings to each of my wine products individually,
so that different labels can have different packaging options.

## Acceptance Criteria

1. The Winery Dashboard displays a "Product Unit Settings" table below the Selling Unit Configuration section, listing all wine products from `wine_inventory`.
2. Each product row shows the wine label, SKU, and a set of toggle switches for each defined selling unit (bottle, case, pallet).
3. Toggles reflect the current `product_selling_units` state (enabled/disabled) for each product.
4. Toggling a switch immediately persists the change via the `toggleProductSellingUnit()` function from Story 7.1.
5. At least one unit type must remain enabled per product — the UI prevents disabling the last active toggle by disabling it visually and showing a tooltip "At least one unit type must be enabled".
6. When a winery adds a new selling unit definition (via Story 7.2), all existing products automatically get that unit enabled (default `enabled: true` via DB default).
7. The buyer-facing marketplace (BuyerDashboard / pallet views) only shows selling unit types that are enabled for a given product — this is enforced by the query layer.
8. Unit tests cover toggle rendering, toggle interaction, and the "last unit" guard.

## Tasks / Subtasks

- [ ] Task 1: Create ProductUnitSettings component (AC: #1, #2, #3)
  - [ ] Create `src/pages/winery/ProductUnitSettings.tsx`
  - [ ] On mount, fetch winery's wine inventory via `getWineryInventory(wineryId)` (add this query if not existing)
  - [ ] On mount, fetch winery's selling units via `getSellingUnitsByWinery(wineryId)`
  - [ ] On mount, fetch all product_selling_units for each product
  - [ ] Render a table: columns = Wine Label | SKU | Bottle | Case | Pallet (dynamic based on defined units)
  - [ ] Each unit column shows a toggle switch reflecting enabled state
- [ ] Task 2: Implement toggle interaction (AC: #4, #5)
  - [ ] On toggle change, call `toggleProductSellingUnit(inventoryId, sellingUnitId, newEnabled)`
  - [ ] Count currently enabled units for the product; if only 1 remains enabled, disable its toggle and show tooltip
  - [ ] Optimistic UI update: toggle state changes immediately, reverts on error
- [ ] Task 3: Handle default assignment for new selling units (AC: #6)
  - [ ] Create a DB trigger or handle in application layer: when a new `selling_units` row is inserted, create `product_selling_units` rows for all existing `wine_inventory` items of that winery with `enabled: true`
  - [ ] Preferred approach: SQL trigger function in migration to keep DB consistent
- [ ] Task 4: Add buyer-side query filter (AC: #7)
  - [ ] Update or create a query function `getEnabledSellingUnitsForProduct(inventoryId)` that returns only enabled selling units
  - [ ] This function will be consumed by Epic 8 stories — for now, ensure the query exists and is tested
- [ ] Task 5: Integrate into WineryDashboard (AC: #1)
  - [ ] Import and render `ProductUnitSettings` in `WineryDashboard.tsx` below the SellingUnitConfig section
  - [ ] Pass `wineryProfileId` as prop
- [ ] Task 6: Create unit tests (AC: #8)
  - [ ] Create `src/pages/winery/__tests__/ProductUnitSettings.test.tsx`
  - [ ] Test table renders with correct products and toggle states
  - [ ] Test toggle fires `toggleProductSellingUnit` with correct params
  - [ ] Test last-unit guard prevents disabling

## Dev Notes

### Component Architecture

```typescript
interface ProductUnitRow {
  inventoryId: string
  wineLabel: string
  sku: string
  units: {
    sellingUnitId: string
    unitType: 'bottle' | 'case' | 'pallet'
    enabled: boolean
  }[]
}
```

The component builds `ProductUnitRow[]` by joining wine_inventory with product_selling_units and selling_units data. Use `useState` for the rows and update optimistically on toggle.

### Wine Inventory Query

The existing `wineInventory.ts` has `getInventoryByPallet(palletId)` which fetches a single inventory item. You need a new function:

```typescript
export const getWineryInventory = async (wineryId: string): Promise<WineInventory[]> => {
  const { data, error } = await supabase
    .from('wine_inventory')
    .select('*')
    .eq('winery_id', wineryId)
    .order('wine_label')
  if (error) throw error
  return data ?? []
}
```

Add this to the existing `wineInventory.ts` file — do NOT create a new file.

### DB Trigger for Auto-Assignment

Create a migration with a trigger function that fires AFTER INSERT on `selling_units`:

```sql
CREATE OR REPLACE FUNCTION public.auto_assign_selling_unit_to_products()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.product_selling_units (inventory_id, selling_unit_id, enabled)
  SELECT wi.id, NEW.id, true
  FROM public.wine_inventory wi
  WHERE wi.winery_id = NEW.winery_id;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER trg_auto_assign_selling_unit
AFTER INSERT ON public.selling_units
FOR EACH ROW EXECUTE FUNCTION public.auto_assign_selling_unit_to_products();
```

Place this in a new migration file: `20260409002000_auto_assign_selling_units_trigger.sql`

### UI Design Patterns — MUST FOLLOW

Same design tokens as WineryDashboard and SellingUnitConfig (Story 7.2):
- Table wrapper: `rounded-3xl bg-white p-6 shadow-sm ring-1 ring-stone-200`
- Table: `min-w-full divide-y divide-stone-200`
- Header cells: `text-xs font-medium text-stone-500 uppercase tracking-wider`
- Body cells: `text-sm text-stone-900`
- Toggle active: `bg-amber-600`; inactive: `bg-stone-300`
- Disabled toggle: `opacity-50 cursor-not-allowed` with tooltip
- Min touch target: 44px on toggles

### File Structure

- New component: `winepooler/src/pages/winery/ProductUnitSettings.tsx`
- New test: `winepooler/src/pages/winery/__tests__/ProductUnitSettings.test.tsx`
- New migration: `winepooler/supabase/migrations/20260409002000_auto_assign_selling_units_trigger.sql`
- Modified: `winepooler/src/lib/supabase/queries/wineInventory.ts` (add `getWineryInventory`)
- Modified: `winepooler/src/pages/dashboards/WineryDashboard.tsx` (add import + render)

### Anti-Patterns to Avoid

- Do NOT modify selling_units or product_selling_units table schema — Story 7.1 handles that
- Do NOT add pricing per unit — that's Epic 8 (Story 8.3)
- Do NOT modify buyer order flow — that's Epic 8 (Story 8.2)
- Do NOT poll for updates — Realtime is already enabled on these tables from Story 7.1; consider subscribing but it's optional for MVP
- Do NOT create a separate page — this is a section within WineryDashboard

### Dependencies

- **Requires Story 7.1 completed**: needs `selling_units`, `product_selling_units` tables and `sellingUnits.ts` query module
- **Requires Story 7.2 completed**: the SellingUnitConfig UI must exist in the dashboard so Product Unit Settings appears below it
- Uses existing `wine_inventory` table and `wineInventory.ts` query module
- Uses existing `useAuth()` hook from `AuthContext.tsx`

### Edge Cases

- Winery with no wine inventory items: show empty state "No products to configure. Add wine inventory first."
- Winery with no selling units defined: show message "Define your selling units above before configuring products."
- Product with only bottle unit (no case/pallet defined by winery): bottle toggle shown but disabled (can't remove the only unit)

### References

- [Source: src/lib/supabase/queries/sellingUnits.ts] — Query functions for selling units (from Story 7.1)
- [Source: src/lib/supabase/queries/wineInventory.ts] — Wine inventory query patterns
- [Source: src/pages/winery/SellingUnitConfig.tsx] — Sibling component from Story 7.2
- [Source: src/pages/dashboards/WineryDashboard.tsx] — Integration target
- [Source: _bmad-output/planning-artifacts/prd.md#4.5] — Per-Product Configuration (FR13) and Unit Toggle (FR14)

## Dev Agent Record

### Agent Model Used

### Debug Log References

### Completion Notes List

### File List
