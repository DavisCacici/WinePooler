-- Migration: Auto-assign selling units to existing products
-- Story 7.3: Per-Product Selling Unit Assignment (AC #6)
-- When a new selling_unit is inserted, automatically create product_selling_units
-- rows for all existing wine_inventory items of that winery with enabled=true.

CREATE OR REPLACE FUNCTION public.auto_assign_selling_unit_to_products()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.product_selling_units (inventory_id, selling_unit_id, enabled)
  SELECT wi.id, NEW.id, true
  FROM public.wine_inventory wi
  WHERE wi.winery_id = NEW.winery_id;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER trg_auto_assign_selling_unit
  AFTER INSERT ON public.selling_units
  FOR EACH ROW
  EXECUTE FUNCTION public.auto_assign_selling_unit_to_products();
