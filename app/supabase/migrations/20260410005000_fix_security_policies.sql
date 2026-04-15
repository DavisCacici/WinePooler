-- Migration: Fix Security Policies using JWT Claims
-- Fixes issues with RLS policies by using raw_user_meta_data instead of native roles
-- This works because Supabase doesn't allow modifying auth.users.role via triggers

-- Helper function to check if current user has a specific role in metadata
CREATE OR REPLACE FUNCTION public.has_role(role_name text)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT COALESCE(
    (SELECT raw_user_meta_data->>'role' FROM auth.users WHERE id = auth.uid()),
    ''
  ) = role_name;
$$;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION public.has_role(text) TO authenticated;

-- ============================================================
-- 1. buyer_profiles — owner-only CRUD (users with role='buyer')
-- ============================================================

DROP POLICY IF EXISTS "Buyer can read own profile" ON public.buyer_profiles;
DROP POLICY IF EXISTS "Buyer can insert own profile" ON public.buyer_profiles;
DROP POLICY IF EXISTS "Buyer can update own profile" ON public.buyer_profiles;
DROP POLICY IF EXISTS "buyer_profiles_select_owner" ON public.buyer_profiles;
DROP POLICY IF EXISTS "buyer_profiles_insert_owner" ON public.buyer_profiles;
DROP POLICY IF EXISTS "buyer_profiles_update_owner" ON public.buyer_profiles;
DROP POLICY IF EXISTS "buyer_profiles_delete_owner" ON public.buyer_profiles;
DROP POLICY IF EXISTS "buyer_profiles_select_buyer" ON public.buyer_profiles;
DROP POLICY IF EXISTS "buyer_profiles_insert_buyer" ON public.buyer_profiles;
DROP POLICY IF EXISTS "buyer_profiles_update_buyer" ON public.buyer_profiles;
DROP POLICY IF EXISTS "buyer_profiles_delete_buyer" ON public.buyer_profiles;

CREATE POLICY "buyer_profiles_select_buyer"
  ON public.buyer_profiles
  FOR SELECT
  TO authenticated
  USING (
    public.has_role('buyer') AND auth.uid() = user_id
  );

CREATE POLICY "buyer_profiles_insert_buyer"
  ON public.buyer_profiles
  FOR INSERT
  TO authenticated
  WITH CHECK (
    public.has_role('buyer') AND auth.uid() = user_id
  );

CREATE POLICY "buyer_profiles_update_buyer"
  ON public.buyer_profiles
  FOR UPDATE
  TO authenticated
  USING (
    public.has_role('buyer') AND auth.uid() = user_id
  )
  WITH CHECK (
    public.has_role('buyer') AND auth.uid() = user_id
  );

CREATE POLICY "buyer_profiles_delete_buyer"
  ON public.buyer_profiles
  FOR DELETE
  TO authenticated
  USING (
    public.has_role('buyer') AND auth.uid() = user_id
  );

-- ============================================================
-- 2. buyer_preferences — owner-only CRUD (users with role='buyer')
-- ============================================================

DROP POLICY IF EXISTS "Buyer can read own preferences" ON public.buyer_preferences;
DROP POLICY IF EXISTS "Buyer can insert own preferences" ON public.buyer_preferences;
DROP POLICY IF EXISTS "Buyer can update own preferences" ON public.buyer_preferences;
DROP POLICY IF EXISTS "buyer_preferences_select_owner" ON public.buyer_preferences;
DROP POLICY IF EXISTS "buyer_preferences_insert_owner" ON public.buyer_preferences;
DROP POLICY IF EXISTS "buyer_preferences_update_owner" ON public.buyer_preferences;
DROP POLICY IF EXISTS "buyer_preferences_delete_owner" ON public.buyer_preferences;
DROP POLICY IF EXISTS "buyer_preferences_select_buyer" ON public.buyer_preferences;
DROP POLICY IF EXISTS "buyer_preferences_insert_buyer" ON public.buyer_preferences;
DROP POLICY IF EXISTS "buyer_preferences_update_buyer" ON public.buyer_preferences;
DROP POLICY IF EXISTS "buyer_preferences_delete_buyer" ON public.buyer_preferences;

CREATE POLICY "buyer_preferences_select_buyer"
  ON public.buyer_preferences
  FOR SELECT
  TO authenticated
  USING (
    public.has_role('buyer') AND
    EXISTS (
      SELECT 1 FROM public.buyer_profiles bp
      WHERE bp.id = buyer_preferences.user_id
        AND bp.user_id = auth.uid()
    )
  );

CREATE POLICY "buyer_preferences_insert_buyer"
  ON public.buyer_preferences
  FOR INSERT
  TO authenticated
  WITH CHECK (
    public.has_role('buyer') AND
    EXISTS (
      SELECT 1 FROM public.buyer_profiles bp
      WHERE bp.id = buyer_preferences.user_id
        AND bp.user_id = auth.uid()
    )
  );

CREATE POLICY "buyer_preferences_update_buyer"
  ON public.buyer_preferences
  FOR UPDATE
  TO authenticated
  USING (
    public.has_role('buyer') AND
    EXISTS (
      SELECT 1 FROM public.buyer_profiles bp
      WHERE bp.id = buyer_preferences.user_id
        AND bp.user_id = auth.uid()
    )
  )
  WITH CHECK (
    public.has_role('buyer') AND
    EXISTS (
      SELECT 1 FROM public.buyer_profiles bp
      WHERE bp.id = buyer_preferences.user_id
        AND bp.user_id = auth.uid()
    )
  );

CREATE POLICY "buyer_preferences_delete_buyer"
  ON public.buyer_preferences
  FOR DELETE
  TO authenticated
  USING (
    public.has_role('buyer') AND
    EXISTS (
      SELECT 1 FROM public.buyer_profiles bp
      WHERE bp.id = buyer_preferences.user_id
        AND bp.user_id = auth.uid()
    )
  );

-- ============================================================
-- 3. winery_profiles — winery-only write, authenticated read
-- ============================================================

DROP POLICY IF EXISTS "Authenticated users can read winery profiles" ON public.winery_profiles;
DROP POLICY IF EXISTS "Winery can insert own profile" ON public.winery_profiles;
DROP POLICY IF EXISTS "Winery can update own profile" ON public.winery_profiles;
DROP POLICY IF EXISTS "winery_profiles_select_authenticated" ON public.winery_profiles;
DROP POLICY IF EXISTS "winery_profiles_insert_owner" ON public.winery_profiles;
DROP POLICY IF EXISTS "winery_profiles_update_owner" ON public.winery_profiles;
DROP POLICY IF EXISTS "winery_profiles_delete_owner" ON public.winery_profiles;
DROP POLICY IF EXISTS "winery_profiles_select_all" ON public.winery_profiles;
DROP POLICY IF EXISTS "winery_profiles_insert_winery" ON public.winery_profiles;
DROP POLICY IF EXISTS "winery_profiles_update_winery" ON public.winery_profiles;
DROP POLICY IF EXISTS "winery_profiles_delete_winery" ON public.winery_profiles;

CREATE POLICY "winery_profiles_select_all"
  ON public.winery_profiles
  FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "winery_profiles_insert_winery"
  ON public.winery_profiles
  FOR INSERT
  TO authenticated
  WITH CHECK (
    public.has_role('winery') AND auth.uid() = user_id
  );

CREATE POLICY "winery_profiles_update_winery"
  ON public.winery_profiles
  FOR UPDATE
  TO authenticated
  USING (
    public.has_role('winery') AND auth.uid() = user_id
  )
  WITH CHECK (
    public.has_role('winery') AND auth.uid() = user_id
  );

CREATE POLICY "winery_profiles_delete_winery"
  ON public.winery_profiles
  FOR DELETE
  TO authenticated
  USING (
    public.has_role('winery') AND auth.uid() = user_id
  );

-- ============================================================
-- 4. wine_inventory — winery-owner write, authenticated read
-- ============================================================

DROP POLICY IF EXISTS "Authenticated users can read inventory" ON public.wine_inventory;
DROP POLICY IF EXISTS "Winery can insert own inventory" ON public.wine_inventory;
DROP POLICY IF EXISTS "Winery can update own inventory" ON public.wine_inventory;
DROP POLICY IF EXISTS "wine_inventory_select_authenticated" ON public.wine_inventory;
DROP POLICY IF EXISTS "wine_inventory_insert_winery" ON public.wine_inventory;
DROP POLICY IF EXISTS "wine_inventory_update_winery" ON public.wine_inventory;
DROP POLICY IF EXISTS "wine_inventory_delete_winery" ON public.wine_inventory;

CREATE POLICY "wine_inventory_select_authenticated"
  ON public.wine_inventory
  FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "wine_inventory_insert_winery"
  ON public.wine_inventory
  FOR INSERT
  TO authenticated
  WITH CHECK (
    public.has_role('winery') AND
    EXISTS (
      SELECT 1 FROM public.winery_profiles wp
      WHERE wp.id = wine_inventory.winery_id
        AND wp.user_id = auth.uid()
    )
  );

CREATE POLICY "wine_inventory_update_winery"
  ON public.wine_inventory
  FOR UPDATE
  TO authenticated
  USING (
    public.has_role('winery') AND
    EXISTS (
      SELECT 1 FROM public.winery_profiles wp
      WHERE wp.id = wine_inventory.winery_id
        AND wp.user_id = auth.uid()
    )
  )
  WITH CHECK (
    public.has_role('winery') AND
    EXISTS (
      SELECT 1 FROM public.winery_profiles wp
      WHERE wp.id = wine_inventory.winery_id
        AND wp.user_id = auth.uid()
    )
  );

CREATE POLICY "wine_inventory_delete_winery"
  ON public.wine_inventory
  FOR DELETE
  TO authenticated
  USING (
    public.has_role('winery') AND
    EXISTS (
      SELECT 1 FROM public.winery_profiles wp
      WHERE wp.id = wine_inventory.winery_id
        AND wp.user_id = auth.uid()
    )
  );

-- ============================================================
-- 5. virtual_pallets — authenticated read, buyer-only create
-- ============================================================

DROP POLICY IF EXISTS "Authenticated users can read all pallets" ON public.virtual_pallets;
DROP POLICY IF EXISTS "Buyers can create pallets" ON public.virtual_pallets;
DROP POLICY IF EXISTS "virtual_pallets_select_authenticated" ON public.virtual_pallets;
DROP POLICY IF EXISTS "virtual_pallets_insert_buyer" ON public.virtual_pallets;

CREATE POLICY "virtual_pallets_select_authenticated"
  ON public.virtual_pallets
  FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "virtual_pallets_insert_buyer"
  ON public.virtual_pallets
  FOR INSERT
  TO authenticated
  WITH CHECK (
    public.has_role('buyer')
  );

-- No user-level UPDATE/DELETE — state transitions are managed by SECURITY DEFINER RPCs

-- ============================================================
-- 6. pallet_orders — buyer owns their orders, winery reads related
-- ============================================================

DROP POLICY IF EXISTS "Buyer can insert own orders" ON public.pallet_orders;
DROP POLICY IF EXISTS "Authenticated users can read orders" ON public.pallet_orders;
DROP POLICY IF EXISTS "pallet_orders_select_owner" ON public.pallet_orders;
DROP POLICY IF EXISTS "pallet_orders_select_winery" ON public.pallet_orders;
DROP POLICY IF EXISTS "pallet_orders_insert_buyer" ON public.pallet_orders;

CREATE POLICY "pallet_orders_select_owner"
  ON public.pallet_orders
  FOR SELECT
  TO authenticated
  USING (
    public.has_role('buyer') AND auth.uid() = buyer_id
  );

CREATE POLICY "pallet_orders_select_winery"
  ON public.pallet_orders
  FOR SELECT
  TO authenticated
  USING (
    public.has_role('winery') AND
    EXISTS (
      SELECT 1 FROM public.virtual_pallets vp
      JOIN public.winery_profiles wp ON wp.id = vp.winery_id
      WHERE vp.id = pallet_orders.pallet_id
        AND wp.user_id = auth.uid()
    )
  );

CREATE POLICY "pallet_orders_insert_buyer"
  ON public.pallet_orders
  FOR INSERT
  TO authenticated
  WITH CHECK (
    public.has_role('buyer') AND auth.uid() = buyer_id
  );

-- No user-level UPDATE/DELETE — managed by SECURITY DEFINER RPCs

-- ============================================================
-- 7. payment_authorizations — buyer reads own, service role writes
-- ============================================================

DROP POLICY IF EXISTS "Buyer can read own payment authorizations" ON public.payment_authorizations;
DROP POLICY IF EXISTS "payment_authorizations_select_buyer" ON public.payment_authorizations;

CREATE POLICY "payment_authorizations_select_buyer"
  ON public.payment_authorizations
  FOR SELECT
  TO authenticated
  USING (
    public.has_role('buyer') AND auth.uid() = buyer_id
  );

-- INSERT/UPDATE handled by SECURITY DEFINER RPCs and service-role Edge Functions
-- service_role bypasses RLS, so no explicit policy needed

-- ============================================================
-- 8. pallet_payouts — winery reads own, service role writes
-- ============================================================

DROP POLICY IF EXISTS "Winery can read own payouts" ON public.pallet_payouts;
DROP POLICY IF EXISTS "pallet_payouts_select_winery" ON public.pallet_payouts;

CREATE POLICY "pallet_payouts_select_winery"
  ON public.pallet_payouts
  FOR SELECT
  TO authenticated
  USING (
    public.has_role('winery') AND
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
DROP POLICY IF EXISTS "pallet_payout_items_select_winery" ON public.pallet_payout_items;

CREATE POLICY "pallet_payout_items_select_winery"
  ON public.pallet_payout_items
  FOR SELECT
  TO authenticated
  USING (
    public.has_role('winery') AND
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
DROP POLICY IF EXISTS "platform_fees_select_authenticated" ON public.platform_fees;

CREATE POLICY "platform_fees_select_authenticated"
  ON public.platform_fees
  FOR SELECT
  TO authenticated
  USING (true);

-- No INSERT/UPDATE/DELETE for normal users — admin via service role only

-- ============================================================
-- 11. macro_areas — authenticated read (active only)
-- ============================================================

DROP POLICY IF EXISTS "Authenticated users can read active areas" ON public.macro_areas;
DROP POLICY IF EXISTS "macro_areas_select_authenticated" ON public.macro_areas;

CREATE POLICY "macro_areas_select_authenticated"
  ON public.macro_areas
  FOR SELECT
  TO authenticated
  USING (is_active = true);

-- No INSERT/UPDATE/DELETE for normal users — admin via service role only

-- ============================================================
-- 12. selling_units — winery write, authenticated read
-- ============================================================

DROP POLICY IF EXISTS "selling_units_select_authenticated" ON public.selling_units;
DROP POLICY IF EXISTS "selling_units_insert_winery" ON public.selling_units;
DROP POLICY IF EXISTS "selling_units_update_winery" ON public.selling_units;
DROP POLICY IF EXISTS "selling_units_delete_winery" ON public.selling_units;

CREATE POLICY "selling_units_select_authenticated"
  ON public.selling_units
  FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "selling_units_insert_winery"
  ON public.selling_units
  FOR INSERT
  TO authenticated
  WITH CHECK (
    public.has_role('winery') AND
    EXISTS (
      SELECT 1 FROM public.winery_profiles wp
      WHERE wp.id = selling_units.winery_id
        AND wp.user_id = auth.uid()
    )
  );

CREATE POLICY "selling_units_update_winery"
  ON public.selling_units
  FOR UPDATE
  TO authenticated
  USING (
    public.has_role('winery') AND
    EXISTS (
      SELECT 1 FROM public.winery_profiles wp
      WHERE wp.id = selling_units.winery_id
        AND wp.user_id = auth.uid()
    )
  )
  WITH CHECK (
    public.has_role('winery') AND
    EXISTS (
      SELECT 1 FROM public.winery_profiles wp
      WHERE wp.id = selling_units.winery_id
        AND wp.user_id = auth.uid()
    )
  );

CREATE POLICY "selling_units_delete_winery"
  ON public.selling_units
  FOR DELETE
  TO authenticated
  USING (
    public.has_role('winery') AND
    EXISTS (
      SELECT 1 FROM public.winery_profiles wp
      WHERE wp.id = selling_units.winery_id
        AND wp.user_id = auth.uid()
    )
  );

-- ============================================================
-- 13. product_selling_units — winery write, authenticated read
-- ============================================================

DROP POLICY IF EXISTS "product_selling_units_select_authenticated" ON public.product_selling_units;
DROP POLICY IF EXISTS "product_selling_units_insert_winery" ON public.product_selling_units;
DROP POLICY IF EXISTS "product_selling_units_update_winery" ON public.product_selling_units;
DROP POLICY IF EXISTS "product_selling_units_delete_winery" ON public.product_selling_units;

CREATE POLICY "product_selling_units_select_authenticated"
  ON public.product_selling_units
  FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "product_selling_units_insert_winery"
  ON public.product_selling_units
  FOR INSERT
  TO authenticated
  WITH CHECK (
    public.has_role('winery') AND
    EXISTS (
      SELECT 1 FROM public.selling_units su
      JOIN public.winery_profiles wp ON wp.id = su.winery_id
      WHERE su.id = product_selling_units.selling_unit_id
        AND wp.user_id = auth.uid()
    )
  );

CREATE POLICY "product_selling_units_update_winery"
  ON public.product_selling_units
  FOR UPDATE
  TO authenticated
  USING (
    public.has_role('winery') AND
    EXISTS (
      SELECT 1 FROM public.selling_units su
      JOIN public.winery_profiles wp ON wp.id = su.winery_id
      WHERE su.id = product_selling_units.selling_unit_id
        AND wp.user_id = auth.uid()
    )
  )
  WITH CHECK (
    public.has_role('winery') AND
    EXISTS (
      SELECT 1 FROM public.selling_units su
      JOIN public.winery_profiles wp ON wp.id = su.winery_id
      WHERE su.id = product_selling_units.selling_unit_id
        AND wp.user_id = auth.uid()
    )
  );

CREATE POLICY "product_selling_units_delete_winery"
  ON public.product_selling_units
  FOR DELETE
  TO authenticated
  USING (
    public.has_role('winery') AND
    EXISTS (
      SELECT 1 FROM public.selling_units su
      JOIN public.winery_profiles wp ON wp.id = su.winery_id
      WHERE su.id = product_selling_units.selling_unit_id
        AND wp.user_id = auth.uid()
    )
  );

-- ============================================================
-- 14. reconciliation_log — service role only (no user policies needed)
-- ============================================================

DROP POLICY IF EXISTS "Service role can manage reconciliation_log" ON public.reconciliation_log;
-- service_role bypasses RLS automatically, no explicit policy needed

-- ============================================================
-- NOTES:
-- - The 'buyer' and 'winery' roles inherit from 'authenticated'
-- - service_role bypasses RLS by default
-- - SECURITY DEFINER functions execute with elevated privileges
-- ============================================================
