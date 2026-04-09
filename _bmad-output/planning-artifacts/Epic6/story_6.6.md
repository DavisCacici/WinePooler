# Story 6.6: Scalable Configuration

Status: ready-for-dev

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a developer,
I want geographic clusters configurable,
so that the platform can expand.

## Acceptance Criteria

1. Given the platform needs to support new geographic areas
   When an administrator adds a new macro-area via database configuration
   Then the new area appears in the Buyer area selection page without code changes
   And the new area appears in the Buyer dashboard area filter
   And virtual pallets can be created in the new area immediately

2. Given macro-areas have operational metadata
   When a macro-area is configured
   Then it supports metadata fields: display name, slug, description, display order, active/inactive toggle, and optional geographic coordinates/bounds
   And inactive areas are hidden from Buyer-facing views but preserved in the database
   And existing orders/pallets in deactivated areas remain accessible (soft-delete behavior)

3. Given the platform may scale to many areas
   When the area list is queried
   Then queries use indexed columns and return only active areas by default
   And area data is cacheable on the client (no unnecessary re-fetches on navigation)
   And the UI handles varying numbers of areas gracefully (1 area, 5 areas, 50+ areas)

4. Given areas need administrative management
   When area configuration changes
   Then changes are applied via Supabase migration files or a documented seed/admin process
   And a CLI or SQL seed script exists for adding new areas reproducibly
   And area configuration changes do not require application redeployment

5. Given the system configuration may expand beyond areas
   When the configuration pattern is established
   Then it serves as a reference pattern for future configurable entities (e.g., wine categories, pallet capacity profiles)
   And configuration follows a consistent schema pattern: `id`, `name`, `slug`, `is_active`, `display_order`, `metadata JSONB`

## Tasks / Subtasks

- [ ] Audit current macro_areas schema and usage (AC: 1, 2)
  - [ ] Review existing migration `20260401001000_create_macro_areas_and_buyer_profile_area_fk.sql`
  - [ ] Verify current columns: `id`, `name`, `slug`, `description`, `display_order`, `is_active`, `created_at`
  - [ ] Identify any missing fields for scalable operations (coordinates, metadata JSONB)
  - [ ] Review all code that reads `macro_areas`: `getMacroAreas()`, AreaSelectionPage, BuyerDashboard
- [ ] Enhance macro_areas schema if needed (AC: 2, 5)
  - [ ] Add `metadata JSONB` column for extensible area properties (coordinates, region grouping, etc.)
  - [ ] Add `updated_at` timestamp column for change tracking
  - [ ] Ensure indexes exist on `is_active`, `display_order`, and `slug`
  - [ ] Create migration file following existing timestamp convention
- [ ] Create area seed/management script (AC: 4)
  - [ ] Create a SQL seed script for adding new areas with all required fields
  - [ ] Document the process for adding a new area (step-by-step in README)
  - [ ] Include example: adding a new Italian region (e.g., "Piedmont Hills", "Veneto East")
- [ ] Validate dynamic area loading in UI (AC: 1, 3)
  - [ ] Verify `getMacroAreas()` query filters by `is_active = true` and orders by `display_order`
  - [ ] Verify AreaSelectionPage renders correctly with varying area counts
  - [ ] Verify BuyerDashboard area filter works with new areas without code changes
  - [ ] Test with 1 area, 5 areas, and 20+ areas to validate UI scaling
- [ ] Implement client-side caching for area data (AC: 3)
  - [ ] Areas change infrequently — cache the area list in React state or context to avoid redundant Supabase calls on route changes
  - [ ] Invalidate cache only on explicit user action (e.g., profile area change) or session start
- [ ] Validate soft-delete behavior (AC: 2)
  - [ ] Set an existing area to `is_active = false`
  - [ ] Verify area disappears from selection/filter views
  - [ ] Verify existing pallets/orders in that area remain queryable
  - [ ] Verify buyer profiles linked to deactivated areas still function (with appropriate UX messaging)
- [ ] Add tests for scalable configuration (AC: 1, 3)
  - [ ] Test `getMacroAreas()` returns only active areas sorted by display_order
  - [ ] Test AreaSelectionPage renders with varying area counts
  - [ ] Test deactivated area behavior in dashboard context

## Dev Notes

### Architecture & Technical Context

- **The system is already partially configuration-driven.** The `macro_areas` table stores areas in the database, and the UI loads them dynamically via `getMacroAreas()` in `src/lib/supabase/queries/macroAreas.ts`. No areas are hardcoded in UI code.
- **Current schema** (from migration `20260401001000`):
  ```sql
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text UNIQUE NOT NULL,
  slug text UNIQUE NOT NULL,
  description text,
  display_order int DEFAULT 0,
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now()
  ```
- **Current seed data**: North Milan, Lake Garda, Turin Center (3 areas).
- **RLS**: Authenticated users can `SELECT` active macro_areas (policy exists in migration).
- **Consumers of macro_areas**:
  - `getMacroAreas()` — fetches active areas ordered by `display_order`
  - `AreaSelectionPage.tsx` — renders area cards for buyer profile setup
  - `BuyerDashboard.tsx` — filters pallets by `area_id`, subscribes to realtime updates filtered by area
  - `virtual_pallets` table — FK to `macro_areas.id`
  - `buyer_profiles` table — FK to `macro_areas.id` via `area_id`

### Key Insight: Most of the Work is Already Done

The primary infra for configurable areas already exists. This story focuses on:
1. **Enhancing** the schema with extensible metadata and operational fields
2. **Documenting** the process for adding new areas
3. **Validating** the UI handles varying area counts gracefully
4. **Establishing** the configuration pattern for future reuse

### Previous Story Learnings

- Story 6.2: "Read from a low-risk public/authenticated table (e.g., `macro_areas`) used for integration validation"
- Story 6.2: "Use migration files as the canonical source for schema/RLS, not ad-hoc SQL"
- Story 6.1: "Non-destructive requirement — preserve existing pages and routing contracts"

### Regression Risks

- Schema migration must not break existing FK relationships (`buyer_profiles.area_id`, `virtual_pallets.area_id`).
- Adding columns with `NOT NULL` without defaults will fail on existing rows — always use `DEFAULT` or make nullable.
- Caching area data in React state must not prevent realtime updates from reflecting if an admin adds areas during a session (acceptable trade-off for MVP).
- Deactivating an area linked to active buyer profiles must be handled gracefully (don't orphan users).

### Testing Strategy

- **Query tests**: Verify `getMacroAreas()` behavior with active/inactive areas.
- **Component tests**: AreaSelectionPage with varying area counts (empty, few, many).
- **Integration consideration**: Test adding a new area seed and verifying it appears in UI without code changes.

### Project Structure Notes

```text
supabase/
├── migrations/
│   └── YYYYMMDDHHMMSS_enhance_macro_areas.sql     ← NEW (if schema changes needed)
├── seed/
│   └── add-area-template.sql                       ← NEW (example seed script)
winepooler/
├── src/
│   └── lib/
│       └── supabase/
│           └── queries/
│               └── macroAreas.ts                   ← REVIEW (verify dynamic loading)
└── README.md                                       ← MODIFY (area management docs)
```

### References

- [Source: _bmad-output/planning-artifacts/epics-stories.md#Story 6.6: Scalable Configuration]
- [Source: _bmad-output/planning-artifacts/prd.md#8. Non-Functional Requirements — NFR3]
- [Source: _bmad-output/planning-artifacts/Epic6/story_6.2.md — migration workflow, macro_areas usage]
- [Source: winepooler/src/lib/supabase/queries/macroAreas.ts — getMacroAreas()]
- [Source: winepooler/src/pages/profile/AreaSelectionPage.tsx — area selection UI]
- [Source: winepooler/src/pages/dashboards/BuyerDashboard.tsx — area-scoped pallet filtering]
- [Source: supabase/migrations/20260401001000_create_macro_areas_and_buyer_profile_area_fk.sql — current schema]

## Dev Agent Record

### Agent Model Used

### Debug Log References

### Completion Notes List

### File List
