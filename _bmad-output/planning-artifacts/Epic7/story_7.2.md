# Story 7.2: Selling Unit Configuration UI

Status: ready-for-dev

## Story

As a winery operator,
I want to access a Selling Unit Configuration section in my Winery Portal,
so that I can define my available selling units visually.

## Acceptance Criteria

1. The Winery Dashboard displays a "Selling Unit Configuration" section below the existing picking list.
2. The section shows a form with two configurable blocks: **Case** and **Pallet** (bottle is always implicitly available as the base unit).
3. For Case: a number input for "Bottles per Case" (min: 2, max: 100) with a toggle to enable/disable the case unit.
4. For Pallet: a dropdown for "Composition Type" (options: "Bottles" or "Cases"), a number input for "Quantity" (min: 1, max: 10000), and a toggle to enable/disable the pallet unit.
5. A "Save" button persists the configuration via the `sellingUnits` query module from Story 7.1.
6. On page load, existing selling unit definitions are fetched and pre-populate the form.
7. Validation prevents saving invalid configurations (e.g., case with 0 bottles, pallet with composition_type "cases" when no case is defined).
8. Success/error feedback is displayed after save using inline status messages.
9. Unit tests cover the component rendering, form validation, and save interaction.

## Tasks / Subtasks

- [ ] Task 1: Create SellingUnitConfig component (AC: #1, #2, #3, #4)
  - [ ] Create `src/pages/winery/SellingUnitConfig.tsx`
  - [ ] Build Case configuration block: enable toggle + bottles_per_case number input
  - [ ] Build Pallet configuration block: enable toggle + composition_type dropdown + quantity input
  - [ ] Display a summary line showing the bottle equivalent (e.g., "1 pallet = 60 cases × 6 bottles = 360 bottles")
- [ ] Task 2: Wire data loading and saving (AC: #5, #6, #8)
  - [ ] On mount, call `getSellingUnitsByWinery(wineryProfileId)` and populate form state
  - [ ] On save, call `upsertSellingUnit()` for each enabled unit type
  - [ ] Call `deleteSellingUnit()` for disabled unit types that previously existed
  - [ ] Show inline success/error feedback message after save
- [ ] Task 3: Add form validation (AC: #7)
  - [ ] Validate bottles_per_case ≥ 2 when case is enabled
  - [ ] Validate pallet quantity ≥ 1 when pallet is enabled
  - [ ] Prevent pallet with composition_type='cases' if case unit is not enabled
  - [ ] Disable Save button when form is invalid
- [ ] Task 4: Integrate into WineryDashboard (AC: #1)
  - [ ] Import and render `SellingUnitConfig` in `WineryDashboard.tsx` below the picking list section
  - [ ] Pass `wineryProfileId` as prop
- [ ] Task 5: Create unit tests (AC: #9)
  - [ ] Create `src/pages/winery/__tests__/SellingUnitConfig.test.tsx`
  - [ ] Test initial render with empty state
  - [ ] Test pre-populated form from existing data
  - [ ] Test validation error states
  - [ ] Test save success flow

## Dev Notes

### UI Design Patterns — MUST FOLLOW

Follow the exact design tokens from the existing Winery Dashboard:
- Section wrapper: `rounded-3xl bg-white p-6 shadow-sm ring-1 ring-stone-200`
- Section heading: `text-lg font-semibold text-stone-900`
- Label accent: `text-amber-700` (used for "Winery Portal" badge — use similarly for "Selling Units" label)
- Background: `bg-stone-50` (page background)
- Inputs: use standard Tailwind form styling with `rounded-lg border-stone-300 focus:ring-amber-500`
- Toggle switches: use a simple checkbox or a custom toggle component with `bg-amber-600` when active
- Buttons: follow existing patterns — primary: `bg-amber-600 hover:bg-amber-700 text-white rounded-lg px-4 py-2`
- Min touch target: 44px on controls

### Component Architecture

The `SellingUnitConfig` component should be a **controlled form** with local state:
```typescript
interface SellingUnitFormState {
  caseEnabled: boolean
  bottlesPerCase: number
  palletEnabled: boolean
  compositionType: 'bottles' | 'cases'
  palletQuantity: number
}
```

Use `useState` for form state and `useEffect` for initial data load. Do NOT introduce form libraries (react-hook-form, formik) — the project doesn't use them.

### Existing WineryDashboard Integration

The `WineryDashboard.tsx` currently:
1. Gets auth user via `useAuth()`
2. Fetches winery profile via `getWineryProfiles()` filtered by user_id
3. Fetches picking list via `getWineryPickingList(wineryProfileId)`
4. Renders analytics cards + picking list table

Add the `SellingUnitConfig` component as a new section **after** the picking list table. Pass `wineryProfileId` (the winery_profiles.id, not auth user_id).

### File Structure

- New component: `winepooler/src/pages/winery/SellingUnitConfig.tsx`
- New test: `winepooler/src/pages/winery/__tests__/SellingUnitConfig.test.tsx`
- Modified file: `winepooler/src/pages/dashboards/WineryDashboard.tsx` (add import + render)

### Anti-Patterns to Avoid

- Do NOT create a separate route/page for selling unit config — it lives inside the Winery Dashboard
- Do NOT add product-level toggle UI — that's Story 7.3
- Do NOT modify database schema — Story 7.1 handles that
- Do NOT use any external form/UI library not already in package.json
- Do NOT add dark mode styling — the project doesn't have dark mode implemented yet (it's in UX spec but not coded)

### Dependencies

- **Requires Story 7.1 completed**: needs `selling_units` table and `sellingUnits.ts` query module
- Uses existing `useAuth()` hook from `AuthContext.tsx`
- Uses existing `getWineryProfiles()` from `wineryProfiles.ts`

### Test Patterns

Follow patterns from `BuyerProfileForm.test.tsx` and `BuyerDashboard.test.tsx`:
- Mock `useAuth` to return a winery user
- Mock query functions via `vi.mock`
- Use `@testing-library/react` with `render`, `screen`, `fireEvent`/`userEvent`
- Use `waitFor` for async state updates

### References

- [Source: src/pages/dashboards/WineryDashboard.tsx] — Integration target, design tokens, data flow
- [Source: src/lib/supabase/queries/sellingUnits.ts] — Query API (from Story 7.1)
- [Source: _bmad-output/planning-artifacts/ux-design-specification.md] — Design system tokens, professional density
- [Source: _bmad-output/planning-artifacts/prd.md#5] — Winery Portal UI requirement

## Dev Agent Record

### Agent Model Used

### Debug Log References

### Completion Notes List

### File List
