-- Disposable database only, after the complete migration chain. All fixture writes roll back.
-- psql -v ON_ERROR_STOP=1 -f supabase/tests/selected_openstore_safety.sql
begin;
update public.store_settings set accepts_cod=true, delivery_wilayas=array['Alger'] where id=1;
insert into public.delivery_zones(wilaya,fee,is_active) values('Alger',600,true)
on conflict(wilaya) do update set fee=600,is_active=true;
update public.product_variants set stock=1000 where is_active;
insert into auth.users(id) values('00000000-0000-4000-8000-000000000001');
insert into public.admin_users(user_id,role) values('00000000-0000-4000-8000-000000000001','owner');
create function pg_temp.customer(n integer) returns jsonb language sql as $$
 select jsonb_build_object('customer_name','TEST ONLY','phone','05'||lpad(n::text,8,'0'),
 'wilaya','Alger','commune','Alger Centre','address','Disposable test address');
$$;
set local role anon;
do $$
declare v uuid; token uuid; ids uuid[]; i integer;
begin
 select array_agg(id) into ids from (select id from public.product_variants where is_active limit 3) s;
 v:=ids[1];
 begin
  perform public.place_order(pg_temp.customer(1),jsonb_build_array(jsonb_build_object('variant_id',v,'quantity',21)));
  raise exception '21 units accepted';
 exception when check_violation then null; end;
 begin
  perform public.place_order(pg_temp.customer(1),jsonb_build_array(jsonb_build_object('variant_id',v,'quantity',11),jsonb_build_object('variant_id',v,'quantity',10)));
  raise exception 'Duplicate-line bypass';
 exception when check_violation then null; end;
 begin
  perform public.place_order(pg_temp.customer(1),jsonb_build_array(jsonb_build_object('variant_id',ids[1],'quantity',17),jsonb_build_object('variant_id',ids[2],'quantity',17),jsonb_build_object('variant_id',ids[3],'quantity',17)));
  raise exception '51 pieces accepted';
 exception when check_violation then null; end;
 begin
  perform public.place_order(pg_temp.customer(1),jsonb_build_array(jsonb_build_object('variant_id',v,'quantity',-1)));
  raise exception 'Negative quantity accepted';
 exception when check_violation then null; end;
 perform set_config('request.headers','{"cf-connecting-ip":"192.0.2.50"}',true);
 for i in 10..19 loop
  token:=public.place_order(pg_temp.customer(i),jsonb_build_array(jsonb_build_object('variant_id',v,'quantity',1)));
  assert token is not null;
 end loop;
 begin
  perform public.place_order(pg_temp.customer(20),jsonb_build_array(jsonb_build_object('variant_id',v,'quantity',1)));
  raise exception '11th order accepted';
 exception when check_violation then null; end;
 begin perform public.delete_elegancia_order(v,v); raise exception 'anon delete allowed'; exception when insufficient_privilege then null; end;
 assert not has_table_privilege('anon','public.orders','select');
 assert not has_function_privilege('anon','public.elegancia_schema_version()','execute');
end;
$$;
reset role;
select set_config('request.headers','{}',true);
set local role authenticated;
do $$
begin
 begin perform public.delete_elegancia_order(gen_random_uuid(),gen_random_uuid()); raise exception 'Non-admin delete allowed'; exception when insufficient_privilege then null; end;
 begin perform public.elegancia_schema_version(); raise exception 'Non-admin schema read allowed'; exception when insufficient_privilege then null; end;
end;
$$;
reset role;
select set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000001',true);
set local role authenticated;
do $$
declare v uuid; token uuid; order_id uuid; stock_before integer;
begin
 select id,stock into v,stock_before from public.product_variants where is_active limit 1;
 token:=public.place_order(pg_temp.customer(30),jsonb_build_array(jsonb_build_object('variant_id',v,'quantity',2)));
 select id into order_id from public.orders where public_token=token;
 assert (select stock=stock_before-2 from public.product_variants where id=v);
 begin perform public.delete_elegancia_order(order_id,v); raise exception 'Wrong confirmation accepted'; exception when check_violation then null; end;
 perform public.delete_elegancia_order(order_id,token);
 assert not exists(select 1 from public.orders where id=order_id);
 assert (select stock=stock_before from public.product_variants where id=v);
 begin perform public.delete_elegancia_order(order_id,token); raise exception 'Repeated delete accepted'; exception when check_violation then null; end;
 assert (select stock=stock_before from public.product_variants where id=v);
 token:=public.place_order(pg_temp.customer(31),jsonb_build_array(jsonb_build_object('variant_id',v,'quantity',2)));
 select id into order_id from public.orders where public_token=token;
 update public.orders set status='refused' where id=order_id;
 perform public.delete_elegancia_order(order_id,token);
 assert (select stock=stock_before from public.product_variants where id=v), 'Negative order double-restocked';
 token:=public.place_order(pg_temp.customer(32),jsonb_build_array(jsonb_build_object('variant_id',v,'quantity',1)));
 select id into order_id from public.orders where public_token=token;
 update public.orders set status='confirmed' where id=order_id;
 begin perform public.delete_elegancia_order(order_id,token); raise exception 'Confirmed order deleted'; exception when check_violation then null; end;
 update public.orders set tracking_number='TEST-ONLY' where id=order_id;
 begin perform public.delete_elegancia_order(order_id,token); raise exception 'Parcel deleted'; exception when check_violation then null; end;
 assert public.elegancia_schema_version()=1;
 assert not has_table_privilege('authenticated','public.orders','delete');
end;
$$;
reset role;
do $$
declare i integer;
begin
 assert public.spreadsheet_safe_json('{"name":"=IMPORTXML()","items":[" +SUM(1)",12]}'::jsonb) = jsonb_build_object('name',chr(39)||'=IMPORTXML()','items',jsonb_build_array(chr(39)||' +SUM(1)',12));
 assert not has_table_privilege('anon','public.order_connection_limits','select');
 assert not has_table_privilege('authenticated','public.order_connection_limits','select');
 delete from public.reviews;
 for i in 1..20 loop
  insert into public.reviews(customer_name,rating,comment,is_approved) values('TEST ONLY',5,'Disposable review',true);
 end loop;
 assert (select count(*)=20 from public.reviews where not is_approved);
 begin
  insert into public.reviews(customer_name,rating,comment) values('TEST ONLY',5,'Excess test review');
  raise exception '21st pending review accepted';
 exception when check_violation then null; end;
end;
$$;
rollback;
