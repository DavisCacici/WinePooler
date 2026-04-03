-- Fix: grant buyer/winery to authenticator so PostgREST can SET ROLE
-- Without this, JWT role='buyer' causes 403 because authenticator cannot switch to buyer.
GRANT buyer TO authenticator;
GRANT winery TO authenticator;
