# Story 6.7: Modern Responsive UI with Dual-Theme System

Status: ready-for-dev

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a platform user (Buyer or Winery),
I want a beautiful, modern, and responsive interface with Light and Dark theme support,
so that I can work comfortably across devices and lighting conditions.

## Acceptance Criteria

1. **Design Token System**
   Given the platform uses Tailwind CSS v4
   When the design token system is implemented
   Then a semantic color palette is defined via CSS custom properties in `index.css` (e.g., `--color-primary`, `--color-surface`, `--color-text`, `--color-border`, `--color-accent`, `--color-success`, `--color-warning`, `--color-error`)
   And `tailwind.config.js` extends theme colors to reference these tokens (e.g., `surface: 'var(--color-surface)'`)
   And all existing hardcoded color classes across ALL components and pages are replaced with semantic token classes
   And semantic tokens cover: surfaces, text (primary/secondary/muted), borders, interactive states (hover/focus/active), status colors (success/warning/error/info)

2. **Dual-Theme Implementation**
   Given the design tokens are in place
   When I toggle between Light and Dark themes
   Then all UI surfaces, text, borders, badges, progress bars, and interactive elements update correctly
   And Dark theme uses true dark colors (not simple CSS inversion) designed for data-heavy screens and dim environments
   And Light theme maintains a clean, professional look with proper contrast ratios (WCAG AA minimum — 4.5:1 for normal text, 3:1 for large text)
   And both themes render correctly across ALL existing views: Home, Login, Register, BuyerDashboard, WineryDashboard, profile forms, pallet modals, and all badge/notification components

3. **Theme Provider and Toggle**
   Given I am on any page of the platform
   When the app loads
   Then the theme defaults to my system preference (`prefers-color-scheme: dark`)
   And a theme toggle control is accessible from the layout header
   And my theme selection is persisted in `localStorage` and restored on subsequent visits
   And theme switching is instant with no flash of unstyled content (FOUC) on page load
   And theme class is applied to `<html>` element (for Tailwind `darkMode: 'class'` strategy)

4. **Responsive Layout Shell**
   Given I access the platform from any device (desktop, tablet, mobile)
   When a page renders
   Then a shared layout shell wraps authenticated pages with persistent header and role-appropriate navigation
   And the header displays the app logo, role indicator, theme toggle, and user menu
   And navigation collapses to a hamburger/slide-out menu on viewports under 768px
   And all content areas, card grids, data tables, and forms adapt gracefully to screen width
   And touch targets meet minimum 44×44px on mobile devices
   And no horizontal scrolling occurs at any supported viewport width (320px minimum)
   And unauthenticated pages (Home, Login, Register) use a minimal layout without dashboard navigation

5. **Component Modernization**
   Given the shared layout and theme system are in place
   When existing hand-written UI elements are refactored
   Then a consistent set of reusable base components is created: `Button`, `Input`, `Badge`, `Card`, `Modal`
   And all base components support both Light and Dark themes via the design token system
   And all base components accept standard HTML attributes plus component-specific variants (e.g., Button: `variant="primary|secondary|danger|ghost"`, `size="sm|md|lg"`)
   And existing pages/components are refactored to use the base components instead of inline Tailwind classes for interactive elements
   And visual consistency is maintained across Buyer and Winery views
   And `App.css` (Vite boilerplate) is deleted entirely

## Tasks / Subtasks

- [ ] Define and implement design token system (AC: 1)
  - [ ] Define semantic color palette for Light theme in `:root` CSS custom properties
  - [ ] Define semantic color palette for Dark theme in `[data-theme="dark"]` or `.dark` selector
  - [ ] Token categories to define:
    - Surfaces: `--color-surface`, `--color-surface-alt`, `--color-surface-elevated`
    - Text: `--color-text-primary`, `--color-text-secondary`, `--color-text-muted`, `--color-text-inverse`
    - Borders: `--color-border`, `--color-border-strong`
    - Interactive: `--color-primary`, `--color-primary-hover`, `--color-primary-active`, `--color-primary-text`
    - Status: `--color-success`, `--color-warning`, `--color-error`, `--color-info` (with bg/text/border variants)
    - Accents: `--color-accent` (buyer: blue/emerald tones, winery: amber/stone tones per current convention)
    - Focus: `--color-focus-ring`
  - [ ] Update `tailwind.config.js` to map semantic tokens to Tailwind utilities
  - [ ] Update `index.css` with token definitions (preserve existing Tailwind directives and font-family)

- [ ] Create ThemeProvider and toggle (AC: 3)
  - [ ] Create `src/lib/theme/ThemeContext.tsx` with:
    - System preference detection via `matchMedia('(prefers-color-scheme: dark)')`
    - `localStorage` persistence under key `winepooler-theme`
    - Applies `data-theme` attribute on `<html>` element
    - Provides `theme`, `setTheme`, `toggleTheme` via React context
  - [ ] Create `src/lib/theme/useTheme.ts` convenience hook
  - [ ] Create `src/components/ui/ThemeToggle.tsx` — sun/moon icon toggle button
  - [ ] Add inline script to `index.html` `<head>` to set `data-theme` before React hydration (prevents FOUC)
  - [ ] Wrap app with `<ThemeProvider>` in `App.tsx` (inside `AuthProvider`)

- [ ] Build responsive layout shell (AC: 4)
  - [ ] Create `src/components/layout/Header.tsx`:
    - App logo/brand
    - Role indicator badge (Buyer/Winery)
    - Theme toggle
    - User menu (profile link, logout)
    - Responsive: collapses to hamburger on mobile
  - [ ] Create `src/components/layout/MobileNav.tsx`:
    - Slide-out or overlay navigation drawer
    - Same navigation items as desktop
    - Backdrop overlay, close on outside click or Escape key
  - [ ] Create `src/components/layout/LayoutShell.tsx`:
    - Wraps `<Header>` + `<main>` content area
    - Optional sidebar for desktop (can be added later)
    - Takes `children` prop for page content
  - [ ] Integrate LayoutShell into `App.tsx`:
    - Authenticated routes render inside `<LayoutShell>`
    - Unauthenticated routes (Home, Login, Register) render without LayoutShell
  - [ ] Remove the outer `<div className="min-h-screen bg-gray-50">` from App.tsx; replace with token-based surface color on LayoutShell

- [ ] Create reusable base UI components (AC: 5)
  - [ ] `src/components/ui/Button.tsx`:
    - Variants: `primary`, `secondary`, `danger`, `ghost`, `outline`
    - Sizes: `sm`, `md`, `lg`
    - States: loading (spinner), disabled
    - Forwards ref, accepts standard button attributes
  - [ ] `src/components/ui/Input.tsx`:
    - Label integration, error message display
    - Sizes: `sm`, `md`, `lg`
    - Forwards ref, accepts standard input attributes
  - [ ] `src/components/ui/Badge.tsx`:
    - Variants: `default`, `success`, `warning`, `error`, `info`
    - Sizes: `sm`, `md`
    - Used by PaymentStatusBadge, InventoryStatusBadge, PalletPricingBadge
  - [ ] `src/components/ui/Card.tsx`:
    - Surface wrapper with border, shadow, padding
    - Optional header/footer sections
    - Used for dashboard cards, pallet cards, profile sections
  - [ ] `src/components/ui/Modal.tsx`:
    - Overlay + centered dialog
    - Close on Escape key and backdrop click
    - Focus trap for accessibility
    - Used by AddOrderModal, CreatePalletModal

- [ ] Migrate all existing components and pages to design tokens (AC: 1, 2, 5)
  - [ ] `App.tsx` — remove `bg-gray-50`, use `bg-surface`
  - [ ] `Home.tsx` — replace `text-gray-900`, `text-gray-600`, `bg-blue-600`, `bg-gray-600` etc.
  - [ ] `Login.tsx` — replace `text-gray-700`, `border-gray-300`, `bg-blue-600`, `text-red-500`, `text-blue-600` etc.
  - [ ] `Register.tsx` — same as Login
  - [ ] `DashboardRouter.tsx` — replace `text-gray-600`
  - [ ] `ProtectedDashboardRoute.tsx` — replace `text-gray-600`
  - [ ] `BuyerDashboard.tsx` — replace `bg-slate-50`, `bg-white`, `ring-slate-200`, `text-emerald-700`, `text-slate-900`, `text-slate-600`, `border-slate-200` etc.
  - [ ] `WineryDashboard.tsx` — replace `bg-stone-50`, `bg-white`, `ring-stone-200`, `text-amber-700`, `text-stone-900`, `text-stone-600` etc.
  - [ ] `FreezeNotification.tsx` — replace `bg-slate-900`, `text-amber-300`, `text-slate-200`, `ring-amber-400/60`
  - [ ] `PaymentStatusBadge.tsx` — refactor to use base `Badge` component with semantic variants
  - [ ] `InventoryStatusBadge.tsx` — refactor to use base `Badge` component
  - [ ] `PalletPricingBadge.tsx` — refactor to use base `Badge` component
  - [ ] `StripeElementsProvider.tsx` — replace any hardcoded colors
  - [ ] `BuyerProfileForm.tsx` — replace form field colors
  - [ ] `AreaSelectionPage.tsx` — replace card/button colors
  - [ ] `PurchasingPreferencesForm.tsx` — replace form field colors
  - [ ] `AddOrderModal.tsx` — refactor to use base `Modal` component
  - [ ] `CreatePalletModal.tsx` — refactor to use base `Modal` component
  - [ ] Delete `App.css` entirely

- [ ] Add tests for theme and layout components (AC: 1, 2, 3, 4, 5)
  - [ ] `src/lib/theme/__tests__/ThemeContext.test.tsx` — system preference detection, localStorage persistence, toggle behavior
  - [ ] `src/components/ui/__tests__/Button.test.tsx` — variants, sizes, disabled/loading states
  - [ ] `src/components/ui/__tests__/Badge.test.tsx` — variants, content rendering
  - [ ] `src/components/ui/__tests__/Card.test.tsx` — renders children, header/footer slots
  - [ ] `src/components/ui/__tests__/Modal.test.tsx` — open/close, escape key, backdrop click
  - [ ] `src/components/layout/__tests__/Header.test.tsx` — renders logo, role badge, theme toggle, user menu
  - [ ] `src/components/layout/__tests__/LayoutShell.test.tsx` — renders header + children
  - [ ] `src/components/layout/__tests__/MobileNav.test.tsx` — open/close, navigation items
  - [ ] Update existing tests that assert on hardcoded color classes (e.g., `bg-white`, `text-gray-900`) to use semantic classes

## Dev Notes

### Architecture & Technical Context

- **Tailwind CSS v4** with `@tailwindcss/postcss` plugin (NOT v3 config). PostCSS config is at `postcss.config.js` with `@tailwindcss/postcss` + `autoprefixer`.
- **Current tailwind.config.js** is bare-bones: empty `theme.extend`, no `darkMode` setting, no plugins. Needs `darkMode: 'class'` (or `'selector'` for v4) and semantic color mapping.
- **React 19** — functional components with hooks only. No class components.
- **React Router v7** — flat route structure, no nested layouts currently.
- **No component library** installed — everything is hand-written Tailwind. This story creates the in-house base components. Do NOT add shadcn/ui, Radix, MUI, or any external component library.
- **No icon library** installed — for ThemeToggle sun/moon icons, use inline SVG or install `lucide-react` (lightweight).
- **Current App.tsx** wraps everything in `<div className="min-h-screen bg-gray-50">` — this hardcoded background must be replaced with LayoutShell.

### Tailwind v4 Dark Mode Strategy

Tailwind v4 uses CSS-first configuration. The recommended approach:
- Add `darkMode: 'selector'` to `tailwind.config.js` (v4 calls it 'selector', not 'class')
- Apply `data-theme="dark"` on `<html>` element — then use `dark:` variant classes OR CSS custom properties
- **Preferred approach for this project**: CSS custom properties toggled by `data-theme` attribute, so Tailwind utilities reference variables rather than requiring `dark:` prefixes on every class. This is more maintainable for a project without an external component library.

### Design Token Color Palette (Recommended)

**Light Theme:**
```css
:root {
  --color-surface: #ffffff;
  --color-surface-alt: #f8fafc;       /* slate-50 equivalent */
  --color-surface-elevated: #ffffff;
  --color-text-primary: #0f172a;       /* slate-900 */
  --color-text-secondary: #475569;     /* slate-600 */
  --color-text-muted: #94a3b8;         /* slate-400 */
  --color-border: #e2e8f0;             /* slate-200 */
  --color-border-strong: #cbd5e1;      /* slate-300 */
  --color-primary: #2563eb;            /* blue-600 */
  --color-primary-hover: #1d4ed8;      /* blue-700 */
  --color-primary-text: #ffffff;
  --color-focus-ring: #3b82f6;         /* blue-500 */
  --color-success: #059669;            /* emerald-600 */
  --color-success-bg: #ecfdf5;         /* emerald-50 */
  --color-warning: #d97706;            /* amber-600 */
  --color-warning-bg: #fffbeb;         /* amber-50 */
  --color-error: #dc2626;              /* red-600 */
  --color-error-bg: #fef2f2;           /* red-50 */
}
```

**Dark Theme:**
```css
[data-theme="dark"] {
  --color-surface: #0f172a;            /* slate-900 */
  --color-surface-alt: #1e293b;        /* slate-800 */
  --color-surface-elevated: #334155;   /* slate-700 */
  --color-text-primary: #f1f5f9;       /* slate-100 */
  --color-text-secondary: #94a3b8;     /* slate-400 */
  --color-text-muted: #64748b;         /* slate-500 */
  --color-border: #334155;             /* slate-700 */
  --color-border-strong: #475569;      /* slate-600 */
  --color-primary: #3b82f6;            /* blue-500 */
  --color-primary-hover: #60a5fa;      /* blue-400 */
  --color-primary-text: #ffffff;
  --color-focus-ring: #60a5fa;         /* blue-400 */
  --color-success: #34d399;            /* emerald-400 */
  --color-success-bg: #064e3b;         /* emerald-900 */
  --color-warning: #fbbf24;            /* amber-400 */
  --color-warning-bg: #78350f;         /* amber-900 */
  --color-error: #f87171;              /* red-400 */
  --color-error-bg: #7f1d1d;           /* red-900 */
}
```

### FOUC Prevention Script

Add to `index.html` `<head>` before React bundle:

```html
<script>
  (function() {
    var theme = localStorage.getItem('winepooler-theme');
    if (!theme) {
      theme = window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
    }
    document.documentElement.setAttribute('data-theme', theme);
  })();
</script>
```

### Existing Color Mapping (What to Replace)

| Current Hardcoded | Semantic Token | Usage |
|-------------------|---------------|-------|
| `bg-gray-50`, `bg-slate-50`, `bg-stone-50` | `bg-surface-alt` | Page backgrounds |
| `bg-white` | `bg-surface` | Cards, panels |
| `text-gray-900`, `text-slate-900`, `text-stone-900` | `text-primary` | Headings |
| `text-gray-600`, `text-slate-600`, `text-stone-600` | `text-secondary` | Body text |
| `text-gray-400`, `text-slate-400` | `text-muted` | Helper text |
| `border-gray-300`, `border-slate-200`, `border-stone-200` | `border-default` | Form inputs, dividers |
| `bg-blue-600` | `bg-primary` | Primary buttons |
| `hover:bg-blue-700` | `hover:bg-primary-hover` | Primary button hover |
| `text-red-500` | `text-error` | Error messages |
| `bg-emerald-100 text-emerald-800` | `bg-success-bg text-success` | Success badges |
| `bg-amber-100 text-amber-800` | `bg-warning-bg text-warning` | Warning badges |
| `bg-red-100 text-red-800` | `bg-error-bg text-error` | Error badges |
| `ring-slate-200`, `ring-stone-200` | `ring-border` | Focus rings |
| `focus:ring-blue-500` | `focus:ring-focus` | Focus indicators |

### Role-Specific Accents

The current codebase uses different color families per role:
- **Buyer**: slate (neutral) + emerald (success/pricing) + blue (primary actions)
- **Winery**: stone (neutral) + amber (accent) + blue (primary actions)

Maintain this role distinction through additional role-accent tokens or contextual CSS classes (e.g., `.role-buyer`, `.role-winery`) rather than eliminating the visual difference.

### Previous Story Learnings

- Story 6.1: "Replacing `index.css` aggressively can unintentionally break visual rhythm in existing dashboard pages. Keep changes minimal."
- Story 6.1: "Removing template CSS without preserving `@tailwind` directives will silently break styles"
- Story 6.1: "Ensure base CSS does not force dark mode by default unless explicitly required by product UX"
- Story 6.1: "App.css is acknowledged as Vite boilerplate to be removed"
- Story 6.2: "Missing `removeChannel` cleanup can cause duplicate realtime handlers" — ensure LayoutShell doesn't interfere with existing realtime subscriptions
- UX Spec: "Dark Mode as Professional Feature — true dark mode designed for long working sessions, dim environments, and data-heavy screens positions WinePooler as a serious B2B tool"
- UX Spec: "Professional Density, Not Consumer Simplicity — meaningful data density with progressive disclosure"

### Regression Risks

- **Highest risk**: Replacing hardcoded colors across ALL components simultaneously can break visual consistency if token values are wrong. Implement tokens first, migrate one component at a time, verify visually.
- **Test breakage**: Existing tests assert on specific CSS classes (e.g., `toHaveClass('bg-white')`). These tests must be updated to assert on semantic classes — batch this change last.
- **LayoutShell wrapping authenticated routes** must not break existing realtime subscriptions in BuyerDashboard (channel setup in `useEffect`).
- **Index.css changes** must preserve `@tailwind base; @tailwind components; @tailwind utilities;` (or Tailwind v4 equivalent `@import "tailwindcss"`) — removing these breaks all styling.
- **FreezeNotification** uses a deliberately dark background (`bg-slate-900`) for contrast even in light mode — ensure this intentional design is preserved in the token mapping.
- **AddOrderModal and CreatePalletModal** have complex form flows — modal refactoring must preserve all state management and validation logic.

### Testing Strategy

- **Theme tests**: Mock `matchMedia` and `localStorage` to test system preference detection, manual toggle, and persistence.
- **Component tests**: Render each base component with all variants/sizes and snapshot or assert expected classes.
- **Layout tests**: Verify LayoutShell renders header + children, mobile nav toggling.
- **Regression tests**: After migration, run ALL existing tests to catch class assertion failures. Update broken assertions.
- **Visual validation**: After implementation, manually verify every view in both themes on desktop and mobile viewport.

### Project Structure Notes

```text
winepooler/
├── index.html                                ← MODIFY (add FOUC prevention script)
├── tailwind.config.js                        ← MODIFY (darkMode, semantic colors)
├── src/
│   ├── index.css                             ← MODIFY (add CSS custom properties)
│   ├── App.css                               ← DELETE
│   ├── App.tsx                               ← MODIFY (ThemeProvider, LayoutShell)
│   ├── lib/
│   │   └── theme/
│   │       ├── ThemeContext.tsx               ← NEW
│   │       ├── useTheme.ts                   ← NEW
│   │       └── __tests__/
│   │           └── ThemeContext.test.tsx      ← NEW
│   ├── components/
│   │   ├── ui/
│   │   │   ├── Button.tsx                    ← NEW
│   │   │   ├── Input.tsx                     ← NEW
│   │   │   ├── Badge.tsx                     ← NEW
│   │   │   ├── Card.tsx                      ← NEW
│   │   │   ├── Modal.tsx                     ← NEW
│   │   │   ├── ThemeToggle.tsx               ← NEW
│   │   │   └── __tests__/
│   │   │       ├── Button.test.tsx           ← NEW
│   │   │       ├── Badge.test.tsx            ← NEW
│   │   │       ├── Card.test.tsx             ← NEW
│   │   │       └── Modal.test.tsx            ← NEW
│   │   ├── layout/
│   │   │   ├── Header.tsx                    ← NEW
│   │   │   ├── LayoutShell.tsx               ← NEW
│   │   │   ├── MobileNav.tsx                 ← NEW
│   │   │   └── __tests__/
│   │   │       ├── Header.test.tsx           ← NEW
│   │   │       ├── LayoutShell.test.tsx      ← NEW
│   │   │       └── MobileNav.test.tsx        ← NEW
│   │   ├── notifications/
│   │   │   └── FreezeNotification.tsx        ← MODIFY (semantic tokens)
│   │   ├── pallets/
│   │   │   ├── InventoryStatusBadge.tsx      ← MODIFY (use Badge base)
│   │   │   └── PalletPricingBadge.tsx        ← MODIFY (use Badge base)
│   │   └── payments/
│   │       ├── PaymentStatusBadge.tsx        ← MODIFY (use Badge base)
│   │       └── StripeElementsProvider.tsx    ← MODIFY (semantic tokens)
│   └── pages/
│       ├── Home.tsx                          ← MODIFY (semantic tokens)
│       ├── Login.tsx                         ← MODIFY (semantic tokens, use Input/Button)
│       ├── Register.tsx                      ← MODIFY (semantic tokens, use Input/Button)
│       ├── dashboards/
│       │   ├── BuyerDashboard.tsx            ← MODIFY (semantic tokens, use Card)
│       │   ├── WineryDashboard.tsx           ← MODIFY (semantic tokens, use Card)
│       │   ├── DashboardRouter.tsx           ← MODIFY (semantic tokens)
│       │   └── ProtectedDashboardRoute.tsx   ← MODIFY (semantic tokens)
│       ├── pallets/
│       │   ├── AddOrderModal.tsx             ← MODIFY (use Modal base)
│       │   └── CreatePalletModal.tsx         ← MODIFY (use Modal base)
│       └── profile/
│           ├── AreaSelectionPage.tsx          ← MODIFY (semantic tokens, use Card)
│           ├── BuyerProfileForm.tsx           ← MODIFY (semantic tokens, use Input/Button)
│           └── PurchasingPreferencesForm.tsx  ← MODIFY (semantic tokens, use Input/Button)
```

### References

- [Source: _bmad-output/planning-artifacts/epics-stories.md#Story 6.7: Modern Responsive UI with Dual-Theme System]
- [Source: _bmad-output/planning-artifacts/prd.md#6. Technical Specifications — Frontend: React.js + Tailwind CSS]
- [Source: _bmad-output/planning-artifacts/ux-design-specification.md#Platform Strategy — Dual theme, responsive]
- [Source: _bmad-output/planning-artifacts/ux-design-specification.md#Key Design Challenges — Professional Dual-Theme System]
- [Source: _bmad-output/planning-artifacts/ux-design-specification.md#Design Opportunities — Dark Mode as Professional Feature]
- [Source: _bmad-output/planning-artifacts/ux-design-specification.md#Experience Principles — Professional Density]
- [Source: _bmad-output/planning-artifacts/Epic6/story_6.1.md — index.css baseline, App.css boilerplate]
- [Source: winepooler/tailwind.config.js — current bare-bones config]
- [Source: winepooler/postcss.config.js — @tailwindcss/postcss plugin]
- [Source: winepooler/src/index.css — current minimal styles]
- [Source: winepooler/src/App.tsx — current routing/layout structure]
- [Source: winepooler/src/App.css — Vite boilerplate to delete]
- [Source: winepooler/package.json — React 19, Tailwind 4, Vite 8]

## Dev Agent Record

### Agent Model Used

### Debug Log References

### Completion Notes List

### File List
