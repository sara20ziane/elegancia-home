-- Postgres Changes checks the subscriber's SELECT permissions and RLS.
-- Keep orders private: only existing owner/staff policies authorize admin events.
-- No grants, policies, triggers or SECURITY DEFINER functions are changed here.
do $$
begin
  if not (select relrowsecurity from pg_class where oid = 'public.orders'::regclass) then
    raise exception 'orders RLS must be enabled before enabling Realtime';
  end if;
  if has_table_privilege('anon', 'public.orders', 'select') then
    raise exception 'orders must not be publicly readable';
  end if;

  if not exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    create publication supabase_realtime;
  end if;

  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'orders'
  ) then
    alter publication supabase_realtime add table public.orders;
  end if;
end;
$$;
