-- Additive administrative read APIs. No Finance activation or financial writes.
create function public.admin_commerce_analytics(p_days integer default 30,p_min_orders integer default 3,
 p_from date default null,p_to date default null) returns jsonb
language plpgsql stable security definer set search_path='' as $$
declare start_day date; end_day date; since_time timestamptz; until_time timestamptz;
begin
 if public.has_admin_role(auth.uid(),array['owner','staff']::public.admin_role[]) is not true then
  raise exception 'Admin only' using errcode='insufficient_privilege';
 end if;
 end_day:=coalesce(p_to,(now() at time zone 'Africa/Algiers')::date);
 start_day:=coalesce(p_from,end_day-(greatest(1,least(coalesce(p_days,30),366))-1));
 if start_day>end_day or end_day-start_day>365 or p_min_orders not between 1 and 1000 then
  raise exception 'Période ou seuil invalide';
 end if;
 since_time:=start_day::timestamp at time zone 'Africa/Algiers';
 until_time:=(end_day+1)::timestamp at time zone 'Africa/Algiers';
 return (with win as(select * from public.orders where created_at>=since_time and created_at<until_time),
 sales as(select v.product_id,sum(i.quantity) units,sum(i.quantity*i.unit_price) value
  from public.order_items i join win o on o.id=i.order_id join public.product_variants v on v.id=i.variant_id
  where o.status in ('confirmed','shipped','delivered') group by v.product_id)
 select jsonb_build_object(
  'days',end_day-start_day+1,'from',start_day,'to',end_day,'minOrders',p_min_orders,
  'totals',(select jsonb_build_object('orders',count(*),
   'confirmedOrders',count(*) filter(where status in ('confirmed','shipped','delivered')),
   'confirmedValue',coalesce(sum(total) filter(where status in ('confirmed','shipped','delivered')),0),
   'deliveredValue',coalesce(sum(total) filter(where status='delivered'),0),
   'refused',count(*) filter(where status='refused'),
   'returned',count(*) filter(where status='returned'),'cancelled',count(*) filter(where status='cancelled')) from win),
  'cashReceived',case when (select enabled from public.finance_settings where id=1) and public.finance_is_owner() then
   (select coalesce(sum(case when direction='in' then amount else -amount end),0)
    from public.financial_movements where domain='cash' and kind in ('cod_settlement','withholding_receipt','refund')
     and occurred_at>=since_time and occurred_at<until_time) else null end,
  'revenue',(select coalesce(jsonb_agg(jsonb_build_object('day',d.day::date,'orders',coalesce(x.orders,0),
   'value',coalesce(x.value,0),'deliveredValue',coalesce(x.delivered,0)) order by d.day),'[]')
   from generate_series(start_day::timestamp,end_day::timestamp,interval '1 day') d(day)
   left join (select (created_at at time zone 'Africa/Algiers')::date as day,count(*) orders,
    sum(total) filter(where status in ('confirmed','shipped','delivered')) value,
    sum(total) filter(where status='delivered') delivered from win group by 1) x on x.day=d.day::date),
  'funnel',(select coalesce(jsonb_object_agg(status,n),'{}') from(select status::text status,count(*) n from win group by 1) f),
  'byWilaya',(select coalesce(jsonb_agg(jsonb_build_object('wilaya',wilaya,'total',total,'delivered',delivered,
   'deliveredValue',delivered_value,'refused',refused,'returned',returned,'cancelled',cancelled,
   'refusedValue',refused_value,'rate',round(refused::numeric/total,4),'eligible',total>=p_min_orders)
   order by (total>=p_min_orders) desc,refused::numeric/total desc,total desc,wilaya),'[]')
   from(select wilaya,count(*) total,count(*) filter(where status='delivered') delivered,
    coalesce(sum(total) filter(where status='delivered'),0) delivered_value,
    count(*) filter(where status='refused') refused,count(*) filter(where status='returned') returned,
    count(*) filter(where status='cancelled') cancelled,coalesce(sum(total) filter(where status='refused'),0) refused_value
    from win group by wilaya) w),
  'topProducts',(select coalesce(jsonb_agg(to_jsonb(t) order by units desc,value desc,id),'[]') from(
   select p.id,p.name,s.units,s.value from sales s join public.products p on p.id=s.product_id
   order by units desc,value desc,p.id limit 5) t),
  'slowProducts',(select coalesce(jsonb_agg(to_jsonb(t) order by units,name,id),'[]') from(
   select p.id,p.name,coalesce(s.units,0) units,coalesce(s.value,0) value from public.products p
   left join sales s on s.product_id=p.id where p.status='published' order by units,p.name,p.id limit 5) t),
  'lowStock',(select coalesce(jsonb_agg(to_jsonb(t) order by stock,product,id),'[]') from(
   select v.id,p.name product,nullif(concat_ws(' / ',v.size,v.color_name),'') label,
    commerce_private.sellable_stock(v.id) stock from public.product_variants v join public.products p on p.id=v.product_id
   where v.is_active and p.status='published' and commerce_private.sellable_stock(v.id)<=3
   order by stock,p.name,v.id limit 10) t)));
end $$;
revoke all on function public.admin_commerce_analytics(integer,integer,date,date) from public,anon;
grant execute on function public.admin_commerce_analytics(integer,integer,date,date) to authenticated;
create or replace function public.admin_analytics(p_days integer default 30) returns jsonb
language sql stable security definer set search_path='' as $$
 select public.admin_commerce_analytics(p_days);
$$;

create function public.admin_commerce_phone_history(p_phones text[])
returns table(phone text,orders bigint,confirmed bigint,refused bigint,returned bigint,delivered bigint,pending bigint,blocked boolean)
language plpgsql stable security definer set search_path='' as $$
begin
 if public.has_admin_role(auth.uid(),array['owner','staff']::public.admin_role[]) is not true then
  raise exception 'Admin only' using errcode='insufficient_privilege';
 end if;
 if cardinality(p_phones)>100 then raise exception 'Maximum 100 numéros'; end if;
 return query select c.phone,count(o.id),count(o.id) filter(where o.status in ('confirmed','shipped','delivered')),
  count(o.id) filter(where o.status='refused'),count(o.id) filter(where o.status='returned'),
  count(o.id) filter(where o.status='delivered'),count(o.id) filter(where o.status='pending'),
  exists(select 1 from public.blocked_phones b where b.phone=c.phone)
 from(select distinct public.canonical_dz_phone(x) phone from unnest(p_phones) x) c
 left join public.orders o on public.canonical_dz_phone(o.phone)=c.phone group by c.phone;
end $$;
revoke all on function public.admin_commerce_phone_history(text[]) from public,anon;
grant execute on function public.admin_commerce_phone_history(text[]) to authenticated;
notify pgrst,'reload schema';
