-- Run as postgres ONLY on a disposable database with schema.sql + all migrations applied.
-- psql -v ON_ERROR_STOP=1 -f supabase/tests/packers-stock-regression.sql
-- No commit: all fixture writes, including queued exports, are rolled back.
begin;
do $$
declare
  v_variant uuid;
  v_token uuid;
  v_order uuid;
  v_stock integer;
begin
  update public.store_settings set accepts_cod = true, delivery_wilayas = array['Alger'] where id = 1;
  insert into public.delivery_zones(wilaya, fee, is_active)
  values ('Alger', 600, true)
  on conflict (wilaya) do update set fee = 600, is_active = true;
  select id into strict v_variant from public.product_variants where is_active limit 1;
  update public.product_variants set stock = 10 where id = v_variant;
  v_token := public.place_order(
    '{"customer_name":"Packers regression","phone":"0555550199","wilaya":"Alger","commune":"Alger Centre","address":"Disposable test address"}',
    jsonb_build_array(jsonb_build_object('variant_id', v_variant, 'quantity', 2))
  );
  select id into strict v_order from public.orders where public_token = v_token;
  select stock into v_stock from public.product_variants where id = v_variant;
  assert v_stock = 8, 'Order must reserve stock';
  update public.orders set carrier = 'Packers', tracking_number = 'TEST-ONLY', status = 'confirmed',
    created_at = now() - interval '25 hours' where id = v_order;
  perform public.expire_stale_pending_orders();
  assert (select status = 'confirmed' from public.orders where id = v_order), 'Confirmed order expired';
  update public.orders set status = 'shipped' where id = v_order;
  update public.orders set status = 'refused' where id = v_order;
  select stock into v_stock from public.product_variants where id = v_variant;
  assert v_stock = 10, 'Existing refusal policy must release once';
  update public.orders set status = 'refused' where id = v_order;
  update public.orders set status = 'returned' where id = v_order;
  update public.orders set status = 'returned' where id = v_order;
  select stock into v_stock from public.product_variants where id = v_variant;
  assert v_stock = 10, 'Repeated refusal/return must not double-restock';
end;
$$;
rollback;
