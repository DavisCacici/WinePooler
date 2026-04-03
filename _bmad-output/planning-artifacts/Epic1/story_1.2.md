# Story 1.2: User Login

Status: review

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a registered user,
I want to login with my credentials,
so that I can access my role-specific dashboard.

## Acceptance Criteria

1. Given I have a registered account
   When I enter correct email and password on the login page
   Then I am authenticated and redirected to my role-specific dashboard
   And my session is maintained

## Tasks / Subtasks

- [x] Implement login form UI (AC: 1)
  - [x] Create login page component
  - [x] Add form fields: email, password
  - [x] Add form validation
- [x] Integrate Supabase authentication (AC: 1)
  - [x] Implement user login API call
  - [x] Handle login response and errors
  - [x] Manage user session
- [x] Implement role-based redirect (AC: 1)
  - [x] Detect user role from auth data
  - [x] Redirect to appropriate dashboard (Buyer, Sommelier, Winery)
- [x] Ensure session persistence (AC: 1)
  - [x] Store session securely
  - [x] Handle session expiration

## Dev Notes

- Relevant architecture patterns and constraints: Use React.js with Tailwind CSS and Typescript for frontend, Supabase for backend auth. Build on registration story patterns.
- Source tree components to touch: Create login page, integrate with auth setup from Story 1.1.
- Testing standards summary: Ensure form validation, API integration tests, user flow tests, session management tests.

### Project Structure Notes

- Alignment with unified project structure: Place login component in src/pages or src/components/auth, consistent with registration.
- Detected conflicts or variances: None, following patterns from Story 1.1.

### References

- Cite all technical details with source paths and sections, e.g. [Source: _bmad-output/planning-artifacts/prd.md#6. Technical Specifications]
- [Source: _bmad-output/planning-artifacts/epics-stories.md#Epic 1: User Authentication and Role Management]
- Previous Story: 1.1 User Registration - Use established auth patterns and Supabase integration.

## Dev Agent Record

### Agent Model Used

Claude Sonnet 4.6

### Debug Log References

None.

### Completion Notes List

- **Task 1 — Login Form UI**: Replaced `Login.tsx` stub with full implementation. `htmlFor`/`id` on all inputs for accessibility and testability. Form validates email format and password min-length (6). Error rendered in `role="alert"` paragraph. Loading state disables button and shows "Logging in...".
- **Task 2 — Supabase Auth**: Added `loginUser` (calls `supabase.auth.signInWithPassword`) to `src/lib/supabase/auth.ts`. Created `AuthContext.tsx` with `AuthProvider` + `useAuth` hook. Provider loads persisted session via `getSession()` on mount and subscribes to `onAuthStateChange` to handle token refresh and session expiry; unsubscribes on unmount.
- **Task 3 — Role-based redirect**: `Login.tsx` reads `user.user_metadata.role` after successful login and navigates using `ROLE_ROUTES` map: `Restaurateur→/dashboard/restaurateur`, `Sommelier→/dashboard/sommelier`, `Winery→/dashboard/winery`. Created three dashboard stub pages. `App.tsx` updated with `AuthProvider` wrapper and all three dashboard routes.
- **Task 4 — Session Persistence**: Supabase stores JWT session in `localStorage` automatically. `AuthContext` exposes live session state and handles expiry via `onAuthStateChange`. Added vitest config (`environment: jsdom`, `setupFiles`) and `src/test-setup.ts` importing `@testing-library/jest-dom`. Wrote 8 tests in `Login.test.tsx` and 7 tests in `AuthContext.test.tsx`. TypeScript: zero errors.

### File List

- `winepooler/vite.config.ts` — added vitest config (jsdom environment, setupFiles)
- `winepooler/src/test-setup.ts` — new: imports @testing-library/jest-dom
- `winepooler/src/pages/Login.tsx` — replaced stub with full implementation
- `winepooler/src/lib/supabase/auth.ts` — added `loginUser`
- `winepooler/src/lib/supabase/AuthContext.tsx` — new: AuthProvider + useAuth hook
- `winepooler/src/pages/dashboards/RestaurateurDashboard.tsx` — new: stub
- `winepooler/src/pages/dashboards/SommelierDashboard.tsx` — new: stub
- `winepooler/src/pages/dashboards/WineryDashboard.tsx` — new: stub
- `winepooler/src/App.tsx` — added AuthProvider wrapper + dashboard routes
- `winepooler/src/pages/__tests__/Login.test.tsx` — new: 8 unit tests
- `winepooler/src/lib/supabase/__tests__/AuthContext.test.tsx` — new: 7 unit tests