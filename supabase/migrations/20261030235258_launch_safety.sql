create extension if not exists pg_cron with schema pg_catalog;

-- Replace the carrier-rate cache atomically: either the full Packers refresh
-- succeeds, or the previous usable rates remain untouched.
create or replace function public.sync_packers_delivery_rates(p_rows jsonb)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_row jsonb;
  v_wilaya text;
  v_fee integer;
  v_stopdesk_fee integer;
  v_eta_days integer;
  v_wilayas text[] := array[]::text[];
  v_count integer := 0;
begin
  if (select public.has_admin_role((select auth.uid()), array['owner','staff']::public.admin_role[])) is not true then
    raise exception 'Only store administrators can synchronize delivery rates'
      using errcode = 'insufficient_privilege';
  end if;

  if p_rows is null or jsonb_typeof(p_rows) <> 'array' or jsonb_array_length(p_rows) = 0 then
    raise exception 'Packers returned no delivery rates' using errcode = 'check_violation';
  end if;

  for v_row in select * from jsonb_array_elements(p_rows)
  loop
    v_wilaya := nullif(trim(v_row->>'wilaya'), '');
    v_fee := (v_row->>'fee')::integer;
    v_stopdesk_fee := case
      when v_row->>'stopdesk_fee' is null or v_row->>'stopdesk_fee' = '' then null
      else (v_row->>'stopdesk_fee')::integer
    end;
    v_eta_days := greatest(1, least(coalesce((v_row->>'eta_days')::integer, 3), 30));

    if v_wilaya is null or v_fee < 0 or (v_stopdesk_fee is not null and v_stopdesk_fee < 0) then
      raise exception 'Invalid Packers delivery rate payload' using errcode = 'check_violation';
    end if;

    insert into public.delivery_zones (wilaya, fee, stopdesk_fee, eta_days, is_active)
    values (v_wilaya, v_fee, v_stopdesk_fee, v_eta_days, true)
    on conflict (wilaya) do update
      set fee = excluded.fee,
          stopdesk_fee = excluded.stopdesk_fee,
          eta_days = excluded.eta_days,
          is_active = true;

    v_wilayas := array_append(v_wilayas, v_wilaya);
    v_count := v_count + 1;
  end loop;

  update public.delivery_zones
     set is_active = false
   where not (wilaya = any(v_wilayas));

  update public.store_settings
     set delivery_wilayas = v_wilayas,
         delivery_fee_flat = 0,
         free_shipping_threshold = 0,
         guepex_from_wilaya = 'Alger'
   where id = 1;

  return v_count;
end;
$$;

revoke all on function public.sync_packers_delivery_rates(jsonb) from public, anon;
grant execute on function public.sync_packers_delivery_rates(jsonb) to authenticated;

-- Pending COD orders reserve stock. Release that reservation automatically after
-- 24 hours by moving stale orders to cancelled; the existing status trigger
-- restores the reserved variant quantities exactly once.
create or replace function public.expire_stale_pending_orders(p_max_age interval default interval '24 hours')
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_count integer := 0;
begin
  if p_max_age < interval '1 hour' or p_max_age > interval '7 days' then
    raise exception 'Invalid pending-order expiry window' using errcode = 'check_violation';
  end if;

  update public.orders
     set status = 'cancelled'
   where status = 'pending'
     and created_at < now() - p_max_age;

  get diagnostics v_count = row_count;
  return v_count;
end;
$$;

revoke all on function public.expire_stale_pending_orders(interval) from public, anon, authenticated;

select cron.schedule(
  'elegancia-expire-pending-orders',
  '0 * * * *',
  $cron$select public.expire_stale_pending_orders(interval '24 hours');$cron$
);

-- Packers needs the commune for every parcel. Enforce it at the database layer
-- too, so direct RPC calls cannot create an order the carrier cannot accept.
create or replace function public.validate_order()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_open boolean;
  v_allowed text[];
begin
  if length(trim(coalesce(new.customer_name, ''))) < 2 or length(new.customer_name) > 120 then
    raise exception 'Invalid customer_name' using errcode = 'check_violation';
  end if;
  if not public.is_valid_dz_phone(new.phone) then
    raise exception 'Invalid Algerian phone number' using errcode = 'check_violation';
  end if;
  if length(trim(coalesce(new.wilaya, ''))) < 2 or length(new.wilaya) > 80 then
    raise exception 'Invalid wilaya' using errcode = 'check_violation';
  end if;
  if length(trim(coalesce(new.commune, ''))) < 2 or length(new.commune) > 80 then
    raise exception 'Invalid commune' using errcode = 'check_violation', hint = 'commune_required';
  end if;
  if length(trim(coalesce(new.address, ''))) < 5 or length(new.address) > 500 then
    raise exception 'Invalid address' using errcode = 'check_violation';
  end if;
  if new.note is not null and length(new.note) > 1000 then
    raise exception 'Note too long' using errcode = 'check_violation';
  end if;

  select accepts_cod, delivery_wilayas into v_open, v_allowed from public.store_settings where id = 1;
  if v_open is false then
    raise exception 'The shop is not accepting orders right now' using errcode = 'check_violation';
  end if;
  if coalesce(array_length(v_allowed, 1), 0) > 0 and not (new.wilaya = any(v_allowed)) then
    raise exception 'We do not deliver to % yet', new.wilaya using errcode = 'check_violation';
  end if;

  if new.delivery_method = 'stopdesk' then
    if length(trim(coalesce(new.stopdesk_name, ''))) < 2 then
      raise exception 'Stop Desk commune is required'
        using errcode = 'check_violation', hint = 'stopdesk_unavailable';
    end if;
    if not exists (
      select 1
        from public.delivery_zones dz
       where dz.wilaya = new.wilaya
         and dz.is_active
         and dz.stopdesk_fee is not null
    ) then
      raise exception 'Pickup is not offered in %', new.wilaya
        using errcode = 'check_violation', hint = 'stopdesk_unavailable';
    end if;
  end if;

  if new.delivery_method = 'home' then
    new.stopdesk_id := null;
    new.stopdesk_name := null;
  end if;

  if exists (
    select 1 from public.blocked_phones b
     where b.phone = public.canonical_dz_phone(new.phone)
  ) then
    raise exception 'This phone number cannot place orders'
      using errcode = 'check_violation', hint = 'phone_blocked';
  end if;

  if (
    select count(*) from public.orders o
     where public.canonical_dz_phone(o.phone) = public.canonical_dz_phone(new.phone)
       and o.status = 'pending'
       and o.created_at > now() - interval '24 hours'
  ) >= 3 then
    raise exception 'Too many unconfirmed orders for this phone number'
      using errcode = 'check_violation', hint = 'too_many_pending';
  end if;

  new.status := 'pending';
  return new;
end;
$$;
