---
stepsCompleted: ["step-01-validate-prerequisites", "step-02-design-epics", "step-03-create-stories", "step-04-final-validation"]
inputDocuments: ["prd.md"]
lastEdited: "2026-04-09"
editReason: "PRD v1.2 - Added selling unit configuration (FR10-FR15), new Epics 7-8"
---

# WinePooler - Epic Breakdown

## Overview

This document provides the complete epic and story breakdown for WinePooler, decomposing the requirements from the PRD into implementable stories.

## Requirements Inventory

### Functional Requirements

FR1: Role-Based Access Control (RBAC) with distinct interfaces for Wineries and Buyers.
FR2: Buyer Profile Management including business details, geographic area (Macro-Area) selection, and purchasing preferences configuration.
FR3: Virtual Pallet Logic aggregating orders by Macro-Area and Winery.
FR4: Threshold Management for pallets transitioning from Open to Frozen at critical mass (e.g., 600 bottles).
FR5: Real-time Progress bars showing area-wide demand.
FR6: Dynamic Pricing display of Bulk Price vs. Retail Market Price.
FR7: Real-time Inventory Sync from Supabase/PostgreSQL.
FR8: Pre-authorization (Escrow) where funds are authorized on buyer's card but captured only when pallet reaches Frozen threshold.
FR9: Bulk Payouts to wineries as single payment minus platform commission.
FR10: Winery can offer products in three selling unit types: single bottle, case, and pallet.
FR11: Winery defines a case by specifying the number of bottles it contains (e.g., 6, 12).
FR12: Winery defines a pallet by specifying its composition — either a number of bottles or a number of cases.
FR13: Each wine product listed by a winery can have its own selling unit settings (per-product configuration).
FR14: Winery can enable or disable any of the three unit types per product (unit toggle).
FR15: Configured selling units feed directly into Virtual Pallet threshold calculations (threshold linkage).

### NonFunctional Requirements

NFR1: Support for simultaneous updates to pallet counters (concurrency).
NFR2: Supabase Row Level Security (RLS) and encrypted environment variables on Vercel (security).
NFR3: Expansion of geographic clusters via configuration (scalability).

### Additional Requirements

- Frontend built with React.js and Tailwind CSS.
- Backend using Supabase for Auth, DB, and Real-time features.
- Edge Functions for pallet state transitions.
- Payments integrated via Stripe Connect.
- Production deployment on Vercel with custom domain.
- Staging via Preview Deployments on PRs.
- Environment variables managed via Vercel Dashboard for SUPABASE_URL, SUPABASE_ANON_KEY, STRIPE_SECRET_KEY, STRIPE_WEBHOOK_SECRET.
- Leveraging Vercel's Global Edge Network for performance.
- Image Optimization for wine bottle renders.
- Serverless Functions for heavy computations like PDF manifests.
- CI/CD with GitHub integration, build checks for linting and TypeScript.
- Monitoring with Vercel Analytics and Speed Insights.

### UX Design Requirements

UX-DR1: Buyer Dashboard with Map/Grid view of active pallets in geofenced area.
UX-DR2: Buyer Area Configuration with geofenced Macro-Area selection and purchasing preference management.
UX-DR3: Winery Portal with consolidated picking lists and revenue analytics.

### FR Coverage Map

Epic 1: FR1
Epic 2: FR2
Epic 3: FR3, FR4, FR5, NFR1
Epic 4: FR6, FR7
Epic 5: FR8, FR9
Epic 6: NFR2, NFR3, Additional Requirements, UX-DR1, UX-DR2, UX-DR3
Epic 7: FR10, FR11, FR12, FR13, FR14, UX-DR3 (selling unit config UI)
Epic 8: FR15, FR4 (rework to winery-defined threshold), FR6 (rework to per-unit pricing)

## Epic List

Epic 1: User Authentication and Role Management
Epic 2: Buyer Profile and Area Management
Epic 3: Virtual Pallet Pooling
Epic 4: Smart Marketplace
Epic 5: Financial Automation
Epic 6: Platform Infrastructure and Deployment
Epic 7: Winery Selling Unit Configuration
Epic 8: Selling Unit Integration into Pooling & Marketplace

## Epic 1: User Authentication and Role Management

Enables users to register, login, and access role-specific interfaces.

### Story 1.1: User Registration

As a new user,
I want to register an account with email, password, and role selection,
So that I can access the platform.

**Acceptance Criteria:**

**Given** I am on the registration page
**When** I enter valid email, password, VAT number, and select a role (Winery or Buyer)
**Then** an account is created and I receive a confirmation email
**And** I am redirected to the login page

### Story 1.2: User Login

As a registered user,
I want to login with my credentials,
So that I can access my role-specific dashboard.

**Acceptance Criteria:**

**Given** I have a registered account
**When** I enter correct email and password on the login page
**Then** I am authenticated and redirected to my role-specific dashboard
**And** my session is maintained

### Story 1.3: Role-Based Dashboard Access

As a logged-in user,
I want to see an interface tailored to my role,
So that I can perform relevant tasks.

**Acceptance Criteria:**

**Given** I am logged in as a Buyer
**When** I access the dashboard
**Then** I see the Buyer Dashboard with map/grid view
**And** navigation reflects buyer capabilities


**Given** I am logged in as Winery representative
**When** I access the dashboard
**Then** I see the Winery Portal with analytics
**And** I can view picking lists

## Epic 2: Buyer Profile and Area Management

Allows Buyers to complete their business profile, configure their geofenced Macro-Area, and manage purchasing preferences after registration.

### Story 2.1: Complete Buyer Business Profile

As a Buyer,
I want to complete my business profile with company details,
So that I am eligible to participate in pallet pooling.

**Acceptance Criteria:**

**Given** I am a newly registered Buyer
**When** I fill in company name, VAT number, business address, and contact details
**Then** my business profile is saved
**And** I am directed to select my geographic area

### Story 2.2: Geographic Area Selection

As a Buyer,
I want to select my geofenced Macro-Area,
So that I see only pallets and wineries relevant to my territory.

**Acceptance Criteria:**

**Given** I have completed my business profile
**When** I select a Macro-Area from the available list
**Then** my dashboard is scoped to show only pallets in that area
**And** I can update my area selection from account settings at any time

### Story 2.3: Purchasing Preferences Configuration

As a Buyer,
I want to configure my purchasing preferences including preferred wine categories and budget ranges,
So that the marketplace surfaces the most relevant offers for my business.

**Acceptance Criteria:**

**Given** I am on my profile settings page
**When** I set preferred wine types, appellations, and monthly budget range
**Then** preferences are saved to my profile
**And** the Buyer Dashboard highlights pallets matching my preferences

## Epic 3: Virtual Pallet Pooling

Implements order aggregation by area and winery, threshold management, and real-time progress.

### Story 3.1: Create Virtual Pallet

As a buyer,
I want to start a new virtual pallet for a specific winery and area,
So that orders can be aggregated.

**Acceptance Criteria:**

**Given** I am in a supported geographic area
**When** I select a winery and initiate a pallet
**Then** a new pallet is created in 'Open' state
**And** it appears in the area-wide view

### Story 3.2: Add Order to Pallet

As a buyer,
I want to add my wine order to an open pallet,
So that it contributes to reaching the threshold.

**Acceptance Criteria:**

**Given** an open pallet exists
**When** I add an order with quantity and wine details
**Then** the order is added to the pallet
**And** the progress bar updates in real-time

### Story 3.3: Automatic Pallet Freezing

As the system,
I want to automatically freeze a pallet when the threshold is reached,
So that orders are committed for fulfillment.

**Acceptance Criteria:**

**Given** a pallet at 599 bottles
**When** an order adds the 600th bottle
**Then** the pallet state changes to 'Frozen'
**And** all buyers are notified

### Story 3.4: Concurrent Update Handling

As the system,
I want to handle simultaneous order additions safely,
So that pallet counters remain accurate.

**Acceptance Criteria:**

**Given** multiple users adding orders simultaneously
**When** updates occur concurrently
**Then** all orders are processed without data corruption
**And** the final count is correct

## Epic 4: Smart Marketplace

Displays dynamic pricing and syncs inventory in real-time.

### Story 4.1: Display Dynamic Pricing

As a buyer,
I want to see both bulk and retail prices for wines,
So that I can understand the value of pooling.

**Acceptance Criteria:**

**Given** viewing a wine product
**When** the page loads
**Then** both bulk price and retail market price are displayed
**And** the bulk price is highlighted as the active option

### Story 4.2: Real-Time Inventory Sync

As a buyer,
I want to see current stock levels,
So that I know availability.

**Acceptance Criteria:**

**Given** stock levels in Supabase change
**When** the sync process runs
**Then** the UI updates to reflect current inventory
**And** out-of-stock items are clearly marked

## Epic 5: Financial Automation

Handles escrow pre-authorization and bulk payouts.

### Story 5.1: Escrow Pre-Authorization

As a buyer,
I want my payment to be authorized but not captured until pallet freezes,
So that funds are held securely.

**Acceptance Criteria:**

**Given** I add an order to a pallet
**When** I enter payment details
**Then** funds are authorized via Stripe
**And** not captured until pallet reaches 'Frozen'

### Story 5.2: Bulk Payout Processing

As a winery,
I want to receive a single payment for the entire pallet,
So that administrative overhead is reduced.

**Acceptance Criteria:**

**Given** a pallet is completed and shipped
**When** the fulfillment is confirmed
**Then** a bulk payment is processed minus platform commission
**And** the winery receives the payout via Stripe Connect

## Epic 6: Platform Infrastructure and Deployment

Sets up tech stack, Vercel deployment, and addresses security/scalability.

### Story 6.1: React Frontend Setup

As a developer,
I want a basic React app with Tailwind CSS and Typescript,
So that the frontend foundation is ready.

**Acceptance Criteria:**

**Given** a new project
**When** I initialize with React and Tailwind
**Then** the app runs locally
**And** basic styling is applied

### Story 6.2: Supabase Backend Integration

As a developer,
I want Supabase for auth, database, and real-time features,
So that backend services are available.

**Acceptance Criteria:**

**Given** the React app
**When** I integrate Supabase
**Then** authentication works
**And** database connections are established

### Story 6.3: Stripe Payment Integration

As a developer,
I want Stripe Connect for payments,
So that financial operations are possible.

**Acceptance Criteria:**

**Given** Supabase is set up
**When** I integrate Stripe
**Then** payment processing works
**And** webhooks are configured

### Story 6.4: Vercel Deployment

As a developer,
I want the app deployed on Vercel,
So that it's accessible online.

**Acceptance Criteria:**

**Given** the code is ready
**When** I deploy to Vercel
**Then** the app is live with custom domain
**And** environment variables are secured

### Story 6.5: Security Implementation

As a developer,
I want RLS and encrypted variables,
So that data is secure.

**Acceptance Criteria:**

**Given** Supabase database
**When** I enable RLS policies
**Then** users can only access their data
**And** variables are encrypted on Vercel

### Story 6.6: Scalable Configuration

As a developer,
I want geographic clusters configurable,
So that the platform can expand.

**Acceptance Criteria:**

**Given** new areas need support
**When** I update configuration
**Then** new clusters are added without code changes
**And** performance is maintained

## Epic 7: Winery Selling Unit Configuration

Wineries can define and manage their selling units (single bottle, case, pallet) per product, specifying bottle counts per case and composition per pallet, and toggling which units are available for each wine listing.

### Story 7.1: Selling Unit Schema and Configuration API

As a winery,
I want the platform to support selling unit definitions (bottle, case, pallet),
So that I can configure how my products are sold.

**Acceptance Criteria:**

**Given** a winery is authenticated
**When** the selling_units and product_selling_units tables are created
**Then** the schema supports three unit types: `bottle`, `case`, `pallet`
**And** a case record stores a `bottles_per_case` integer (e.g., 6, 12)
**And** a pallet record stores a `composition_type` (`bottles` or `cases`) and a `quantity` integer
**And** RLS policies restrict access so wineries can only manage their own selling units

### Story 7.2: Selling Unit Configuration UI

As a winery operator,
I want to access a Selling Unit Configuration section in my Winery Portal,
So that I can define my available selling units visually.

**Acceptance Criteria:**

**Given** I am logged in as a winery
**When** I navigate to the Selling Unit Configuration section
**Then** I see a form to define a case (with a number input for bottles per case)
**And** I see a form to define a pallet (with a dropdown for composition type and a quantity input)
**And** I can save my selling unit definitions
**And** saved definitions persist and display on subsequent visits

### Story 7.3: Per-Product Selling Unit Assignment

As a winery operator,
I want to assign selling unit settings to each of my wine products individually,
So that different labels can have different packaging options.

**Acceptance Criteria:**

**Given** I have defined selling units (case and/or pallet)
**When** I edit a wine product listing
**Then** I can toggle which unit types (bottle, case, pallet) are enabled for that product
**And** each product can have different selling unit configurations
**And** at least one unit type must remain enabled per product
**And** the buyer-facing marketplace reflects only the enabled unit types for each product

## Epic 8: Selling Unit Integration into Pooling & Marketplace

Virtual Pallet thresholds, order placement, and marketplace pricing use winery-configured selling units instead of hardcoded values. Buyers see prices per unit type and progress bars expressed in the winery's chosen unit.

### Story 8.1: Unit-Aware Virtual Pallet Thresholds

As the system,
I want pallet thresholds to be calculated from the winery's configured selling units,
So that pallets freeze at the winery-defined quantity instead of a hardcoded 600 bottles.

**Acceptance Criteria:**

**Given** a winery has configured a pallet as 60 cases × 6 bottles
**When** a virtual pallet is created for that winery
**Then** the pallet threshold is set to 360 bottles (60 × 6)
**And** the progress bar displays progress in the winery's configured unit (e.g., "42/60 cases")
**And** the pallet freezes when the threshold is reached
**And** the `add_order_with_authorization` RPC is updated to use the winery-defined threshold
**And** if the winery later changes its selling unit config, existing open pallets retain their original threshold

### Story 8.2: Unit-Aware Order Placement

As a buyer,
I want to place orders in the winery's configured selling units,
So that I can order by bottle, case, or pallet as offered.

**Acceptance Criteria:**

**Given** a wine product has case and pallet enabled as selling units
**When** I open the Add Order modal for that product
**Then** I see a unit selector showing only enabled unit types
**And** when I select "case", quantity is in cases and the bottle equivalent is displayed
**And** the order is recorded with both the unit type, unit quantity, and bottle equivalent
**And** the pallet progress updates by the bottle equivalent amount

### Story 8.3: Per-Unit Dynamic Pricing

As a buyer,
I want to see bulk and retail prices per selling unit,
So that I can compare value across unit types.

**Acceptance Criteria:**

**Given** a wine product has bottle, case, and pallet enabled
**When** the product is displayed in the marketplace
**Then** bulk price and retail price are shown for each enabled unit type
**And** case price = bottle price × bottles_per_case (with optional case discount)
**And** pallet price = unit price × pallet quantity (with optional pallet discount)
**And** the pricing badge component displays the active unit's price
