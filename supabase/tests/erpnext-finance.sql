-- Disposable database only. Run after all migrations. No real ERPNext calls.
begin;
create function pg_temp.assert_true(value boolean, message text) returns void language plpgsql as $$
begin if value is not true then raise exception '%',message; end if; end;
$$;
insert into auth.users(id) values ('eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee');
insert into public.admin_users(user_id,role) values ('eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee','owner');
select set_config('request.jwt.claim.sub','eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee',true);
update public.store_settings set accepts_cod=true,delivery_wilayas=array['Alger'] where id=1;
insert into public.delivery_zones(wilaya,fee,stopdesk_fee) values('Alger',600,400)
 on conflict(wilaya) do update set fee=600,stopdesk_fee=400,is_active=true;
insert into public.products(id,slug,name,status) values('eeeeeeee-0001-4000-8000-000000000001','erp-fixture','ERP fixture','published');
insert into public.product_variants(id,product_id,price,stock,is_active)
 values('eeeeeeee-0002-4000-8000-000000000002','eeeeeeee-0001-4000-8000-000000000001',1000,10,true);

do $$
declare token uuid; oid uuid; claim jsonb; receipt_at timestamptz := now(); rev integer;
begin
 token := public.place_order('{"customer_name":"ERP TEST","phone":"0555123456","wilaya":"Alger","commune":"Alger Centre","address":"Adresse de test","total":1}'::jsonb,
   '[{"variant_id":"eeeeeeee-0002-4000-8000-000000000002","quantity":1,"unit_price":1}]'::jsonb);
 select id into oid from public.orders where public_token=token;
 perform pg_temp.assert_true((select total=1600 from public.orders where id=oid),'server amounts must win');
 perform pg_temp.assert_true(not exists(select 1 from public.order_finance where order_id=oid),'pending must not enter ERP queue');
 update public.orders set status='confirmed',confirmed_at=now() where id=oid;
 update public.orders set status='confirmed' where id=oid;
 perform pg_temp.assert_true((select revision=1 from public.erp_sync_queue where order_id=oid),'double confirmation duplicates event');
 claim := public.erp_claim_sync(oid);
 perform pg_temp.assert_true(claim is not null,'first claim');
 perform pg_temp.assert_true(public.erp_claim_sync(oid) is null,'concurrent claim must be excluded');
 perform pg_temp.assert_true(not public.erp_save_sync(oid,gen_random_uuid(),'{}'),'stale token must be rejected');
 perform public.erp_save_sync(oid,(claim->>'lock_token')::uuid,'{"erp_sync_status":"synced","erp_sales_order_id":"SYNTHETIC-SO"}',true);
 update public.orders set status='shipped' where id=oid;
 update public.orders set status='delivered',delivered_at=now() where id=oid;
 select revision into rev from public.erp_sync_queue where order_id=oid;
 update public.orders set status='delivered' where id=oid;
 perform pg_temp.assert_true((select revision=rev from public.erp_sync_queue where order_id=oid),'double delivery duplicates event');
 perform pg_temp.assert_true((select cod_received_at is null and erp_payment_entry_id is null from public.order_finance where order_id=oid),'delivery must not imply receipt');
 perform public.erp_record_cod_receipt(oid,1600,'SYNTHETIC-RECEIPT',receipt_at);
 select revision into rev from public.erp_sync_queue where order_id=oid;
 perform public.erp_record_cod_receipt(oid,1600,'SYNTHETIC-RECEIPT',receipt_at);
 perform pg_temp.assert_true((select revision=rev from public.erp_sync_queue where order_id=oid),'duplicate receipt duplicates event');
 begin perform public.erp_record_cod_receipt(oid,100,'NET',receipt_at);
   raise exception 'partial payment unexpectedly accepted'; exception when check_violation then null; end;
 begin delete from public.orders where id=oid;
   raise exception 'financial history unexpectedly deleted'; exception when check_violation then null; end;
 update public.orders set status='returned' where id=oid;
 update public.orders set status='returned' where id=oid;
 perform pg_temp.assert_true((select stock=10 from public.product_variants where id='eeeeeeee-0002-4000-8000-000000000002'),'stock must be restored exactly once');
 perform pg_temp.assert_true(not has_table_privilege('anon','public.order_finance','SELECT'),'anonymous finance access');
 perform pg_temp.assert_true(not has_table_privilege('authenticated','public.order_finance','UPDATE'),'client can rewrite ERP references');
 perform pg_temp.assert_true(not has_function_privilege('authenticated','public.erp_claim_sync(uuid)','EXECUTE'),'client can claim privileged queue');
 perform pg_temp.assert_true(not has_function_privilege('anon','public.erp_record_cod_receipt(uuid,integer,text,timestamptz)','EXECUTE'),'anonymous receipt access');
end;
$$;
-- Feature off means never attempted: retain the existing delete workflow for negative orders.
do $$
declare token uuid; oid uuid;
begin
 token := public.place_order('{"customer_name":"ERP OFF","phone":"0555123457","wilaya":"Alger","commune":"Alger Centre","address":"Adresse de test"}',
   '[{"variant_id":"eeeeeeee-0002-4000-8000-000000000002","quantity":1}]');
 select id into oid from public.orders where public_token=token;
 update public.orders set status='confirmed',confirmed_at=now() where id=oid;
 update public.orders set status='refused' where id=oid;
 perform public.delete_elegancia_order(oid,token);
 perform pg_temp.assert_true(not exists(select 1 from public.orders where id=oid),'flag off changed deletion of unsynchronized orders');
end;
$$;
-- RLS separately from grants: a signed-in non-admin must not see finance rows or mappings.
select set_config('request.jwt.claim.sub','dddddddd-dddd-4ddd-8ddd-dddddddddddd',true);
set local role authenticated;
select pg_temp.assert_true((select count(*)=0 from public.order_finance),'non-admin sees finance');
select pg_temp.assert_true((select count(*)=0 from public.erp_item_mappings),'non-admin sees mappings');
reset role;
rollback;
