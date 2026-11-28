-- Remove unused Sync PIN rate-limit table and RPC after switching to Email + Password only

DROP FUNCTION IF EXISTS public.consume_sync_pin_attempt(text, integer, bigint);
DROP TABLE IF EXISTS public.sync_pin_attempts;
