-- Selected OpenStore v0.2.0 safety adaptations. No geography or delivery-rate changes.
create table if not exists public.order_connection_limits (
 client_key text not null, bucket timestamptz not null, count integer not null,
 primary key(client_key,bucket)
);
alter table public.order_connection_limits enable row level security;
revoke all on public.order_connection_limits from public, anon, authenticated;

create or replace function public.place_order(
  p_customer jsonb,
  p_items    jsonb
) returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_order_id uuid;
  v_token    uuid;
  v_item     jsonb;
  v_inserted int := 0;
  v_ip text;
  v_key text;
  v_count int;
  v_headers jsonb;
begin
  if p_customer is null or p_items is null then
    raise exception 'Missing order details';
  end if;

  if jsonb_typeof(p_items) <> 'array' then
    raise exception 'Items must be a list';
  end if;

  if jsonb_array_length(p_items) < 1 or jsonb_array_length(p_items) > 50 then
    raise exception 'Order must contain between 1 and 50 items';
  end if;

  -- Bedding retail limits, aggregated by variant to prevent duplicate-line bypass.
  if exists (select 1 from jsonb_array_elements(p_items) i
    where jsonb_typeof(i) <> 'object' or coalesce(i->>'quantity','1') !~ '^[0-9]+$'
      or length(coalesce(i->>'quantity','1')) > 3) then
    raise exception 'Invalid quantity' using errcode='check_violation', hint='too_many_items';
  end if;
  if (select coalesce(sum(coalesce((i->>'quantity')::int,1)),0) from jsonb_array_elements(p_items) i) > 50
     or exists (select 1 from jsonb_array_elements(p_items) i group by i->>'variant_id'
       having sum(coalesce((i->>'quantity')::int,1)) > 20 or min(coalesce((i->>'quantity')::int,1)) < 1) then
    raise exception 'Retail quantity limit exceeded' using errcode='check_violation', hint='too_many_items';
  end if;
  -- Supplemental gateway-IP limit; never trust the first forwarded-for entry.
  -- Phone, quantity and stock checks still apply if no gateway address is available.
  v_headers := coalesce(nullif(current_setting('request.headers',true),''),'{}')::jsonb;
  v_ip := coalesce(nullif(trim(v_headers->>'cf-connecting-ip'),''),
    nullif(trim(regexp_replace(coalesce(v_headers->>'x-forwarded-for',''),'^.*,','')),''));
  if v_ip is not null and public.has_admin_role(auth.uid(),array['owner','staff']::public.admin_role[]) is not true then
    begin v_ip := (v_ip::inet)::text; exception when invalid_text_representation then v_ip := null; end;
    if v_ip is not null then
      v_key := md5('elegancia-order:' || v_ip);
      -- Hour buckets retain only a hash, never the raw IP. Row lock makes the limit atomic.
      insert into public.order_connection_limits(client_key, bucket, count)
      values (v_key, date_trunc('hour',now()), 1)
      on conflict (client_key,bucket) do update set count=order_connection_limits.count+1
      returning count into v_count;
      if v_count > 10 then
        raise exception 'Too many orders from this connection' using errcode='check_violation',hint='too_many_orders';
      end if;
      delete from public.order_connection_limits where bucket < now()-interval '2 hours';
    end if;
  end if;

  -- validate_order() still runs as the BEFORE INSERT trigger and does the field
  -- checks. This function only decides the rows.
  insert into public.orders (customer_name, phone, wilaya, commune, address, note,
                             delivery_method, stopdesk_id, stopdesk_name)
  values (
    coalesce(p_customer->>'customer_name', ''),
    coalesce(p_customer->>'phone', ''),
    coalesce(p_customer->>'wilaya', ''),
    nullif(p_customer->>'commune', ''),
    coalesce(p_customer->>'address', ''),
    nullif(p_customer->>'note', ''),
    coalesce(nullif(p_customer->>'delivery_method', ''), 'home'),
    nullif(p_customer->>'stopdesk_id', '')::int,
    nullif(p_customer->>'stopdesk_name', '')
  )
  returning id, public_token into v_order_id, v_token;

  for v_item in select * from jsonb_array_elements(p_items)
  loop
    insert into public.order_items (order_id, variant_id, quantity)
    values (
      v_order_id,
      (v_item->>'variant_id')::uuid,
      coalesce((v_item->>'quantity')::int, 1)
    );
    v_inserted := v_inserted + 1;
  end loop;

  if v_inserted = 0 then
    raise exception 'Order has no items';
  end if;

  -- Recompute now rather than relying on the row trigger, so the token is
  -- returned only once the order is fully priced.
  perform public.recalculate_for_order(v_order_id);

  return v_token;
end;
$$;

revoke all on function public.place_order(jsonb,jsonb) from public;
grant execute on function public.place_order(jsonb,jsonb) to anon, authenticated;

-- No test flag exists. Require full reference, prevent deletion of shipped parcels,
-- restore only active reservations and delete atomically. Existing negative states
-- were already restocked by their trigger and must not be restored again.
create or replace function public.delete_elegancia_order(p_id uuid,p_reference uuid)
returns void language plpgsql security definer set search_path=''
as $$
declare o public.orders%rowtype;
begin
 if public.has_admin_role(auth.uid(),array['owner','staff']::public.admin_role[]) is not true then
  raise exception 'Admin only' using errcode='insufficient_privilege';
 end if;
 select * into o from public.orders where id=p_id for update;
 if not found or o.public_token is distinct from p_reference then
  raise exception 'Order reference mismatch' using errcode='check_violation';
 end if;
 -- Confirmed orders may have a carrier API request in flight before tracking is saved.
 if o.tracking_number is not null or o.status in ('confirmed','shipped','delivered') then
  raise exception 'A confirmed order or shipped parcel cannot be deleted' using errcode='check_violation';
 end if;
 if o.status = 'pending' then
  update public.product_variants v set stock=v.stock+q.quantity
  from (select variant_id,sum(quantity)::integer quantity from public.order_items
        where order_id=o.id group by variant_id) q where v.id=q.variant_id;
 end if;
 delete from public.orders where id=o.id;
end;
$$;
revoke all on function public.delete_elegancia_order(uuid,uuid) from public,anon;
grant execute on function public.delete_elegancia_order(uuid,uuid) to authenticated;
revoke delete on public.orders from authenticated;

create or replace function public.elegancia_schema_version()
returns integer language plpgsql stable security invoker set search_path=''
as $$
begin
 if public.has_admin_role(auth.uid(),array['owner','staff']::public.admin_role[]) is not true then
  raise exception 'Admin only' using errcode='insufficient_privilege';
 end if;
 return 1;
end;
$$;
revoke all on function public.elegancia_schema_version() from public,anon;
grant execute on function public.elegancia_schema_version() to authenticated;

create or replace function public.validate_review()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform pg_advisory_xact_lock(hashtext('elegancia-review-limit'));
  if (select count(*) from public.reviews where not is_approved and created_at > now()-interval '1 hour') >= 20 then
    raise exception 'Too many waiting reviews' using errcode='check_violation';
  end if;
  if length(trim(coalesce(new.customer_name, ''))) < 2 or length(new.customer_name) > 120 then
    raise exception 'Invalid customer_name';
  end if;
  if length(trim(coalesce(new.comment, ''))) < 3 or length(new.comment) > 2000 then
    raise exception 'Invalid comment';
  end if;
  -- Nobody self-approves, not even a signed-in admin pasting their own row in.
  new.is_approved := false;
  return new;
end;
$$;
revoke all on function public.validate_review() from public,anon,authenticated;

-- Spreadsheet escaping belongs to export data only, never the saved order itself.
create or replace function public.spreadsheet_safe_json(value jsonb)
returns jsonb language plpgsql immutable security invoker set search_path=''
as $$
declare result jsonb; text_value text;
begin
 case jsonb_typeof(value)
 when 'string' then
  text_value:=value#>>'{}';
  if text_value ~ ('^[[:space:]' || chr(65279) || ']*[=+@-]') then text_value:=chr(39)||text_value; end if;
  return to_jsonb(text_value);
 when 'array' then
  select coalesce(jsonb_agg(public.spreadsheet_safe_json(e)),'[]'::jsonb) into result from jsonb_array_elements(value) e;
 when 'object' then
  select coalesce(jsonb_object_agg(k,public.spreadsheet_safe_json(v)),'{}'::jsonb) into result from jsonb_each(value) as t(k,v);
 else return value;
 end case;
 return result;
end;
$$;
revoke all on function public.spreadsheet_safe_json(jsonb) from public,anon,authenticated;

create or replace function public.order_export_payload(p_order_id uuid, p_event text)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select public.spreadsheet_safe_json(jsonb_build_object(
    'event', p_event,
    'sent_at', now(),
    'shop', (
      select jsonb_build_object('name', s.name, 'phone', s.phone, 'whatsapp', s.whatsapp)
      from public.store_settings s where s.id = 1
    ),
    'order', jsonb_build_object(
      'id', o.id,
      'token', o.public_token,
      'customer_name', o.customer_name,
      'phone', o.phone,
      'wilaya', o.wilaya,
      'commune', o.commune,
      'address', o.address,
      'note', o.note,
      'subtotal', o.subtotal,
      'delivery_fee', o.delivery_fee,
      'total', o.total,
      'status', o.status,
      'created_at', o.created_at,
      'confirmed_at', o.confirmed_at,
      'refused_at', o.refused_at,
      'refused_reason', o.refused_reason,
      'shipped_at', o.shipped_at,
      'delivered_at', o.delivered_at,
      'carrier', o.carrier,
      'tracking_number', o.tracking_number,
      'tracking_url', o.tracking_url
    ),
    'items', coalesce(
      (
        select jsonb_agg(
          jsonb_build_object(
            'product_name', i.product_name,
            'variant_label', i.variant_label,
            'quantity', i.quantity,
            'unit_price', i.unit_price,
            'line_total', i.unit_price * i.quantity
          )
          order by i.created_at
        )
        from public.order_items i where i.order_id = o.id
      ),
      '[]'::jsonb
    )
  ))
  from public.orders o
  where o.id = p_order_id;
$$;
revoke all on function public.order_export_payload(uuid,text) from public,anon,authenticated;
