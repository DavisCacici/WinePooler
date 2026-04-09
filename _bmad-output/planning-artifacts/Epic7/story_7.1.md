# Story 7.1: Selling Unit Schema and Configuration API

Status: review

## Story

As a winery,
I want the platform to support selling unit definitions (bottle, case, pallet),
so that I can configure how my products are sold.

## Acceptance Criteria

1. A `selling_units` table exists with columns: `id` (uuid PK), `winery_id` (FK → winery_profiles), `unit_type` (text, CHECK IN ('bottle','case','pallet')), `bottles_per_case` (integer, nullable — required when unit_type='case'), `composition_type` (text, nullable, CHECK IN ('bottles','cases') — required when unit_type='pallet'), `pallet_quantity` (integer, nullable — required when unit_type='pallet'), `created_at`, `updated_at`.
2. A `product_selling_units` join table exists with columns: `id` (uuid PK), `inventory_id` (FK → wine_inventory), `selling_unit_id` (FK → selling_units), `enabled` (boolean DEFAULT true), `created_at`. UNIQUE constraint on (inventory_id, selling_unit_id).
3. RLS policies on `selling_units`: all authenticated users can SELECT; only the owning winery can INSERT, UPDATE, DELETE (matched via `winery_id` → `winery_profiles.user_id` = `auth.uid()`).
4. RLS policies on `product_selling_units`: all authenticated users can SELECT; only the owning winery can INSERT, UPDATE, DELETE (join through selling_units → winery_profiles to verify ownership).
5. TypeScript query module `sellingUnits.ts` exposes CRUD functions following project patterns.
6. Unit tests validate query functions with Supabase mocks.

## Tasks / Subtasks

- [x] Task 1: Create DB migration for `selling_units` table (AC: #1, #3)
  - [x] Define table with all columns, CHECK constraints, FK to winery_profiles
  - [x] Add RLS policies: SELECT for authenticated, INSERT/UPDATE/DELETE for owning winery
  - [x] Enable Realtime on the table
- [x] Task 2: Create DB migration for `product_selling_units` table (AC: #2, #4)
  - [x] Define table with FK to wine_inventory and selling_units
  - [x] Add UNIQUE constraint on (inventory_id, selling_unit_id)
  - [x] Add RLS policies with ownership check via join
  - [x] Enable Realtime on the table
- [x] Task 3: Create TypeScript query module (AC: #5)
  - [x] Create `src/lib/supabase/queries/sellingUnits.ts`
  - [x] Define `SellingUnit` and `ProductSellingUnit` interfaces
  - [x] Implement `getSellingUnitsByWinery(wineryId)` — returns all selling units for a winery
  - [x] Implement `upsertSellingUnit(unit)` — create or update a selling unit
  - [x] Implement `deleteSellingUnit(unitId)` — delete a selling unit
  - [x] Implement `getProductSellingUnits(inventoryId)` — returns enabled/disabled units for a product
  - [x] Implement `toggleProductSellingUnit(inventoryId, sellingUnitId, enabled)` — enable/disable a unit for a product
- [x] Task 4: Create unit tests (AC: #6)
  - [x] Create `src/lib/supabase/queries/__tests__/sellingUnits.test.ts`
  - [x] Test each query function with mocked Supabase client

## Dev Notes

### Database Design Rationale

The `selling_units` table uses a single-table design with nullable fields discriminated by `unit_type`:
- `bottle`: no extra fields needed (bottles_per_case, composition_type, pallet_quantity all NULL)
- `case`: `bottles_per_case` is required (e.g., 6, 12); composition_type and pallet_quantity NULL
- `pallet`: `composition_type` ('bottles' or 'cases') and `pallet_quantity` are required; bottles_per_case NULL

This is simpler than three separate tables and matches the project's existing flat-table approach (see `winery_profiles`, `wine_inventory`).

### Existing Schema Patterns to Follow

Follow the exact conventions from existing migrations:
- Use `gen_random_uuid()` for PKs
- Use `timestamptz DEFAULT now()` for timestamps
- Use `ON DELETE CASCADE` for FKs referencing parent entities
- RLS pattern: `USING (...)` for SELECT, `WITH CHECK (...)` for INSERT/UPDATE
- Ownership check pattern (from wine_inventory migration):
  ```sql
  EXISTS (
    SELECT 1 FROM public.winery_profiles wp
    WHERE wp.id = selling_units.winery_id
    AND wp.user_id = auth.uid()
  )
  ```

### Query Module Patterns

Follow exact patterns from `wineryProfiles.ts` and `wineInventory.ts`:
- Import `supabase` from `'../client'`
- Export interfaces with exact field names matching DB columns (snake_case)
- Async functions returning `Promise<T[]>` or `Promise<T | null>`
- Throw on error: `if (error) throw error`
- Return `data ?? []` for arrays

### Test Patterns

Follow patterns from `buyerProfile.test.ts` and `macroAreas.test.ts`:
- Mock `supabase` using `vi.mock('../client')`
- Use `vi.fn()` chains for `.from().select().eq().order()` etc.
- Assert on return values and error throwing

### Project Structure Notes

- Migration file: `winepooler/supabase/migrations/20260409000000_create_selling_units.sql`
- Migration file: `winepooler/supabase/migrations/20260409001000_create_product_selling_units.sql`
- Query module: `winepooler/src/lib/supabase/queries/sellingUnits.ts`
- Test file: `winepooler/src/lib/supabase/queries/__tests__/sellingUnits.test.ts`

### Anti-Patterns to Avoid

- Do NOT add columns to existing tables (`wine_inventory`, `virtual_pallets`) in this story — that happens in Epic 8
- Do NOT create UI components — that's Story 7.2
- Do NOT modify existing RPC functions — that's Epic 8
- Do NOT add a `bottle` row automatically — the winery explicitly creates selling units they want

### References

- [Source: supabase/migrations/20260401003000_create_winery_profiles_and_virtual_pallets.sql] — Winery profiles schema and RLS pattern
- [Source: supabase/migrations/20260403004000_create_wine_inventory.sql] — Wine inventory schema, ownership RLS pattern
- [Source: src/lib/supabase/queries/wineryProfiles.ts] — Query module pattern
- [Source: src/lib/supabase/queries/wineInventory.ts] — Query module with inventory-specific interface
- [Source: _bmad-output/planning-artifacts/prd.md#4.5] — Selling Unit Configuration requirements (FR10-FR14)

## Dev Agent Record

### Agent Model Used
Claude Opus 4.6

### Debug Log References

### Completion Notes List
- Created `selling_units` table migration with CHECK constraints for unit_type discrimination, RLS policies following role-based pattern (TO winery), and Realtime enabled
- Created `product_selling_units` join table migration with UNIQUE constraint, ownership-based RLS via join to selling_units → winery_profiles, and Realtime enabled
- Created `sellingUnits.ts` query module with CRUD functions: getSellingUnitsByWinery, upsertSellingUnit, deleteSellingUnit, getProductSellingUnits, toggleProductSellingUnit, getEnabledSellingUnitsForProduct
- Created comprehensive unit tests covering all query functions with success/error/empty cases
- Used timestamps 20260409005000 and 20260409006000 to avoid conflicts with existing migrations
- All RLS policies follow the latest comprehensive_rls pattern with role-based enforcement (TO winery)

### File List
- winepooler/supabase/migrations/20260409005000_create_selling_units.sql (new)
- winepooler/supabase/migrations/20260409006000_create_product_selling_units.sql (new)
- winepooler/src/lib/supabase/queries/sellingUnits.ts (new)
- winepooler/src/lib/supabase/queries/__tests__/sellingUnits.test.ts (new)
