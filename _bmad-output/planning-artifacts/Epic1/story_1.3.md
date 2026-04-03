# Story 1.3: Role-Based Dashboard Access

Status: in-progress

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a logged-in user,
I want to see an interface tailored to my role,
so that I can perform relevant tasks.

## Acceptance Criteria

1. Given I am logged in as a Buyer
   When I access the dashboard
   Then I see the Buyer Dashboard with map/grid view
   And navigation reflects buyer capabilities

3. Given I am logged in as Winery representative
   When I access the dashboard
   Then I see the Winery Portal with analytics
   And I can view picking lists

## Tasks / Subtasks

- [ ] Implement role detection from auth (AC: 1,2,3)
  - [ ] Retrieve user role from Supabase auth metadata
  - [ ] Store role in app state
- [ ] Create Buyer Dashboard UI (AC: 1)
  - [ ] Build map/grid view component for pallets
  - [ ] Add buyer-specific navigation
- [ ] Create Winery Portal UI (AC: 3)
  - [ ] Build analytics dashboard
  - [ ] Add picking lists view
- [ ] Implement conditional rendering (AC: 1,2,3)
  - [ ] Route to appropriate dashboard based on role
  - [ ] Ensure role-specific features are accessible

## Dev Notes

- Relevant architecture patterns and constraints: Use React.js with Tailwind CSS and Typescript, Supabase for user data. Build on auth from Stories 1.1 and 1.2.
- Source tree components to touch: Create dashboard components, integrate with routing and auth.
- Testing standards summary: Test role detection, UI rendering per role, navigation.

### Project Structure Notes

- Alignment with unified project structure: Place dashboards in src/pages/dashboards or src/components/dashboards.
- Detected conflicts or variances: Ensure consistent styling with Tailwind, follow patterns from previous auth stories.

### References

- Cite all technical details with source paths and sections, e.g. [Source: _bmad-output/planning-artifacts/prd.md#5. User Interface & Screen Requirements]
- [Source: _bmad-output/planning-artifacts/epics-stories.md#Epic 1: User Authentication and Role Management]
- Previous Stories: 1.1 User Registration and 1.2 User Login - Use established auth and session management.

## Dev Agent Record

### Agent Model Used

GPT-5.4

### Debug Log References

- Implemented Story 1.3 code changes, but full test execution is blocked because no working Node/npm executable is available in the current terminal environment. Static verification via editor diagnostics reports zero TypeScript errors in `winepooler/src`.

### Completion Notes List

- Implemented role normalization in `src/lib/supabase/auth.ts` with shared `AppRole` and `normalizeRole`, so registration, login, auth state, and routing use the same `buyer|winery` values.
- Extended `src/lib/supabase/AuthContext.tsx` to store `role` in app state alongside `session` and `user`, sourced from Supabase auth metadata.
- Fixed `src/pages/Login.tsx` to route authenticated users to `/dashboard/buyer` or `/dashboard/winery` based on normalized role metadata.
- Corrected `src/pages/Register.tsx` role option values to lowercase to prevent broken role metadata at signup time.
- Built Buyer dashboard UI with buyer-specific navigation and map/grid pallet discovery in `src/pages/dashboards/BuyerDashboard.tsx`.
- Built Winery portal UI with analytics cards and picking lists view in `src/pages/dashboards/WineryDashboard.tsx`.
- Added `src/pages/dashboards/DashboardRouter.tsx` and `src/pages/dashboards/ProtectedDashboardRoute.tsx` to route `/dashboard` by role and block access to mismatched dashboards.
- Updated tests for login, register, and auth context role handling, and added route-level dashboard access coverage in `src/pages/dashboards/__tests__/DashboardAccess.test.tsx`.
- Story tasks remain unchecked because the required test suite could not be executed in this environment.

### File List

- winepooler/src/lib/supabase/auth.ts
- winepooler/src/lib/supabase/AuthContext.tsx
- winepooler/src/pages/Register.tsx
- winepooler/src/pages/Login.tsx
- winepooler/src/App.tsx
- winepooler/src/pages/dashboards/BuyerDashboard.tsx
- winepooler/src/pages/dashboards/WineryDashboard.tsx
- winepooler/src/pages/dashboards/DashboardRouter.tsx
- winepooler/src/pages/dashboards/ProtectedDashboardRoute.tsx
- winepooler/src/pages/__tests__/Login.test.tsx
- winepooler/src/pages/__tests__/Register.test.tsx
- winepooler/src/lib/supabase/__tests__/AuthContext.test.tsx
- winepooler/src/pages/dashboards/__tests__/DashboardAccess.test.tsx