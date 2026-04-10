-- Migration: Create native PostgreSQL roles for buyer and winery
-- These roles inherit from 'authenticated' so all existing RLS policies (TO authenticated) still apply.

-- 1. Create roles (idempotent)
DO $$
BEGIN
  IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'buyer') THEN
    CREATE ROLE buyer NOLOGIN INHERIT;
  END IF;
  IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'winery') THEN
    CREATE ROLE winery NOLOGIN INHERIT;
  END IF;
END$$;

-- 2. Grant authenticated privileges so buyer/winery inherit RLS access
GRANT authenticated TO buyer;
GRANT authenticated TO winery;

-- 3. Grant schema usage and object access
GRANT USAGE ON SCHEMA public TO buyer, winery;
GRANT ALL ON ALL TABLES IN SCHEMA public TO buyer, winery;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO buyer, winery;
GRANT ALL ON ALL ROUTINES IN SCHEMA public TO buyer, winery;

-- 4. Default privileges for future objects
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO buyer, winery;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON SEQUENCES TO buyer, winery;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON ROUTINES TO buyer, winery;

-- 5. Trigger: assign native role on signup based on user_metadata.role
CREATE OR REPLACE FUNCTION public.handle_new_user_role()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  requested_role text;
BEGIN
  requested_role := NEW.raw_user_meta_data ->> 'role';

  IF requested_role IN ('buyer', 'winery') THEN
    NEW.role := requested_role;
  END IF;

  -- If role is not buyer/winery, keep default 'authenticated'
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created_set_role
  BEFORE INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user_role();
