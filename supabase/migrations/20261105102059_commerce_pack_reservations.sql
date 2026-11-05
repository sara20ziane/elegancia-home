-- No historic stock or order backfill. Existing reservations remain untouched.
create schema commerce_private;
revoke all on schema commerce_private from public,anon,authenticated;
alter table public.order_items add column reserved_components jsonb not null default '[]'
 check(jsonb_typeof(reserved_components)='array');

create function commerce_private.guard_pack() returns trigger
language plpgsql security definer set search_path='' as $$
begin
 perform pg_advisory_xact_lock(hashtext('elegancia-stock-reservations-v1'));
 if tg_op='DELETE' then return old; end if;
 if not exists(select 1 from public.products where id=new.product_id and kind='pack')
 or not exists(select 1 from public.product_variants v join public.products p on p.id=v.product_id
   where v.id=new.variant_id and p.kind='single' and p.id<>new.product_id) then
  raise exception 'Un pack doit contenir uniquement des variantes de produits simples';
 end if;
 return new;
end $$;
create trigger commerce_pack_composition before insert or update or delete on public.pack_items
 for each row execute function commerce_private.guard_pack();

create function commerce_private.protect_reservation() returns trigger
language plpgsql security definer set search_path='' as $$
begin
 if (new.order_id,new.variant_id,new.quantity,new.reserved_components) is distinct from
    (old.order_id,old.variant_id,old.quantity,old.reserved_components) then
  raise exception 'Réservation immuable : annuler puis recréer la commande pour changer les articles';
 end if;
 return new;
end $$;
create trigger commerce_reservation_immutable before update on public.order_items
 for each row execute function commerce_private.protect_reservation();
create function commerce_private.release_removed_item() returns trigger
language plpgsql security definer set search_path='' as $$
declare part record;
begin
 perform pg_advisory_xact_lock(hashtext('elegancia-stock-reservations-v1'));
 if exists(select 1 from public.orders where id=old.order_id and status not in ('refused','cancelled','returned')) then
  for part in select variant_id,sum(quantity)::integer quantity from (
   select old.variant_id variant_id,old.quantity quantity union all
   select (x->>'variant_id')::uuid,(x->>'quantity')::integer from jsonb_array_elements(old.reserved_components) x
  ) q group by variant_id order by variant_id loop
   update public.product_variants set stock=stock+part.quantity where id=part.variant_id;
  end loop;
 end if;
 return old;
end $$;
create trigger commerce_removed_item before delete on public.order_items
 for each row execute function commerce_private.release_removed_item();
create function commerce_private.protect_component() returns trigger
language plpgsql security definer set search_path='' as $$
begin
 if exists(select 1 from public.order_items i join public.orders o on o.id=i.order_id
  where o.status not in ('refused','cancelled','returned')
   and i.reserved_components @> jsonb_build_array(jsonb_build_object('variant_id',old.id))) then
  raise exception 'Composant réservé par une commande active : désactivez-le au lieu de le supprimer';
 end if;
 return old;
end $$;
create trigger commerce_reserved_component before delete on public.product_variants
 for each row execute function commerce_private.protect_component();

create or replace function public.validate_order_item() returns trigger
language plpgsql security definer set search_path='' as $$
declare kind public.product_kind; product uuid; component record; snapshot jsonb:='[]';
begin
 perform pg_advisory_xact_lock(hashtext('elegancia-stock-reservations-v1'));
 if new.quantity is null or new.quantity not between 1 and 100 then
  raise exception 'Invalid quantity' using errcode='check_violation';
 end if;
 select v.price,nullif(concat_ws(' / ',nullif(v.size,''),nullif(v.color_name,'')),''),p.name,p.kind,p.id
 into new.unit_price,new.variant_label,new.product_name,kind,product
 from public.product_variants v join public.products p on p.id=v.product_id
 where v.id=new.variant_id and v.is_active and p.status='published';
 if not found then raise exception 'Variant unavailable' using errcode='check_violation'; end if;
 if kind='pack' then
  if not exists(select 1 from public.pack_items where product_id=product) then
   raise exception 'Pack sans composants' using errcode='check_violation';
  end if;
  for component in select i.variant_id,i.quantity,v.product_id,v.size,v.color_name,p.name product_name
   from public.pack_items i join public.product_variants v on v.id=i.variant_id join public.products p on p.id=v.product_id
   where i.product_id=product order by i.variant_id loop
   update public.product_variants v set stock=v.stock-component.quantity*new.quantity
   where v.id=component.variant_id and v.is_active and v.stock>=component.quantity*new.quantity
    and exists(select 1 from public.products p where p.id=v.product_id and p.kind='single' and p.status='published');
   if not found then raise exception 'Composant du pack indisponible' using errcode='check_violation'; end if;
   snapshot:=snapshot||jsonb_build_array(jsonb_build_object('variant_id',component.variant_id,'quantity',component.quantity*new.quantity,
    'product_name',component.product_name,'variant_label',nullif(concat_ws(' / ',nullif(component.size,''),nullif(component.color_name,'')),'')));
  end loop;
 end if;
 update public.product_variants set stock=stock-new.quantity
 where id=new.variant_id and is_active and stock>=new.quantity;
 if not found then raise exception 'Insufficient stock' using errcode='check_violation'; end if;
 new.reserved_components:=snapshot;
 return new;
end $$;

-- Exact quantities, including repeated lines and shared components; no repricing.
create function commerce_private.move_reservation(p_order uuid,p_release boolean) returns void
language plpgsql security definer set search_path='' as $$
declare line record;
begin
 perform pg_advisory_xact_lock(hashtext('elegancia-stock-reservations-v1'));
 for line in
  select variant_id,sum(quantity)::integer quantity from (
   select variant_id,quantity from public.order_items where order_id=p_order
   union all
   select (x->>'variant_id')::uuid,(x->>'quantity')::integer
   from public.order_items i cross join lateral jsonb_array_elements(i.reserved_components) x where i.order_id=p_order
  ) q where variant_id is not null group by variant_id order by variant_id
 loop
  update public.product_variants set stock=stock+case when p_release then line.quantity else -line.quantity end
   where id=line.variant_id and (p_release or (is_active and stock>=line.quantity));
  if not found and not p_release then raise exception 'Stock insuffisant pour réactiver la commande'; end if;
 end loop;
end $$;
create or replace function public.restock_on_negative_status() returns trigger
language plpgsql security definer set search_path='' as $$
declare old_negative boolean:=old.status in ('refused','cancelled','returned');
 new_negative boolean:=new.status in ('refused','cancelled','returned');
begin
 if old_negative is distinct from new_negative then
  perform commerce_private.move_reservation(new.id,new_negative);
 end if;
 return new;
end $$;
create or replace function public.delete_elegancia_order(p_id uuid,p_reference uuid) returns void
language plpgsql security definer set search_path='' as $$
declare o public.orders%rowtype;
begin
 if public.has_admin_role(auth.uid(),array['owner','staff']::public.admin_role[]) is not true then
  raise exception 'Admin only' using errcode='insufficient_privilege';
 end if;
 select * into o from public.orders where id=p_id for update;
 if not found or o.public_token is distinct from p_reference then raise exception 'Order reference mismatch' using errcode='check_violation'; end if;
 if o.tracking_number is not null or o.status in ('confirmed','shipped','delivered') then
  raise exception 'A confirmed order or shipped parcel cannot be deleted' using errcode='check_violation';
 end if;
 if o.status='pending' then update public.orders set status='cancelled' where id=o.id; end if;
 delete from public.orders where id=o.id;
end $$;

-- Stock on a pack variant remains a seller-defined cap; components further limit it.
create function commerce_private.sellable_stock(p_variant uuid) returns integer
language sql stable set search_path='' as $$
 select case when p.kind='single' then v.stock else least(v.stock,coalesce((
  select min(case when cv.is_active and cp.status='published' and cp.kind='single'
   then cv.stock/i.quantity else 0 end)::integer
  from public.pack_items i join public.product_variants cv on cv.id=i.variant_id
  join public.products cp on cp.id=cv.product_id where i.product_id=p.id),0)) end
 from public.product_variants v join public.products p on p.id=v.product_id where v.id=p_variant;
$$;
create function public.pack_availability(p_product uuid) returns table(variant_id uuid,stock integer)
language sql stable security invoker set search_path='' as $$
 select v.id,least(v.stock,coalesce((select min(case when cv.is_active and cp.kind='single' and cp.status='published' then cv.stock/i.quantity else 0 end)::integer
  from public.pack_items i left join public.product_variants cv on cv.id=i.variant_id
  left join public.products cp on cp.id=cv.product_id
  where i.product_id=p.id),0))
 from public.products p join public.product_variants v on v.product_id=p.id
 where p.id=p_product and p.kind='pack' and v.is_active;
$$;
revoke all on all functions in schema commerce_private from public,anon,authenticated;
revoke all on function public.validate_order_item(),public.restock_on_negative_status() from public,anon,authenticated;
revoke all on function public.delete_elegancia_order(uuid,uuid) from public,anon;
grant execute on function public.delete_elegancia_order(uuid,uuid) to authenticated;
revoke all on function public.pack_availability(uuid) from public;
grant execute on function public.pack_availability(uuid) to anon,authenticated;
notify pgrst,'reload schema';
