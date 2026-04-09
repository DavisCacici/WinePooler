# Deferred Work

## Deferred from: code review of story_1.1 (2026-04-03)

- Supabase client init crashes on missing env vars [client.ts:3-4] — no runtime guard for VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY
- Password policy weak (6-char min, no complexity) — Supabase server-side policy is the real enforcement point
- Client-side role metadata trusted without server enforcement [auth.ts:24] — needs server-side RLS/claims to prevent privilege escalation
- Unknown role silently navigates to `/` on login [Login.tsx:42] — no explicit denial or remediation path
- Validation logic duplicated across Register/Login — guarantees drift over time
- Test coverage gaps: Login, auth.ts, role normalization have no unit tests
- ROLE_ROUTES typed as `Record<string, string>` instead of `Record<AppRole, string>` [Login.tsx:5]
