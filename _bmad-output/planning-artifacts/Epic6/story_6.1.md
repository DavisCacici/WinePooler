# Story 6.1: React Frontend Setup

Status: review

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a developer,
I want a basic React app with Tailwind CSS and Typescript,
so that the frontend foundation is ready.

## Acceptance Criteria

1. Given a fresh clone of the project
   When I run dependency install and the local dev script
   Then the React + TypeScript app starts successfully with Vite
   And the home route renders without runtime errors

2. Given the frontend baseline
   When I run a production build
   Then TypeScript compilation and Vite build both complete successfully
   And no blocking TypeScript errors are present in app-level source files

3. Given Tailwind CSS is configured
   When I use Tailwind utility classes in app components
   Then styles are applied correctly in the running app
   And responsive utilities work across desktop and mobile widths

4. Given the project has base routing and auth provider wiring
   When the app boots
   Then routing works for `/`, `/register`, `/login`, `/dashboard/buyer`, and `/dashboard/winery`
   And the React root is mounted via `main.tsx` with `BrowserRouter` and `AuthProvider`

5. Given the current codebase already includes a frontend scaffold
   When Story 6.1 is implemented
   Then no destructive re-initialization occurs
   And configuration is stabilized using existing files rather than replacing the project

## Tasks / Subtasks

- [x] Validate existing frontend scaffold instead of re-initializing (AC: 1, 5)
  - [x] Confirm Vite + React + TypeScript config in [winepooler/package.json](winepooler/package.json), [winepooler/tsconfig.json](winepooler/tsconfig.json), and [winepooler/vite.config.ts](winepooler/vite.config.ts)
  - [x] Confirm root bootstrapping in [winepooler/src/main.tsx](winepooler/src/main.tsx)
  - [x] Confirm route shell and auth provider wrapping in [winepooler/src/App.tsx](winepooler/src/App.tsx)
  - [x] Document baseline run commands in [winepooler/README.md](winepooler/README.md)
- [x] Normalize base styling foundation (AC: 3, 5)
  - [x] Keep Tailwind directives in [winepooler/src/index.css](winepooler/src/index.css): `@tailwind base; @tailwind components; @tailwind utilities;`
  - [x] Remove template-specific global constraints that can conflict with app layouts (e.g., fixed-width `#root` styling), while preserving project visual direction
  - [x] Ensure base CSS does not force dark mode by default unless explicitly required by product UX
  - [x] Keep typography and spacing defaults compatible with dashboard pages
- [x] Verify Tailwind integration and content scanning (AC: 3)
  - [x] Confirm [winepooler/tailwind.config.js](winepooler/tailwind.config.js) content globs include all `src/**/*.{js,ts,jsx,tsx}` and `index.html`
  - [x] Add one lightweight verification component/smoke style in existing pages (no throwaway demo pages)
  - [x] Confirm responsive classes render correctly at mobile breakpoint
- [x] Strengthen developer scripts and quality checks (AC: 1, 2)
  - [x] Verify scripts `dev`, `build`, `lint`, `test`, `preview` in [winepooler/package.json](winepooler/package.json)
  - [x] Run local validation sequence: install -> lint -> build -> test (or document any pre-existing failures)
  - [x] Ensure CI-ready baseline: build must fail on true TypeScript errors
- [x] Add foundational frontend smoke tests (AC: 2, 4)
  - [x] Add/update app boot test to verify root render and primary route render (using existing Vitest setup)
  - [x] Add route-level smoke test for buyer/winery dashboard route mounting with mocked auth context
  - [x] Keep tests minimal and stable; avoid brittle visual snapshot tests at this stage
- [x] Update developer onboarding docs (AC: 1, 5)
  - [x] Update [winepooler/README.md](winepooler/README.md) with prerequisites, install, env setup, run/build/test commands
  - [x] List required frontend env vars currently used by app (`VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`)
  - [x] Add note that server-side secrets are not stored in Vite env vars

## Dev Notes

### Architecture & Technical Context

- **Current baseline already exists**: this repository is not a blank project. The app already contains React + TypeScript + Vite + Tailwind dependencies and bootstrapping. Story 6.1 must harden and verify this baseline, not recreate it.
- **Entry point**: [winepooler/src/main.tsx](winepooler/src/main.tsx) mounts React root with `BrowserRouter`.
- **App shell**: [winepooler/src/App.tsx](winepooler/src/App.tsx) already defines routes and wraps the app with `AuthProvider`.
- **Styling caveat**: [winepooler/src/index.css](winepooler/src/index.css) currently contains template-level root width constraints and color-scheme defaults that may conflict with dashboard layouts. This story should convert CSS to a neutral app foundation while keeping Tailwind as the primary styling layer.
- **Scope boundary**: do not implement Supabase backend integration details here (that is Story 6.2), and do not implement Stripe payment flows here (that is Story 6.3 / Epic 5 stories).
- **Non-destructive requirement**: preserve existing pages and routing contracts because earlier stories reference them as integration points.

### Baseline Verification Checklist

```bash
# from winepooler/
npm install
npm run dev
npm run lint
npm run build
npm run test
```

If tests or lint fail due to pre-existing issues outside Story 6.1 scope, document them in the story implementation notes and proceed with foundation tasks that are in scope.

### Suggested Minimal CSS Baseline

Keep only global defaults that do not constrain app layout excessively:

```css
@tailwind base;
@tailwind components;
@tailwind utilities;

:root {
  font-family: Inter, system-ui, -apple-system, Segoe UI, Roboto, sans-serif;
  line-height: 1.5;
  font-weight: 400;
}

* {
  box-sizing: border-box;
}

html,
body,
#root {
  min-height: 100%;
}

body {
  margin: 0;
}
```

This avoids hard-coded fixed-width root containers and lets page-level Tailwind classes control layout.

### Testing Strategy

- **Smoke level only for this story**:
  - app mounts without crash
  - key route tree renders
  - Tailwind classes are present in rendered output where expected
- **Do not** add heavy integration/e2e tests yet; those belong later after backend/payment stories are implemented.

### Regression Risks

- Replacing `index.css` aggressively can unintentionally break visual rhythm in existing dashboard pages. Keep changes minimal and verify both buyer and winery pages still render correctly.
- Changing route structure in Story 6.1 can break references from earlier story artifacts. Keep existing paths stable.
- Removing template CSS without preserving `@tailwind` directives will silently break styles across the app.

### Project Structure Notes

```text
winepooler/
├── package.json                    ← validate scripts/dependencies
├── README.md                       ← update onboarding and run commands
├── tailwind.config.js              ← verify content globs
├── vite.config.ts                  ← keep build/test integration intact
├── src/
│   ├── main.tsx                    ← root mount verification
│   ├── App.tsx                     ← route + provider verification
│   ├── index.css                   ← normalize baseline css
│   ├── pages/                      ← keep existing pages/routes intact
│   └── test-setup.ts               ← test environment baseline
```

### References

- [Source: _bmad-output/planning-artifacts/epics-stories.md#Story 6.1: React Frontend Setup]
- [Source: _bmad-output/planning-artifacts/prd.md#6. Technical Specifications]
- [Source: _bmad-output/planning-artifacts/prd.md#7. Deployment Strategy (Vercel)]
- [Source: winepooler/package.json]
- [Source: winepooler/src/main.tsx]
- [Source: winepooler/src/App.tsx]
- [Source: winepooler/src/index.css]
- [Source: winepooler/tailwind.config.js]
- [Source: winepooler/README.md]

## Dev Agent Record

### Agent Model Used

GPT-5.4

### Debug Log References

### Completion Notes List

- Validated existing Vite + React 19 + TS 5.9 + Tailwind 4 scaffold — all configs intact
- Replaced index.css template boilerplate (fixed-width #root, dark mode, template typography) with neutral Tailwind-first baseline
- Updated README.md from Vite template boilerplate to proper project docs with prerequisites, env vars, scripts, and project structure
- Added App boot smoke tests for home, register, and login routes
- Existing DashboardAccess tests already cover buyer/winery route mounting
- Tailwind content globs already scan all src files and index.html
- All 5 scripts (dev, build, lint, test, preview) present in package.json

### File List

- winepooler/README.md (modified)
- winepooler/src/index.css (modified)
- winepooler/src/__tests__/App.test.tsx (new)
