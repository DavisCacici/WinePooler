-- Migration: Reconciliation log table + reconciliation function
-- Story 3.4: Concurrent Update Handling (AC 4)
-- Detects and corrects orphaned pallet_orders that cause bottle_count drift.

-- ────────────────────────────────────────────────────────────
-- 1. reconciliation_log table
-- ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.reconciliation_log (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  pallet_id      uuid NOT NULL REFERENCES public.virtual_pallets(id),
  expected_count integer NOT NULL,
  actual_count   integer NOT NULL,
  corrected_at   timestamptz DEFAULT now()
);

ALTER TABLE public.reconciliation_log ENABLE ROW LEVEL SECURITY;

-- Only service-role / admin can read reconciliation logs
CREATE POLICY "Service role can manage reconciliation_log"
  ON public.reconciliation_log
  FOR ALL
  USING (auth.role() = 'service_role');

-- ────────────────────────────────────────────────────────────
-- 2. Reconciliation function (admin-only, run on-demand or scheduled)
-- ────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.reconcile_pallet_bottle_counts()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  rec RECORD;
BEGIN
  FOR rec IN
    SELECT
      vp.id            AS pallet_id,
      vp.bottle_count  AS actual_count,
      COALESCE(SUM(po.quantity), 0)::integer AS expected_count
    FROM public.virtual_pallets vp
    LEFT JOIN public.pallet_orders po ON po.pallet_id = vp.id
    WHERE vp.state = 'open'
    GROUP BY vp.id, vp.bottle_count
    HAVING vp.bottle_count <> COALESCE(SUM(po.quantity), 0)
  LOOP
    -- Correct the discrepancy
    UPDATE public.virtual_pallets
    SET bottle_count = rec.expected_count, updated_at = now()
    WHERE id = rec.pallet_id;

    -- Log it
    INSERT INTO public.reconciliation_log (pallet_id, expected_count, actual_count)
    VALUES (rec.pallet_id, rec.expected_count, rec.actual_count);
  END LOOP;
END;
$$;

-- Only service_role can execute reconciliation
GRANT EXECUTE ON FUNCTION public.reconcile_pallet_bottle_counts()
  TO service_role;
