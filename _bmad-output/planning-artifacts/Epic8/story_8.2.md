# Story 8.2: Unit-Aware Order Placement

Status: ready-for-dev

## Story

As a buyer,
I want to place orders in the winery's configured selling units,
so that I can order by bottle, case, or pallet as offered.

## Acceptance Criteria

1. The AddOrderModal shows a unit selector dropdown listing only the selling unit types enabled for the pallet's product (e.g., if only case and pallet are enabled, bottle is not shown).
2. When "case" is selected, the quantity input accepts case count and a helper line shows the bottle equivalent (e.g., "3 cases = 18 bottles").
3. When "pallet" is selected, the quantity input accepts pallet count and a helper line shows the bottle equivalent (e.g., "1 pallet = 360 bottles").
4. When "bottle" is selected, the behavior matches the current flow (quantity in bottles, no conversion needed).
5. The order is recorded with both the unit type, unit quantity, and bottle equivalent — the `pallet_orders` table stores the bottle equivalent in its existing `quantity` column and new `unit_type` and `unit_quantity` columns.
6. The payment intent amount is calculated from the bottle equivalent × bulk_price_per_bottle (payment logic stays bottle-based).
7. The pallet progress updates by the bottle equivalent amount (existing RPCs work unchanged).
8. If no selling units are configured for the product (or no product is linked), the modal falls back to bottle-only mode (current behavior).
9. Unit tests verify unit selector rendering, conversion calculations, and order submission.

## Tasks / Subtasks

- [ ] Task 1: DB migration — add unit columns to pallet_orders (AC: #5)
  - [ ] Create migration `20260409004000_add_unit_columns_to_pallet_orders.sql`
  - [ ] `ALTER TABLE public.pallet_orders ADD COLUMN unit_type text DEFAULT 'bottle'`
  - [ ] `ALTER TABLE public.pallet_orders ADD COLUMN unit_quantity integer DEFAULT NULL`
  - [ ] No CHECK constraint on unit_type — keep flexible
  - [ ] Existing rows get 'bottle' as default, unit_quantity stays NULL (meaning quantity = bottle quantity, legacy)
- [ ] Task 2: Create bottle-equivalent conversion helper (AC: #2, #3, #6, #7)
  - [ ] In `sellingUnits.ts`, add:
    ```typescript
    export const toBottleEquivalent = (
      unitType: string,
      unitQuantity: number,
      sellingUnits: SellingUnit[]
    ): number
    ```
  - [ ] 'bottle' → return unitQuantity
  - [ ] 'case' → find case unit → return unitQuantity × bottles_per_case
  - [ ] 'pallet' → find pallet unit → if composition_type='cases', find case → return unitQuantity × pallet_quantity × bottles_per_case; if 'bottles', return unitQuantity × pallet_quantity
  - [ ] Throw if required selling unit not found
- [ ] Task 3: Fetch enabled selling units in AddOrderModal (AC: #1, #8)
  - [ ] When modal opens, check if pallet has `inventory_id`
  - [ ] If yes, call `getEnabledSellingUnitsForProduct(inventoryId)` (from Story 7.3) and `getSellingUnitsByWinery(wineryId)` to get unit definitions
  - [ ] Build list of available units with labels (e.g., "Case (6 bottles)", "Pallet (60 cases)")
  - [ ] If no inventory_id or no selling units found, default to bottle-only
- [ ] Task 4: Add unit selector to AddOrderModal UI (AC: #1, #2, #3, #4)
  - [ ] Add a dropdown/select above the quantity input: "Order unit"
  - [ ] Options: enabled unit types with descriptive labels
  - [ ] Default to the smallest enabled unit (bottle > case > pallet)
  - [ ] When unit changes, clear quantity and update the helper line
- [ ] Task 5: Add conversion display line (AC: #2, #3)
  - [ ] Below the quantity input, show: "{quantity} {unitLabel} = {bottleEquivalent} bottles"
  - [ ] Update in real-time as quantity changes
  - [ ] Use `toBottleEquivalent` for calculation
- [ ] Task 6: Update order submission flow (AC: #5, #6, #7)
  - [ ] Compute bottleEquivalent from selected unit + quantity
  - [ ] Pass bottleEquivalent as `quantity` to `createEscrowPaymentIntent` (payment stays bottle-based)
  - [ ] Pass bottleEquivalent as `quantity` to `commitAuthorizedOrder`
  - [ ] After commit, include `unit_type` and `unit_quantity` in a new update to the pallet_orders row, OR extend the commit-authorized-order Edge Function to accept and store them
  - [ ] **Recommended approach**: Extend `commitAuthorizedOrder` to pass `unitType` and `unitQuantity` → extend the Edge Function to pass them to the RPC → extend the RPC to INSERT them
- [ ] Task 7: Extend RPC and Edge Function for unit metadata (AC: #5)
  - [ ] Update `add_order_with_authorization_and_increment` RPC to accept `p_unit_type text DEFAULT 'bottle'` and `p_unit_quantity integer DEFAULT NULL`
  - [ ] Store them in the `pallet_orders` INSERT
  - [ ] Update the `commit-authorized-order` Edge Function to pass `unitType` and `unitQuantity` from request body to the RPC
  - [ ] Create migration: `20260409005000_extend_rpc_with_unit_metadata.sql`
- [ ] Task 8: Unit tests (AC: #9)
  - [ ] Test `toBottleEquivalent` with all unit types
  - [ ] Update `AddOrderModal.test.tsx` to test unit selector presence and conversion display
  - [ ] Test fallback to bottle-only when no selling units exist

## Dev Notes

### Critical: Payment Flow Stays Bottle-Based

The Stripe payment amount is ALWAYS calculated as `bottleEquivalent × bulk_price_per_bottle × 100` (cents). The unit selection is a presentation layer — the financial system always deals in bottles. This avoids any changes to the escrow/capture flow.

### AddOrderModal Current Flow

1. User enters quantity (bottles) and optional wine label
2. `createEscrowPaymentIntent(palletId, quantity)` → Edge Function computes amount from `quantity × bulk_price_per_bottle`
3. User confirms card → `stripe.confirmCardPayment`
4. `commitAuthorizedOrder({ palletId, quantity, paymentIntentId })` → Edge Function calls `add_order_with_authorization_and_increment` RPC
5. RPC inserts order, inserts authorization, increments `bottle_count`, auto-freezes if threshold met

The change: quantity in step 1 becomes "unit quantity" which is converted to bottle-equivalent before steps 2-5.

### Unit Selector UI Pattern

Follow the existing form styling in AddOrderModal:
```
<label className="block text-sm font-medium text-slate-700">Order Unit</label>
<select className="mt-1 block w-full rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-slate-900">
  <option value="bottle">Bottle</option>
  <option value="case">Case (6 bottles)</option>
  <option value="pallet">Pallet (60 cases)</option>
</select>
```

### Conversion Helper Line

Show below quantity input, using `text-sm text-slate-500`:
```
3 cases = 18 bottles · €153.00 estimated
```

Use `computeAmountCents` (already exists in AddOrderModal) with the bottle equivalent to show estimated cost.

### RPC Extension Approach

The cleanest approach is to add the parameters to the existing RPC with defaults so it's backward-compatible:

```sql
CREATE OR REPLACE FUNCTION public.add_order_with_authorization_and_increment(
  -- ... existing params ...
  p_unit_type        text DEFAULT 'bottle',
  p_unit_quantity    integer DEFAULT NULL,
  -- ... existing OUTs ...
)
```

And update the INSERT statement:
```sql
INSERT INTO public.pallet_orders (pallet_id, buyer_id, quantity, wine_label, notes, unit_type, unit_quantity)
VALUES (p_pallet_id, p_buyer_id, p_quantity, p_wine_label, p_notes, p_unit_type, p_unit_quantity)
```

### Project Structure Notes

- New migration: `winepooler/supabase/migrations/20260409004000_add_unit_columns_to_pallet_orders.sql`
- New migration: `winepooler/supabase/migrations/20260409005000_extend_rpc_with_unit_metadata.sql`
- Modified: `winepooler/src/lib/supabase/queries/sellingUnits.ts` (add `toBottleEquivalent`)
- Modified: `winepooler/src/pages/pallets/AddOrderModal.tsx` (unit selector, conversion, submission)
- Modified: `winepooler/src/lib/supabase/queries/payments.ts` (extend `commitAuthorizedOrder` params)
- Modified: `winepooler/supabase/functions/commit-authorized-order/index.ts` (pass unit metadata)
- Modified tests: `AddOrderModal.test.tsx`, new `sellingUnits.test.ts` tests

### Anti-Patterns to Avoid

- Do NOT change how the payment amount is calculated — it MUST stay bottle-based (quantity × price_per_bottle)
- Do NOT modify the freeze threshold logic — Story 8.1 handles that
- Do NOT change pricing display — that's Story 8.3
- Do NOT modify the create-escrow-payment-intent Edge Function — it already works with bottle quantity
- Do NOT break backward compatibility of the RPC — use DEFAULT values for new params

### Dependencies

- **Requires Epic 7 completed**: needs selling unit data and `getEnabledSellingUnitsForProduct` query
- **Requires Story 8.1 completed**: needs updated VirtualPallet interface with display_unit fields
- Uses existing `AddOrderModal.tsx`, `payments.ts`, `commit-authorized-order` Edge Function

### Edge Cases

- Pallet with no inventory_id linked: fall back to bottle-only (no unit selector shown)
- Product with only bottle enabled: unit selector shows only "Bottle" — effectively current behavior
- Large pallet order: user orders 1 pallet = 360 bottles. Ensure quantity validation checks against remaining capacity: `if (bottleEquivalent > (threshold - bottle_count)) show warning`
- Concurrent order that causes over-threshold: the RPC handles this atomically — if `bottle_count + quantity >= threshold`, it freezes. Over-threshold is technically possible; the system captures all authorized payments

### References

- [Source: src/pages/pallets/AddOrderModal.tsx] — Current order modal, payment flow, UI patterns
- [Source: src/lib/supabase/queries/payments.ts] — Payment intent and commit helpers
- [Source: supabase/functions/commit-authorized-order/index.ts] — Edge Function for order commit
- [Source: supabase/functions/create-escrow-payment-intent/index.ts] — Payment amount computation
- [Source: supabase/migrations/20260403007000_add_order_with_authorization_rpc.sql] — RPC to extend
- [Source: _bmad-output/planning-artifacts/prd.md#4.2] — Threshold Management
- [Source: _bmad-output/planning-artifacts/prd.md#4.5] — Selling Unit Configuration

## Dev Agent Record

### Agent Model Used

### Debug Log References

### Completion Notes List

### File List
