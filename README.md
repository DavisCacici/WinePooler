# WinePooler

Wine order pooling platform — React + TypeScript + Vite frontend with Supabase backend and Stripe payments.

## Prerequisites

- Node.js 20+
- npm 10+

## Getting Started

```bash
cd winepooler
npm install
npm run dev
```

The app will be available at `http://localhost:5173`.

## Environment Variables

Create a `.env` file in the `winepooler/` directory with the following variables:

### Frontend (Vite — exposed to browser)

| Variable | Description |
|---|---|
| `VITE_SUPABASE_URL` | Supabase project URL |
| `VITE_SUPABASE_ANON_KEY` | Supabase anonymous (public) key |
| `VITE_STRIPE_PUBLISHABLE_KEY` | Stripe publishable key (test mode for dev) |

> **Security:** Do NOT add server-side secrets (service role keys, Stripe secret keys) as `VITE_` prefixed variables. They would be exposed in the browser bundle.

### Backend / Edge Functions (server-side only)

These are configured in Supabase project settings or Vercel environment variables — never in the frontend `.env`:

- `SUPABASE_SERVICE_ROLE_KEY`
- `STRIPE_SECRET_KEY`
- `STRIPE_WEBHOOK_SECRET`

## Scripts

| Command | Description |
|---|---|
| `npm run dev` | Start Vite dev server with HMR |
| `npm run build` | Type-check and build for production |
| `npm run lint` | Run ESLint |
| `npm run test` | Run Vitest test suite |
| `npm run preview` | Preview production build locally |

## Tech Stack

- **React 19** with TypeScript 5.9
- **Vite 8** for build tooling
- **Tailwind CSS 4** for styling
- **Supabase** for Auth, Database, Real-time, and Edge Functions
- **Stripe Connect** for payment processing
- **Vitest** + Testing Library for tests

## Project Structure

```
winepooler/
├── src/
│   ├── main.tsx              ← React root mount with BrowserRouter
│   ├── App.tsx               ← Routes + AuthProvider
│   ├── index.css             ← Tailwind base + global styles
│   ├── components/           ← Shared UI components
│   ├── lib/                  ← Supabase client, auth, queries, Stripe
│   └── pages/                ← Route pages (Home, Login, Register, Dashboards)
├── supabase/
│   ├── migrations/           ← Database schema migrations
│   └── functions/            ← Edge Functions (payment, webhooks, payouts)
├── package.json
├── vite.config.ts
├── tailwind.config.js
└── tsconfig.json
```

## Supabase Setup

### Local Development

```bash
supabase start          # Start local Supabase
supabase db reset       # Apply all migrations from scratch
```

### Migration Workflow

Migrations live in `supabase/migrations/` and follow timestamp ordering. Dependencies:

1. `macro_areas` (base geography table)
2. `buyer_profiles` / `winery_profiles` (user profiles, FK to macro_areas)
3. `virtual_pallets` (pallet aggregation, FK to winery_profiles + macro_areas)
4. `pallet_orders` + RPC functions (order placement + auto-freeze)
5. `wine_inventory` (winery stock tracking)
6. `payment_authorizations` (escrow pre-auth)
7. `pallet_payouts` + `pallet_payout_items` (winery payouts)

To create a new migration:

```bash
supabase migration new <description>
```

### Rollback (dev only)

```bash
supabase db reset   # Drops and recreates from migrations
```

> **Warning:** `db reset` destroys all local data. Use in development only.

### Verifying Realtime

1. Open two browser sessions with different user accounts in the same area
2. Place an order on a pallet in one session
3. Check that the pallet progress updates in the other session without refresh

## Stripe Setup

### Test Mode

1. Create a Stripe account at [dashboard.stripe.com](https://dashboard.stripe.com)
2. Use test mode keys (prefixed `pk_test_` and `sk_test_`)
3. Add `VITE_STRIPE_PUBLISHABLE_KEY=pk_test_...` to your `.env` file

### Webhook Local Testing

```bash
# Install Stripe CLI
stripe login
stripe listen --forward-to http://localhost:54321/functions/v1/stripe-webhook
```

The CLI will print a webhook signing secret (`whsec_...`). Set it as `STRIPE_WEBHOOK_SECRET` in your Supabase Edge Function env.

### Key Rotation

1. Generate new keys in Stripe Dashboard > API keys
2. Update env vars in Supabase and Vercel
3. Update webhook signing secret if endpoint is regenerated
4. Deploy and verify with a test payment

### Edge Functions (Payment)

| Function | Purpose |
|---|---|
| `create-escrow-payment-intent` | Creates manual-capture PaymentIntent |
| `commit-authorized-order` | Validates PI status + commits order to DB |
| `capture-frozen-pallet-payments` | Captures all authorized PIs when pallet freezes |
| `stripe-webhook` | Verifies signatures, syncs payment state |
| `process-pallet-payout` | Transfers funds to winery connected account |
| `confirm-pallet-fulfillment` | Transitions frozen→completed, triggers payout |

## Deployment (Vercel)

### Setup

1. Connect repository to Vercel
2. Set **Root Directory** to `winepooler`
3. Framework preset: **Vite**
4. Build command: `npm run build`
5. Output directory: `dist`
6. Install command: `npm ci`

### Environment Variables in Vercel

Configure in Vercel Dashboard > Settings > Environment Variables:

| Variable | Scope | Description |
|---|---|---|
| `VITE_SUPABASE_URL` | Preview + Production | Supabase project URL |
| `VITE_SUPABASE_ANON_KEY` | Preview + Production | Supabase anon key |
| `VITE_STRIPE_PUBLISHABLE_KEY` | Preview + Production | Stripe publishable key |

> Use separate Supabase/Stripe projects for Preview vs Production if needed.

### Custom Domain

1. Add domain in Vercel Dashboard > Settings > Domains
2. Configure DNS records as shown by Vercel (A record for apex, CNAME for `www`)
3. SSL is auto-provisioned by Vercel
4. Verify all routes work with deep links (e.g., `/dashboard/buyer`)

### SPA Routing

`vercel.json` includes a catch-all rewrite to `index.html` for client-side routing.

### CI/CD

GitHub Actions workflow (`.github/workflows/ci.yml`) runs on PRs and pushes to `main`:
- `npm ci` → `npm run lint` → `npm run build` → `npm run test -- --run`

Failed checks block deployment.

### Rollback

1. Go to Vercel Dashboard > Deployments
2. Find the last healthy deployment
3. Click "..." > "Promote to Production"

### Troubleshooting

- **Blank page on deploy**: Check that env vars are set in Vercel (especially `VITE_SUPABASE_URL`)
- **Deep link 404s**: Verify `vercel.json` rewrite is present
- **Auth failures in preview**: Ensure preview Supabase URL matches the preview environment
