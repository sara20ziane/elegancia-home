-- Disposable database only. Demonstrate preservation with nonempty financial history.
begin;
insert into auth.users values('cccccccc-0000-4000-8000-000000000001');
insert into admin_users(user_id,role) values('cccccccc-0000-4000-8000-000000000001','owner');
select set_config('request.jwt.claim.sub','cccccccc-0000-4000-8000-000000000001',true);
select finance_save_entity('account','{"id":"cccccccc-1000-4000-8000-000000000001","name":"Catalogue COD fixture","kind":"receivable"}');
select finance_configure('{"enabled":true,"cod_account_id":"cccccccc-1000-4000-8000-000000000001"}');
update store_settings set accepts_cod=true,delivery_wilayas=array['Alger'] where id=1;
insert into delivery_zones(wilaya,fee,stopdesk_fee,is_active) values('Alger',600,400,true)
 on conflict(wilaya) do update set fee=600,stopdesk_fee=400,is_active=true;
insert into products(id,slug,name,status) values('cccccccc-4000-4000-8000-000000000001','catalog-history-fixture','Catalogue fixture','published');
insert into product_variants(id,product_id,price,stock,size,set_type,piece_count,fabric,sku)
 values('cccccccc-5000-4000-8000-000000000001','cccccccc-4000-4000-8000-000000000001',9500,10,'Queen size','Parure housse de couette',6,'Coton','HISTORIQUE-CATALOGUE');
select finance_set_cost('cccccccc-5000-4000-8000-000000000001',1200,'cccccccc-6000-4000-8000-000000000001');
do $$ declare tok uuid; oid uuid; invoice uuid; before_state jsonb; after_state jsonb; key_name text; begin
 tok:=place_order('{"customer_name":"Catalogue fixture","phone":"0555111222","wilaya":"Alger","commune":"Alger Centre","address":"Adresse synthétique"}',
  '[{"variant_id":"cccccccc-5000-4000-8000-000000000001","quantity":1}]');
 select id into oid from orders where public_token=tok;
 update orders set status='confirmed',confirmed_at=clock_timestamp(),carrier='Packers' where id=oid;
 update orders set status='shipped' where id=oid;
 update orders set status='delivered',delivered_at=clock_timestamp() where id=oid;
 invoice:=finance_prepare_order(oid);
 perform finance_issue_invoice(invoice);
 before_state:=jsonb_build_object(
  'variant_costs',(select jsonb_agg(to_jsonb(t) order by id) from variant_costs t),
  'orders',(select jsonb_agg(to_jsonb(t) order by id) from orders t),
  'order_items',(select jsonb_agg(to_jsonb(t) order by id) from order_items t),
  'invoices',(select jsonb_agg(to_jsonb(t) order by id) from invoices t),
  'invoice_items',(select jsonb_agg(to_jsonb(t) order by id) from invoice_items t),
  'financial_movements',(select jsonb_agg(to_jsonb(t) order by id) from financial_movements t),
  'order_finance',(select jsonb_agg(to_jsonb(t) order by order_id) from order_finance t),
  'finance_settings',(select to_jsonb(t) from finance_settings t));
 foreach key_name in array array['variant_costs','orders','invoices','financial_movements'] loop
  if jsonb_array_length(before_state->key_name)<1 then raise exception 'Empty preservation fixture: %',key_name; end if;
 end loop;
 perform catalog_generate(jsonb_build_object('request_id',gen_random_uuid(),'product_id','cccccccc-4000-4000-8000-000000000001','variants',
  '[{"size":"King size","set_type":"Parure housse de couette","piece_count":6,"fabric":"Coton","price":9500,"stock":2}]'::jsonb));
 perform catalog_apply_common('cccccccc-4000-4000-8000-000000000001','{"fabric":"Percale","price":11000}');
 update product_variants set sku='NOUVEAU-CATALOGUE' where id='cccccccc-5000-4000-8000-000000000001';
 begin
  perform catalog_generate(jsonb_build_object('request_id',gen_random_uuid(),'product_id','cccccccc-4000-4000-8000-000000000001','variants',
   '[{"size":"Queen size","set_type":"Parure housse de couette","piece_count":6,"fabric":"Percale","price":20000,"stock":9,"sku":"DIFFERENT-02"}]'::jsonb));
  raise exception 'Commercial duplicate was accepted';
 exception when unique_violation then null;
 end;
 after_state:=jsonb_build_object(
  'variant_costs',(select jsonb_agg(to_jsonb(t) order by id) from variant_costs t),
  'orders',(select jsonb_agg(to_jsonb(t) order by id) from orders t),
  'order_items',(select jsonb_agg(to_jsonb(t) order by id) from order_items t),
  'invoices',(select jsonb_agg(to_jsonb(t) order by id) from invoices t),
  'invoice_items',(select jsonb_agg(to_jsonb(t) order by id) from invoice_items t),
  'financial_movements',(select jsonb_agg(to_jsonb(t) order by id) from financial_movements t),
  'order_finance',(select jsonb_agg(to_jsonb(t) order by order_id) from order_finance t),
  'finance_settings',(select to_jsonb(t) from finance_settings t));
 if before_state is distinct from after_state then raise exception 'Catalogue changed financial history'; end if;
 if not exists(select 1 from product_variants where id='cccccccc-5000-4000-8000-000000000001') then raise exception 'Original variant was recreated'; end if;
end $$;
rollback;
