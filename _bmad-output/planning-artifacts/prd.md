# Product Requirements Document (PRD): WinePooler

**Version:** 1.2

**Status:** Draft

**Stack:** React.js, Supabase, Tailwind CSS, Typescript, Stripe Connect, Vercel

## 1. Executive Summary

WineSaaS is a B2B logistics and order aggregation platform designed for the wine industry. It solves the inefficiency of fragmented micro-orders by grouping demands from multiple HoReCa buyers (Restaurants, Hotels) and freelance Sommeliers into "Virtual Pallets." Wineries configure their own selling units — single bottles, cases (with a defined bottle count), or pallets (with a defined bottle or case count) — and the platform aggregates buyer demand against those units. This allows wineries to process bulk shipments while buyers access wholesale pricing.

## 2. Objectives & Success Metrics

- **Goal:** Bridge the gap between industrial production (pallets) and artisanal consumption (cases).
- **Success Metrics:**
    - **Pallet Fulfillment Rate:** Percentage of started pallets that reach the "Frozen" state.
    - **Average Order Value (AOV):** Increase in order size for wineries.
    - **Collaboration Index:** Number of orders facilitated by freelance Sommeliers.

## 3. Target Audience & User Personas

1. **The Buyer:** Includes restaurateurs and hotel managers who need quality wine at bulk prices without having to store 600 bottles of a single label.
2. **The Winery (Producer):** Wants to reduce administrative overhead (fewer invoices, fewer shipments) and credit risk.

## 4. Functional Requirements

### 4.1. User Management & Collaboration

- **Role-Based Access Control (RBAC):** Distinct interfaces for Wineries, Restaurateurs, and Sommeliers.
- **Collaboration Suite:** A "Relationship" system where a Restaurateur can grant "Purchasing" or "Drafting" permissions to a Sommelier.

### 4.2. Geographic Pooling Engine

- **Virtual Pallet Logic:** Orders are aggregated by Macro-Area and Winery, expressed in the winery's configured selling units (bottles, cases, or pallets).
- **Threshold Management:** Pallets transition from `Open` to `Frozen` once the winery-defined threshold is met, calculated against the configured selling unit hierarchy (e.g., a pallet of 60 cases × 6 bottles = 360 bottles).
- **Real-time Progress:** Live progress bars showing area-wide demand in the winery's configured selling unit.

### 4.3. Smart Marketplace

- **Dynamic Pricing:** Display of "Bulk Price" vs. "Retail Market Price" per selling unit (bottle, case, pallet) as configured by each winery.
- **Inventory Sync:** Real-time stock levels from Supabase/PostgreSQL.

### 4.4. Financial Automation (Fintech)

- **Pre-authorization (Escrow):** Funds are authorized on the buyer's card but only captured when the pallet hits the "Frozen" threshold.
- **Bulk Payouts:** Wineries receive a single bulk payment minus the platform commission.

### 4.5. Selling Unit Configuration

- **Unit Types:** A winery can offer products in three selling unit types: **single bottle**, **case**, and **pallet**.
- **Case Definition:** A winery defines a case by specifying the number of bottles it contains (e.g., 6, 12).
- **Pallet Definition:** A winery defines a pallet by specifying its composition — either a number of bottles or a number of cases (e.g., 60 cases of 6 bottles, or 360 loose bottles).
- **Per-Product Configuration:** Each wine product listed by a winery can have its own selling unit settings, enabling different packaging for different labels.
- **Unit Toggle:** A winery can enable or disable any of the three unit types per product (e.g., offer only cases and pallets, not single bottles).
- **Threshold Linkage:** The configured selling units feed directly into Virtual Pallet threshold calculations (see §4.2).

## 5. User Interface & Screen Requirements

- **Buyer Dashboard:** Map/Grid view of active pallets in the geofenced area.
- **Winery Portal:** Consolidated picking lists, revenue analytics, and a **Selling Unit Configuration** interface where wineries define bottle counts per case, composition per pallet, and toggle available unit types per product.

## 6. Technical Specifications

- **Frontend:** React.js with Tailwind CSS.
- **Backend:** Supabase (Auth, DB, Real-time).
- **Logic:** Edge Functions for pallet state transitions.
- **Payments:** Stripe Connect.

## 7. Deployment Strategy (Vercel)

### 7.1. Environment Hosting

- **Production:** Main branch deployment on Vercel with a custom domain.
- **Staging:** Automatic "Preview Deployments" for every Pull Request to ensure features work before merging.
- **Environment Variables:** Strict management of `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `STRIPE_SECRET_KEY`, and `STRIPE_WEBHOOK_SECRET` via Vercel Dashboard.

### 7.2. Performance & Optimization

- **Edge Network:** Leveraging Vercel's Global Edge Network to minimize latency for real-time updates.
- **Image Optimization:** Use of Vercel Image Optimization for high-quality wine bottle renders without sacrificing load speed.
- **Serverless Functions:** Offloading heavy computations (like generating PDF manifests for wineries) to Vercel Serverless Functions if they exceed Supabase Edge Function limits.

### 7.3. CI/CD Pipeline

- **GitHub Integration:** Automatic triggers on push.
- **Build Checks:** Linting and type-checking (TypeScript) must pass before Vercel completes a deployment.
- **Monitoring:** Vercel Analytics and Speed Insights to monitor Core Web Vitals in real-time.

## 8. Non-Functional Requirements

- **Concurrency:** Support for simultaneous updates to pallet counters.
- **Security:** Supabase Row Level Security (RLS) and encrypted environment variables on Vercel.
- **Scalability:** Expansion of geographic clusters via configuration.

## 9. Roadmap

- **Phase 1 (MVP):** Core pooling logic and Vercel setup.
- **Phase 2:** Sommelier-Restaurateur tools and Stripe integration.
- **Phase 3:** Automated logistics documentation (DDT).