-- Read-only post-migration verification. Run with psql -v ON_ERROR_STOP=1.
begin read only;
do $$
begin
  assert (select relrowsecurity from pg_class where oid = 'public.orders'::regclass),
    'orders RLS is disabled';
  assert not has_table_privilege('anon', 'public.orders', 'select'),
    'Anonymous direct order reads must remain forbidden';
  assert has_table_privilege('authenticated', 'public.orders', 'select'),
    'Authenticated admins need SELECT in addition to RLS';
  assert exists (
    select 1 from pg_publication_tables where pubname = 'supabase_realtime'
      and schemaname = 'public' and tablename = 'orders'
  ), 'orders must be published for Realtime';
  assert exists (
    select 1 from pg_policies where schemaname = 'public' and tablename = 'orders'
      and policyname = 'Admins manage orders' and qual like '%has_admin_role%'
  ), 'Existing owner/staff policy must remain in place';
  assert has_function_privilege('anon', 'public.track_order(uuid)', 'execute'),
    'Public token RPC must remain accessible';
end;
$$;
rollback;
