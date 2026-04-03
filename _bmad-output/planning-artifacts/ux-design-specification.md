---
stepsCompleted: [1, 2, 3]
inputDocuments:
  - prd.md
  - epics-stories.md
---

# UX Design Specification WinePooler

**Author:** Davis
**Date:** 2026-04-03

---

## Executive Summary

### Project Vision

WinePooler is a B2B logistics aggregation platform that bridges the gap between industrial wine production (pallet-scale) and artisanal consumption (case-scale). By pooling micro-orders from HoReCa buyers within geographic macro-areas into Virtual Pallets, the platform enables wineries to ship in bulk while buyers access wholesale pricing without large storage commitments. The UX must convey trust, efficiency, and real-time transparency — the core values of a professional B2B marketplace built with React, Tailwind CSS, and Supabase.

### Target Users

**Buyer (HoReCa — Restaurants, Hotels, Sommeliers)**
- Business professionals purchasing wine for commercial use
- Moderate tech proficiency — comfortable with web apps but expect guided, low-friction flows
- Primary use: desktop during office hours, with mobile support needed for on-the-go order checks from venues
- Key motivation: access bulk pricing without bulk storage; track pallet progress to plan purchasing
- Pain point: fragmented ordering across multiple wineries, no consolidated view, unclear pricing tiers

**Winery (Producer)**
- Operations and sales staff managing production output and logistics
- Generally desktop-first, working from office/warehouse environments
- Key motivation: consolidate many small orders into efficient bulk shipments; reduce invoicing overhead
- Pain point: administrative burden of micro-orders, credit risk from many small buyers, lack of demand visibility

### Key Design Challenges

1. **Dual-Persona Interface Architecture** — Two fundamentally different user roles (Buyer and Winery) require distinct dashboard layouts, navigation patterns, and data presentations within a single platform. Role-based routing must feel seamless, not bolted-on.

2. **Data-Dense Real-Time Displays** — Virtual pallet progress, order counts, pricing comparisons, threshold states, and geographic pooling all produce significant information density. The UX must present this clearly without cognitive overload, using progressive disclosure and smart hierarchy.

3. **Financial Trust & Transparency** — The escrow/pre-authorization payment model (capture only on pallet freeze) is non-standard. Users need constant visibility into their financial commitments, clear status indicators, and unambiguous state transitions.

4. **Geographic + Tabular Hybrid Views** — Buyers need both spatial awareness (which macro-areas have active pallets) and detailed tabular data (specific pallet contents, pricing, progress). Switching between map and list views must be frictionless.

5. **Professional Dual-Theme System** — Light and Dark themes must both maintain full readability across data-heavy tables, progress visualizations, status badges, and financial information. Dark mode is not cosmetic — it serves B2B users working in dim restaurant/warehouse environments.

### Design Opportunities

1. **Pallet Progress Visualization** — The threshold-based pallet fill (0→600 bottles) is the platform's core engagement mechanic. Rich, satisfying progress indicators with color transitions (open→approaching→frozen) create a sense of collective momentum.

2. **Role-Tailored Onboarding** — First-run experience customized per role (Buyer: area selection → preferences → first order; Winery: profile → catalog → first pallet creation) reduces time-to-value and drop-off.

3. **Smart Dashboard Defaults** — Buyers see their area's active pallets with best pricing first; Wineries see pending pallets closest to threshold. Default views optimize for the most common next action.

4. **Dark Mode as Professional Feature** — True dark mode (not inverted) designed for long working sessions, dim environments, and data-heavy screens positions WinePooler as a serious B2B tool rather than a consumer app.

## Core User Experience

### Defining Experience

WinePooler's core experience revolves around **collective progress toward a shared threshold**. For Buyers, the defining interaction is adding bottles to an open Virtual Pallet and watching the real-time progress bar advance — a tangible visualization of collective purchasing power. For Wineries, the defining experience is watching fragmented demand coalesce into efficient bulk shipments, replacing administrative chaos with a single consolidated view.

The core loop for each role:
- **Buyer Loop:** Browse area pallets → Select pallet → Add order → Watch progress → Receive freeze confirmation
- **Winery Loop:** Create/manage pallets → Monitor fill progress → Receive freeze notification → Process consolidated picking list → Confirm payout

### Platform Strategy

- **Web-first SPA** built with React + Tailwind CSS, fully responsive
- **Desktop-primary** for Winery users (office/warehouse workflows); **mobile-capable** for Buyer users (restaurant floor checks, on-the-go order tracking)
- **Mouse/keyboard primary**, with touch-friendly targets (min 44px) for mobile interactions
- **No offline support required** — real-time data freshness is the core value proposition
- **Supabase Realtime** leveraged for live pallet counter updates, state transition notifications, and order feed
- **Dual theme (Light/Dark)** with system-preference detection and manual toggle, persisted per user

### Effortless Interactions

1. **Area-Filtered Browsing** — Buyers see only their macro-area's active pallets immediately on dashboard load. No filtering steps required.
2. **One-Action Ordering** — Adding bottles to an open pallet requires a single quantity input + confirm. No multi-step checkout; escrow is handled transparently in the background.
3. **Automatic State Transitions** — Pallets auto-freeze when threshold is met. No manual triggers, no approval workflows. The system handles it atomically.
4. **Smart Defaults** — Buyer dashboard defaults to their registered macro-area. Winery dashboard defaults to pallets closest to threshold (highest urgency first).
5. **Persistent Preferences** — Theme choice, view mode (map/grid), and area selection persist across sessions without re-configuration.

### Critical Success Moments

| Moment | Role | Experience | Design Response |
|--------|------|------------|------------------|
| **First Order** | Buyer | "I'm contributing to something bigger" | Animated progress bar increment with count feedback |
| **Pallet Freeze** | Buyer | "It worked — my order is confirmed" | Celebration micro-animation + clear status change + payment capture notification |
| **Pallet Freeze** | Winery | "Demand consolidated into one shipment" | Picking list auto-generation + payout estimate display |
| **Picking List View** | Winery | "This saves me hours of admin" | Clean, printable consolidated view replacing dozens of individual orders |
| **Price Comparison** | Buyer | "I'm getting a real deal" | Bulk vs. retail price differential always visible on pallet cards |

### Experience Principles

1. **Progress is Visible** — Every pallet shows real-time fill status. Every order increments immediately. Users always know where things stand. No ambiguity on financial commitments.

2. **Role-First, Not Feature-First** — The interface adapts entirely to the user's role. Buyers never see winery tools; Wineries never see buyer flows. Navigation, dashboards, and actions are role-native.

3. **Collective Over Individual** — The UX reinforces that value comes from pooling. Progress bars, participant counts, and area-wide stats create a sense of shared momentum rather than individual transactions.

4. **Trust Through Transparency** — Escrow status, pallet state, payment timeline, and pricing differentials are always visible. No hidden states, no surprise charges, no ambiguous transitions.

5. **Professional Density, Not Consumer Simplicity** — This is a B2B work tool. Dashboards show meaningful data density. Progressive disclosure manages complexity without dumbing down the interface.
