-- Elegancia Home security hardening.
-- Bootstrap ownership is only ever claimed after authentication; anonymous
-- callers do not need claim_store(). RLS admin checks are likewise only used by
-- authenticated admin policies.
revoke execute on function public.claim_store() from anon;
revoke execute on function public.has_admin_role(uuid, public.admin_role[]) from anon;

-- PostgreSQL grants EXECUTE on new functions to PUBLIC by default. Make future
-- functions opt-in instead, so every public/authenticated RPC must be granted
-- deliberately in its migration.
alter default privileges in schema public revoke execute on functions from public;
alter default privileges in schema public revoke execute on functions from anon, authenticated;
