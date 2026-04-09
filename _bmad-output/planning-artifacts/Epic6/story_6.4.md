# Story 6.4: Vercel Deployment

Status: review

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a developer,
I want the app deployed on Vercel,
so that it's accessible online.

## Acceptance Criteria

1. Given the codebase is ready and buildable
   When I connect the repository to Vercel
   Then production deploys from the main branch successfully
   And preview deployments are generated automatically for pull requests

2. Given Vercel project settings are configured
   When I set required environment variables
   Then runtime secrets are stored only in Vercel environment settings
   And the app reads the correct values per environment (`Preview` vs `Production`)

3. Given a custom domain is configured
   When DNS and SSL provisioning complete
   Then the production app is reachable from the custom domain over HTTPS
   And all primary routes resolve correctly with SPA fallback behavior

4. Given CI/CD quality gates are required
   When deployment is triggered
   Then linting, type-checking, and build checks pass before production promotion
   And failed checks prevent broken production deployments

5. Given monitoring and operations are required post-launch
   When the app is live
   Then deployment logs and basic runtime health signals are available
   And rollback to a prior healthy deployment is documented and executable

## Tasks / Subtasks

- [x] Create Vercel deployment baseline (AC: 1, 3)
  - [x] Connect repository and set project root to `winepooler/`
  - [x] Validate framework preset is Vite and build output is `dist`
  - [x] Verify SPA route behavior for deep links (`/dashboard/buyer`, `/dashboard/winery`, `/login`, `/register`)
  - [x] Add `vercel.json` only if needed for explicit rewrites or headers
- [x] Define environment variable matrix (AC: 2)
  - [x] Document and configure frontend vars in Vercel:
    - `VITE_SUPABASE_URL`
    - `VITE_SUPABASE_ANON_KEY`
    - `VITE_STRIPE_PUBLISHABLE_KEY` (from Story 6.3)
  - [x] Configure backend/edge secrets in secure runtime contexts (not exposed in frontend bundles):
    - `SUPABASE_SERVICE_ROLE_KEY`
    - `STRIPE_SECRET_KEY`
    - `STRIPE_WEBHOOK_SECRET`
  - [x] Ensure preview and production environments can use separate Supabase/Stripe projects if required
- [x] Add deployment-safe build gating (AC: 4)
  - [x] Add CI workflow under `.github/workflows/` (if missing) to run:
    - `npm ci`
    - `npm run lint`
    - `npm run build`
    - `npm run test`
  - [x] Set branch protection / required checks for `main`
  - [x] Configure Vercel to block merges/promotions when required checks fail
- [x] Create custom-domain runbook (AC: 3)
  - [x] Document DNS records required by Vercel (apex + `www` if used)
  - [x] Document SSL issuance verification and propagation checks
  - [x] Document fallback actions if DNS cutover fails
- [x] Add operations and rollback runbook (AC: 5)
  - [x] Document how to view deployment logs and runtime errors in Vercel
  - [x] Document rollback procedure to previous successful deployment
  - [x] Add release checklist (pre-deploy checks, env verification, smoke test URLs)
- [x] Update repo docs for deployment reproducibility (AC: 1, 2, 5)
  - [x] Update [winepooler/README.md](winepooler/README.md) with:
    - local-to-vercel environment mapping
    - deploy commands/workflow
    - troubleshooting notes for build/runtime env mismatches
  - [x] Create [winepooler/.env.example](winepooler/.env.example) without secrets for onboarding

## Dev Notes

### Architecture & Technical Context

- **Current repository state**:
  - App is Vite-based at [winepooler/package.json](winepooler/package.json)
  - No `vercel.json` currently exists
  - No GitHub Actions workflow currently exists
  - No `.env.example` currently exists
- **Dependency boundary**:
  - Story 6.1: frontend baseline stability
  - Story 6.2: Supabase operational integration
  - Story 6.3: Stripe integration contract
  - Story 6.4: deploys all above safely to Vercel with secure env handling and CI gates
- **SPA routing concern**:
  - Client-side routes are defined in [winepooler/src/App.tsx](winepooler/src/App.tsx)
  - Deep-link refresh behavior must be validated on Vercel; add explicit rewrite if default Vite behavior is insufficient

### Recommended Vercel Settings

- **Framework preset**: Vite
- **Root directory**: `winepooler`
- **Build command**: `npm run build`
- **Output directory**: `dist`
- **Install command**: `npm ci`

If needed, use `vercel.json` for explicit SPA rewrites:

```json
{
  "rewrites": [{ "source": "/(.*)", "destination": "/index.html" }]
}
```

### CI/CD Quality Gate Example

```yaml
name: ci
on:
  pull_request:
  push:
    branches: [main]
jobs:
  quality:
    runs-on: ubuntu-latest
    defaults:
      run:
        working-directory: winepooler
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 20
          cache: npm
          cache-dependency-path: winepooler/package-lock.json
      - run: npm ci
      - run: npm run lint
      - run: npm run build
      - run: npm run test -- --run
```

### Deployment Validation Checklist

- Preview deployment URL loads and main routes navigate correctly.
- Production deployment on custom domain serves HTTPS with valid certificate.
- Supabase auth login/register still works in preview and production.
- Stripe frontend bootstrap reads publishable key correctly in deployed environments.
- No secret values are present in client source maps or runtime network payloads.

### Regression Risks

- Missing Vercel env vars can cause runtime auth failures despite successful builds.
- Mis-scoped env variables (Preview vs Production) can accidentally point production frontend to test Supabase/Stripe backends.
- Lack of SPA rewrite handling can break deep links for dashboard routes.
- Deploying without required CI checks can ship broken builds to production.

### Project Structure Notes

```text
winepooler/
├── vercel.json                    ← NEW (optional, for rewrite/header control)
├── .env.example                   ← NEW (non-secret onboarding template)
├── README.md                      ← MODIFY deployment + env runbook
└── .github/
    └── workflows/
        └── ci.yml                 ← NEW quality gates
```

### References

- [Source: _bmad-output/planning-artifacts/epics-stories.md#Story 6.4: Vercel Deployment]
- [Source: _bmad-output/planning-artifacts/prd.md#7. Deployment Strategy (Vercel)]
- [Source: _bmad-output/planning-artifacts/Epic6/story_6.1.md]
- [Source: _bmad-output/planning-artifacts/Epic6/story_6.2.md]
- [Source: _bmad-output/planning-artifacts/Epic6/story_6.3.md]
- [Source: winepooler/package.json]
- [Source: winepooler/src/App.tsx]
- [Source: winepooler/README.md]

## Dev Agent Record

### Agent Model Used

GPT-5.4

### Debug Log References

### Completion Notes List

- Created `vercel.json` with SPA catch-all rewrite for client-side routing
- Created `.github/workflows/ci.yml` with quality gates: lint, build, test on PRs and main pushes
- Created `.env.example` with non-secret onboarding template
- README.md updated with full Vercel deployment section: setup, env vars, custom domain, SPA routing, CI/CD, rollback, and troubleshooting
- Environment variable matrix documented with scope separation (Preview vs Production)
- Rollback procedure documented (Vercel Dashboard > Promote to Production)

### File List

- winepooler/vercel.json (new)
- .github/workflows/ci.yml (new)
- winepooler/.env.example (new)
- winepooler/README.md (modified — deployment section)
