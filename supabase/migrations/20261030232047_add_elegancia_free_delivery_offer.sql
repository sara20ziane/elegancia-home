-- Elegancia commercial delivery offer.
-- Packers remains the source of the base tariff, but Elegancia covers the fee
-- when the order contains enough bedding sets:
--   2+ parures => Stop Desk delivery free
--   3+ parures => home delivery free
-- Only variants explicitly configured as a parure count toward the offer.

create or replace function public.recalculate_for_order(p_order_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_subtotal int := 0;
  v_parure_qty int := 0;
  v_method text := 'home';
  v_wilaya text;
  v_delivery_fee int := 0;
begin
  select
    coalesce(sum(oi.quantity * oi.unit_price), 0)::int,
    coalesce(sum(
      case
        when pv.set_type in ('Parure de drap', 'Parure housse de couette') then oi.quantity
        else 0
      end
    ), 0)::int
    into v_subtotal, v_parure_qty
    from public.order_items oi
    join public.product_variants pv on pv.id = oi.variant_id
   where oi.order_id = p_order_id;

  select coalesce(o.delivery_method, 'home'), o.wilaya
    into v_method, v_wilaya
    from public.orders o
   where o.id = p_order_id;

  v_delivery_fee := public.delivery_fee_for(v_wilaya, v_subtotal, v_method);

  if v_method = 'stopdesk' and v_parure_qty >= 2 then
    v_delivery_fee := 0;
  elsif v_method = 'home' and v_parure_qty >= 3 then
    v_delivery_fee := 0;
  end if;

  update public.orders
     set subtotal = v_subtotal,
         delivery_fee = v_delivery_fee,
         total = v_subtotal + v_delivery_fee
   where id = p_order_id;
end;
$$;
