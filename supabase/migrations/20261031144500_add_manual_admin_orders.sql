-- Manual orders received through social networks or phone must enter the exact
-- same stock, pricing and delivery workflow as storefront orders, while keeping
-- their acquisition source for admin reporting.

alter table public.orders
  add column if not exists order_source text not null default 'website';

do $$
begin
  if not exists (
    select 1
      from pg_constraint
     where conrelid = 'public.orders'::regclass
       and conname = 'orders_order_source_check'
  ) then
    alter table public.orders
      add constraint orders_order_source_check
      check (order_source in ('website', 'instagram', 'facebook', 'whatsapp', 'phone', 'other'));
  end if;
end $$;

create or replace function public.place_admin_order(
  p_customer jsonb,
  p_items jsonb,
  p_source text default 'other',
  p_confirmed boolean default false
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := (select auth.uid());
  v_source text := lower(trim(coalesce(p_source, 'other')));
  v_token uuid;
begin
  if v_user_id is null
     or (select public.has_admin_role(
       v_user_id,
       array['owner','staff']::public.admin_role[]
     )) is not true then
    raise exception 'Only store administrators can create manual orders'
      using errcode = 'insufficient_privilege';
  end if;

  if v_source not in ('instagram', 'facebook', 'whatsapp', 'phone', 'other') then
    raise exception 'Invalid manual order source' using errcode = 'check_violation';
  end if;

  -- Reuse the public order RPC so catalogue prices, stock reservation, delivery
  -- fees and every database-side checkout validation stay identical.
  v_token := public.place_order(p_customer, p_items);

  update public.orders
     set order_source = v_source,
         status = case when p_confirmed then 'confirmed'::public.order_status else status end,
         confirmed_at = case when p_confirmed then now() else confirmed_at end,
         confirmed_by = case when p_confirmed then v_user_id::text else confirmed_by end
   where public_token = v_token;

  return v_token;
end;
$$;

revoke all on function public.place_admin_order(jsonb, jsonb, text, boolean)
  from public, anon;
grant execute on function public.place_admin_order(jsonb, jsonb, text, boolean)
  to authenticated;
