-- Template: Add a new geographic macro-area
-- Usage: Copy this file, fill in values, and run against your Supabase project
--
-- Example: supabase db execute -f supabase/seed/add-piedmont-hills.sql
-- Or run directly in Supabase SQL Editor

-- ============================================================
-- INSTRUCTIONS
-- ============================================================
-- 1. Copy this template to a new file named after your area
-- 2. Replace the placeholder values below
-- 3. Execute via Supabase CLI or SQL Editor
-- 4. The area will appear in the app immediately — no code changes needed
-- ============================================================

INSERT INTO public.macro_areas (name, slug, description, display_order, is_active, metadata)
VALUES (
  'Piedmont Hills',                                  -- name: unique display name
  'piedmont-hills',                                  -- slug: URL-friendly unique identifier
  'Langhe and Roero wine hills of southern Piedmont', -- description: shown in area cards
  4,                                                  -- display_order: position in list (ascending)
  true,                                               -- is_active: set false to hide from UI
  '{"lat": 44.65, "lng": 8.03, "region_group": "northwest"}'::jsonb  -- metadata: optional coordinates/grouping
);

-- To deactivate an area (soft-delete — preserves existing orders/profiles):
-- UPDATE public.macro_areas SET is_active = false WHERE slug = 'piedmont-hills';

-- To reactivate:
-- UPDATE public.macro_areas SET is_active = true WHERE slug = 'piedmont-hills';

-- To add another area (example):
-- INSERT INTO public.macro_areas (name, slug, description, display_order, is_active, metadata)
-- VALUES (
--   'Veneto East',
--   'veneto-east',
--   'Eastern Veneto plains and Prosecco hills',
--   5,
--   true,
--   '{"lat": 45.75, "lng": 12.25, "region_group": "northeast"}'::jsonb
-- );
