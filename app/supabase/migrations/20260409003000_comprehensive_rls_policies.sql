-- Migration: Comprehensive RLS policies with role-based enforcement
-- Story 6.5: Security Implementation
-- Fixes: role-based access control, overly permissive SELECT policies,
--         missing write-protection, and consistent policy naming

-- ============================================================
-- 1. buyer_profiles — owner-only CRUD
-- ============================================================
-- Existing policies: SELECT/INSERT/UPDATE for owner. Add DELETE.

DROP POLICY IF EXISTS "buyer_profiles_delete_owner" ON public.buyer_profiles;
CREATE POLICY "buyer_profiles_delete_owner"
  ON public.buyer_profiles
  FOR DELETE
  TO buyer
  USING (auth.uid() = user_id);

-- Restrict INSERT to buyer role only (currently TO authenticated)
DROP POLICY IF EXISTS "Buyer can insert own profile" ON public.buyer_profiles;
CREATE POLICY "buyer_profiles_insert_owner"
  ON public.buyer_profiles
  FOR INSERT
  TO buyer
  WITH CHECK (auth.uid() = user_id);

-- Restrict UPDATE to buyer role only
DROP POLICY IF EXISTS "Buyer can update own profile" ON public.buyer_profiles;
CREATE POLICY "buyer_profiles_update_owner"
  ON public.buyer_profiles
  FOR UPDATE
  TO buyer
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Restrict SELECT to buyer role - owner only
DROP POLICY IF EXISTS "Buyer can read own profile" ON public.buyer_profiles;
CREATE POLICY "buyer_profiles_select_owner"
  ON public.buyer_profiles
  FOR SELECT
  TO buyer
  USING (auth.uid() = user_id);

-- Service role needs to read buyer profiles for edge functions
-- (service_role bypasses RLS by default, so no explicit policy needed)

-- ============================================================
-- 2. buyer_preferences — owner-only CRUD (buyer role)
-- ============================================================
DROP POLICY IF EXISTS "Buyer can read own preferences" ON public.buyer_preferences;
CREATE POLICY "buyer_preferences_select_owner"
  ON public.buyer_preferences
  FOR SELECT
  TO buyer
  USING (
    EXISTS (
      SELECT 1 FROM public.buyer_profiles bp
      WHERE bp.id = buyer_preferences.user_id
        AND bp.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Buyer can insert own preferences" ON public.buyer_preferences;
CREATE POLICY "buyer_preferences_insert_owner"
  ON public.buyer_preferences
  FOR INSERT
  TO buyer
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.buyer_profiles bp
      WHERE bp.id = buyer_preferences.user_id
        AND bp.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Buyer can update own preferences" ON public.buyer_preferences;
CREATE POLICY "buyer_preferences_update_owner"
  ON public.buyer_preferences
  FOR UPDATE
  TO buyer
  USING (
    EXISTS (
      SELECT 1 FROM public.buyer_profiles bp
      WHERE bp.id = buyer_preferences.user_id
        AND bp.user_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.buyer_profiles bp
      WHERE bp.id = buyer_preferences.user_id
        AND bp.user_id = auth.uid()
    )
  );

CREATE POLICY "buyer_preferences_delete_owner"
  ON public.buyer_preferences
  FOR DELETE
  TO buyer
  USING (
    EXISTS (
      SELECT 1 FROM public.buyer_profiles bp
      WHERE bp.id = buyer_preferences.user_id
        AND bp.user_id = auth.uid()
    )
  );

-- ============================================================
-- 3. winery_profiles — winery-only write, authenticated read
-- ============================================================
-- Existing SELECT policy TO authenticated is correct (marketplace visibility)
-- Restrict write policies to winery role only

DROP POLICY IF EXISTS "Winery can insert own profile" ON public.winery_profiles;
CREATE POLICY "winery_profiles_insert_owner"
  ON public.winery_profiles
  FOR INSERT
  TO winery
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Winery can update own profile" ON public.winery_profiles;
CREATE POLICY "winery_profiles_update_owner"
  ON public.winery_profiles
  FOR UPDATE
  TO winery
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "winery_profiles_delete_owner"
  ON public.winery_profiles
  FOR DELETE
  TO winery
  USING (auth.uid() = user_id);

-- Keep existing authenticated read for marketplace
DROP POLICY IF EXISTS "Authenticated users can read winery profiles" ON public.winery_profiles;
CREATE POLICY "winery_profiles_select_authenticated"
  ON public.winery_profiles
  FOR SELECT
  TO authenticated
  USING (true);

-- ============================================================
-- 4. wine_inventory — winery-owner write, authenticated read
-- ============================================================
DROP POLICY IF EXISTS "Authenticated users can read inventory" ON public.wine_inventory;
CREATE POLICY "wine_inventory_select_authenticated"
  ON public.wine_inventory
  FOR SELECT
  TO authenticated
  USING (true);

DROP POLICY IF EXISTS "Winery can insert own inventory" ON public.wine_inventory;
CREATE POLICY "wine_inventory_insert_winery"
  ON public.wine_inventory
  FOR INSERT
  TO winery
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.winery_profiles wp
      WHERE wp.id = wine_inventory.winery_id
        AND wp.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Winery can update own inventory" ON public.wine_inventory;
CREATE POLICY "wine_inventory_update_winery"
  ON public.wine_inventory
  FOR UPDATE
  TO winery
  USING (
    EXISTS (
      SELECT 1 FROM public.winery_profiles wp
      WHERE wp.id = wine_inventory.winery_id
        AND wp.user_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.winery_profiles wp
      WHERE wp.id = wine_inventory.winery_id
        AND wp.user_id = auth.uid()
    )
  );

CREATE POLICY "wine_inventory_delete_winery"
  ON public.wine_inventory
  FOR DELETE
  TO winery
  USING (
    EXISTS (
      SELECT 1 FROM public.winery_profiles wp
      WHERE wp.id = wine_inventory.winery_id
        AND wp.user_id = auth.uid()
    )
  );

-- ============================================================
-- 5. virtual_pallets — authenticated read, buyer-only create
-- ============================================================
-- Fix: INSERT was TO authenticated, should be TO buyer only
DROP POLICY IF EXISTS "Buyers can create pallets" ON public.virtual_pallets;
CREATE POLICY "virtual_pallets_insert_buyer"
  ON public.virtual_pallets
  FOR INSERT
  TO buyer
  WITH CHECK (true);

-- Keep authenticated read (area-scoped filtering is done at app level)
DROP POLICY IF EXISTS "Authenticated users can read all pallets" ON public.virtual_pallets;
CREATE POLICY "virtual_pallets_select_authenticated"
  ON public.virtual_pallets
  FOR SELECT
  TO authenticated
  USING (true);

-- No user-level UPDATE/DELETE — state transitions are managed by SECURITY DEFINER RPCs

-- ============================================================
-- 6. pallet_orders — buyer owns their orders
-- ============================================================
-- Fix: SELECT was TO authenticated USING (true) — any user could read ALL orders
DROP POLICY IF EXISTS "Authenticated users can read orders" ON public.pallet_orders;
CREATE POLICY "pallet_orders_select_owner"
  ON public.pallet_orders
  FOR SELECT
  TO buyer
  USING (auth.uid() = buyer_id);

-- Winery needs to read orders for their pallets (picking lists)
CREATE POLICY "pallet_orders_select_winery"
  ON public.pallet_orders
  FOR SELECT
  TO winery
  USING (
    EXISTS (
      SELECT 1 FROM public.virtual_pallets vp
      JOIN public.winery_profiles wp ON wp.id = vp.winery_id
      WHERE vp.id = pallet_orders.pallet_id
        AND wp.user_id = auth.uid()
    )
  );

-- Restrict INSERT to buyer role only
DROP POLICY IF EXISTS "Buyer can insert own orders" ON public.pallet_orders;
CREATE POLICY "pallet_orders_insert_buyer"
  ON public.pallet_orders
  FOR INSERT
  TO buyer
  WITH CHECK (auth.uid() = buyer_id);

-- No user-level UPDATE/DELETE — managed by SECURITY DEFINER RPCs

-- ============================================================
-- 7. payment_authorizations — buyer reads own, service role writes
-- ============================================================
-- Fix: SELECT policy works but rename for consistency
DROP POLICY IF EXISTS "Buyer can read own payment authorizations" ON public.payment_authorizations;
CREATE POLICY "payment_authorizations_select_buyer"
  ON public.payment_authorizations
  FOR SELECT
  TO buyer
  USING (auth.uid() = buyer_id);

-- INSERT/UPDATE handled by SECURITY DEFINER RPCs and service-role Edge Functions
-- service_role bypasses RLS, so no explicit policy needed

-- ============================================================
-- 8. pallet_payouts — winery reads own, service role writes
-- ============================================================
DROP POLICY IF EXISTS "Winery can read own payouts" ON public.pallet_payouts;
CREATE POLICY "pallet_payouts_select_winery"
  ON public.pallet_payouts
  FOR SELECT
  TO winery
  USING (
    EXISTS (
      SELECT 1 FROM public.winery_profiles wp
      WHERE wp.id = pallet_payouts.winery_id
        AND wp.user_id = auth.uid()
    )
  );

-- ============================================================
-- 9. pallet_payout_items — winery reads own, service role writes
-- ============================================================
DROP POLICY IF EXISTS "Winery can read own payout items" ON public.pallet_payout_items;
CREATE POLICY "pallet_payout_items_select_winery"
  ON public.pallet_payout_items
  FOR SELECT
  TO winery
  USING (
    EXISTS (
      SELECT 1 FROM public.pallet_payouts pp
      JOIN public.winery_profiles wp ON wp.id = pp.winery_id
      WHERE pp.id = pallet_payout_items.payout_id
        AND wp.user_id = auth.uid()
    )
  );

-- ============================================================
-- 10. platform_fees — authenticated read, no user writes
-- ============================================================
DROP POLICY IF EXISTS "Authenticated can read platform fees" ON public.platform_fees;
CREATE POLICY "platform_fees_select_authenticated"
  ON public.platform_fees
  FOR SELECT
  TO authenticated
  USING (true);

-- No INSERT/UPDATE/DELETE for normal users — admin via service role only

-- ============================================================
-- 11. macro_areas — authenticated read (already exists, rename for consistency)
-- ============================================================
DROP POLICY IF EXISTS "Authenticated users can read active areas" ON public.macro_areas;
CREATE POLICY "macro_areas_select_authenticated"
  ON public.macro_areas
  FOR SELECT
  TO authenticated
  USING (is_active = true);

-- No INSERT/UPDATE/DELETE for normal users — admin via service role only

-- ============================================================
-- 12. reconciliation_log — update from deprecated auth.role() to modern check
-- ============================================================
DROP POLICY IF EXISTS "Service role can manage reconciliation_log" ON public.reconciliation_log;
-- service_role bypasses RLS automatically, no explicit policy needed
-- Remove the old policy that used deprecated auth.role() function
