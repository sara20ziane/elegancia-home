-- Disposable database only, after all migrations. Every fixture is rolled back.
begin;
create function pg_temp.check_ok(value boolean, message text) returns void language plpgsql as $$
begin if value is not true then raise exception 'ASSERT: %',message;end if;end;
$$;
create function pg_temp.reject(statement text, message text) returns void language plpgsql as $$
begin
 begin execute statement;raise exception 'MISSING EXPECTED ERROR';
 exception when others then
  if sqlerrm='MISSING EXPECTED ERROR' then raise exception 'ASSERT: %',message;end if;
 end;
end;
$$;
insert into auth.users(id) values('ffffffff-0000-4000-8000-000000000001'),('ffffffff-0000-4000-8000-000000000002');
insert into public.admin_users(user_id,role) values('ffffffff-0000-4000-8000-000000000001','owner'),('ffffffff-0000-4000-8000-000000000002','staff');
select set_config('request.jwt.claim.sub','ffffffff-0000-4000-8000-000000000001',true);
select public.finance_save_entity('account','{"id":"ffffffff-1000-4000-8000-000000000001","name":"Test cash","kind":"cash"}');
select public.finance_save_entity('account','{"id":"ffffffff-1000-4000-8000-000000000002","name":"Test COD","kind":"receivable"}');
select public.finance_save_entity('category','{"id":"ffffffff-2000-4000-8000-000000000001","name":"Test expense"}');
select public.finance_save_entity('supplier','{"id":"ffffffff-3000-4000-8000-000000000001","name":"Test supplier"}');
update public.store_settings set accepts_cod=true,delivery_wilayas=array['Alger'] where id=1;
insert into public.delivery_zones(wilaya,fee,stopdesk_fee) values('Alger',600,400)
 on conflict(wilaya) do update set fee=600,stopdesk_fee=400,is_active=true;
insert into public.products(id,slug,name,status) values('ffffffff-4000-4000-8000-000000000001','native-finance-fixture','Produit figé','published');
insert into public.product_variants(id,product_id,price,stock,sku) values('ffffffff-5000-4000-8000-000000000001','ffffffff-4000-4000-8000-000000000001',10000,100,'TEST-SKU');
select public.finance_set_cost('ffffffff-5000-4000-8000-000000000001',6000,'ffffffff-6000-4000-8000-000000000001');
select public.finance_set_cost('ffffffff-5000-4000-8000-000000000001',6000,'ffffffff-6000-4000-8000-000000000001');
select pg_temp.check_ok((select count(*)=1 from public.variant_costs where variant_id='ffffffff-5000-4000-8000-000000000001'),'cost retry duplicated');

create function pg_temp.new_order() returns uuid language plpgsql as $$
declare tok uuid;oid uuid;
begin
 tok:=public.place_order('{"customer_name":"Cliente test","phone":"0555123456","wilaya":"Alger","commune":"Alger Centre","address":"Adresse de test","total":1}',
 '[{"variant_id":"ffffffff-5000-4000-8000-000000000001","quantity":2,"unit_price":1}]');
 select id into oid from public.orders where public_token=tok;
 update public.orders set status='confirmed',confirmed_at=clock_timestamp(),carrier='Packers' where id=oid;
 return oid;
end;
$$;
create temp table fixture_orders(id uuid,label text);
insert into fixture_orders select pg_temp.new_order(),'historical';
select pg_temp.check_ok((select count(*)=0 from public.order_finance),'capture must be disabled initially');
select public.finance_configure('{"enabled":true,"cod_account_id":"ffffffff-1000-4000-8000-000000000002","company_name":"Elegancia Test","tax_rate":9}');
-- Existing history is never silently imported on an unrelated transition.
update public.orders set created_at=now()-interval '1 day',status='shipped' where id=(select id from fixture_orders where label='historical');
select pg_temp.check_ok((select count(*)=0 from public.order_finance),'historical backfill');
select pg_temp.reject(format('select public.finance_prepare_order(%L)',(select id from fixture_orders where label='historical')),'historical confirmation missing');
select public.finance_prepare_order((select id from fixture_orders where label='historical'),true);
insert into fixture_orders select pg_temp.new_order(),'one';
insert into fixture_orders select pg_temp.new_order(),'two';
insert into fixture_orders select pg_temp.new_order(),'not-delivered';

do $$
declare oid uuid:=(select id from fixture_orders where label='one'); second uuid:=(select id from fixture_orders where label='two');
 invoice uuid;inv2 uuid;saved_number text;saved_payload jsonb;settle jsonb;sid uuid:=gen_random_uuid();credit uuid;expense jsonb;purchase jsonb;holding jsonb;
 day text:=(now() at time zone 'Africa/Algiers')::date::text;cash uuid:='ffffffff-1000-4000-8000-000000000001';count_before integer;
begin
 perform pg_temp.check_ok((select total=20600 and product_cost=12000 from public.order_finance where order_id=oid),'canonical amount and cost snapshot');
 invoice:=public.finance_prepare_order(oid);perform pg_temp.check_ok(public.finance_prepare_order(oid)=invoice,'double draft');
 perform pg_temp.reject(format('select public.finance_issue_invoice(%L)',invoice),'premature invoice accepted');
 update public.orders set status='shipped' where id in(oid,second);
 update public.orders set status='delivered',delivered_at=now() where id in(oid,second);
 select count(*) into count_before from public.financial_movements;
 update public.orders set status='delivered' where id=oid;
 perform pg_temp.check_ok((select count(*)=count_before from public.financial_movements),'double delivery movement');
 perform pg_temp.check_ok(not exists(select 1 from public.financial_movements where domain='cash'),'delivery created cash');
 perform public.finance_issue_invoice(invoice);perform public.finance_issue_invoice(invoice);
 select i.number,i.payload into saved_number,saved_payload from public.invoices i where id=invoice;
 perform pg_temp.check_ok(saved_number ~ '^FAC-[0-9]{4}-[0-9]{6}$','invoice numbering');
 perform pg_temp.check_ok((select status='issued' and paid_at is null from public.invoices where id=invoice),'delivery marked invoice paid');
 perform pg_temp.check_ok((select tax=round(20600::numeric*9/109,2) and total=20600 from public.invoices where id=invoice),'included tax changed total');
 perform pg_temp.reject(format('update public.invoices set total=1 where id=%L',invoice),'issued amount mutable');
 perform pg_temp.reject(format('update public.invoices set number=''BAD'' where id=%L',invoice),'issued number mutable');
 perform pg_temp.reject(format('update public.invoice_items set quantity=5 where invoice_id=%L',invoice),'issued lines mutable');
 update public.products set name='Produit nouveau nom' where id='ffffffff-4000-4000-8000-000000000001';
 update public.product_variants set price=12000,sku='NEW-SKU' where id='ffffffff-5000-4000-8000-000000000001';
 perform public.finance_set_cost('ffffffff-5000-4000-8000-000000000001',6500,gen_random_uuid());
 perform pg_temp.check_ok((select i.payload=saved_payload from public.invoices i where id=invoice),'catalogue changed invoice');
 perform pg_temp.check_ok((select product_cost=12000 from public.order_finance where order_id=oid),'future cost changed margin');
 perform pg_temp.reject(format('delete from public.orders where id=%L',oid),'critical history deleted');
 inv2:=public.finance_prepare_order(second);perform public.finance_issue_invoice(inv2);
 perform pg_temp.check_ok((select i.number<>saved_number from public.invoices i where id=inv2),'number duplicate');
 settle:=jsonb_build_object('id',sid,'orders',jsonb_build_array(oid,second),'carrier','Packers','reference','TEST-BATCH','date',day,
 'expected_gross',41200,'fees',1200,'withheld',2000,'net',38000,'account_id',cash);
 perform pg_temp.reject(format('select public.finance_record_settlement(%L)',settle||'{"net":1}'),'incoherent net accepted');
 perform pg_temp.reject(format('select public.finance_record_settlement(%L)',settle||jsonb_build_object('orders',jsonb_build_array(oid,oid))),'duplicate order in batch');
 perform public.finance_record_settlement(settle);perform public.finance_record_settlement(settle);
 perform pg_temp.check_ok((select count(*)=1 from public.cod_settlements where id=sid),'double settlement');
 perform pg_temp.check_ok((select sum(fees)=1200 and sum(withheld)=2000 and sum(gross)=41200 from public.cod_settlement_items where settlement_id=sid),'batch allocations');
 perform pg_temp.check_ok((select sum(amount)=38000 from public.financial_movements where source_id=sid and domain='cash'),'net cash duplicated');
 perform pg_temp.check_ok((select status='issued' from public.invoices where id=invoice),'withholding counted as received');
 perform pg_temp.check_ok((select sum(case direction when 'in' then amount else -amount end)=2000 from public.financial_movements where account_id='ffffffff-1000-4000-8000-000000000002'),'retained receivable missing from account');
 perform pg_temp.reject(format('select public.finance_record_settlement(%L)',settle||jsonb_build_object('id',gen_random_uuid(),'reference','ANOTHER')),'already settled accepted');
 perform pg_temp.reject(format('select public.finance_record_settlement(%L)',settle||jsonb_build_object('id',gen_random_uuid(),'orders',jsonb_build_array((select id from fixture_orders where label='not-delivered')))),'unshipped order accepted');
 holding:=jsonb_build_object('id',gen_random_uuid(),'settlement_id',sid,'amount',1000,'account_id',cash,'date',day);
 perform public.finance_receive_withholding(holding);perform public.finance_receive_withholding(holding);
 perform pg_temp.check_ok((select status='issued' from public.invoices where id=invoice),'partial withholding marked paid');
 perform public.finance_receive_withholding(holding||jsonb_build_object('id',gen_random_uuid()));
 perform pg_temp.check_ok((select sum(case direction when 'in' then amount else -amount end)=0 from public.financial_movements where account_id='ffffffff-1000-4000-8000-000000000002'),'collected retention remains in account');
 perform pg_temp.check_ok((select status='paid' from public.invoices where id=invoice),'full received invoice unpaid');
 expense:=jsonb_build_object('id',gen_random_uuid(),'date',day,'category_id','ffffffff-2000-4000-8000-000000000001','description','Test expense','amount',1000,'account_id',cash);
 perform public.finance_record_expense(expense);perform public.finance_record_expense(expense);
 perform pg_temp.check_ok((select count(*)=1 from public.finance_expenses where id=(expense->>'id')::uuid),'expense duplicated');
 perform pg_temp.reject(format('delete from public.finance_expenses where id=%L',expense->>'id'),'expense deleted');
 perform public.finance_record_expense(expense||jsonb_build_object('id',gen_random_uuid(),'replaces_id',expense->>'id','amount',1200));
 perform pg_temp.check_ok((select status='voided' from public.finance_expenses where id=(expense->>'id')::uuid),'expense correction missing reversal');
 purchase:=jsonb_build_object('id',gen_random_uuid(),'supplier_id','ffffffff-3000-4000-8000-000000000001','date',day,'reference','TEST-PURCHASE',
 'items',jsonb_build_array(jsonb_build_object('variant_id','ffffffff-5000-4000-8000-000000000001','quantity',3,'unit_cost',7000)));
 perform public.finance_record_purchase(purchase);perform public.finance_record_purchase(purchase);
 perform pg_temp.check_ok((select total=21000 and status='unpaid' from public.finance_purchases where id=(purchase->>'id')::uuid),'purchase server total');
 perform public.finance_pay_purchase((purchase->>'id')::uuid,cash,day::date);perform public.finance_pay_purchase((purchase->>'id')::uuid,cash,day::date);
 perform pg_temp.check_ok((select count(*)=1 from public.financial_movements where source_id=(purchase->>'id')::uuid),'double purchase payment');
 perform pg_temp.check_ok((select product_cost=12000 from public.order_finance where order_id=oid),'purchase changed historic cost');
 credit:=public.finance_create_credit(invoice,'Retour total validé');perform pg_temp.check_ok(public.finance_create_credit(invoice,'Retour total validé')=credit,'duplicate credit');
 perform pg_temp.check_ok((select status='cancelled' from public.invoices where id=invoice),'credit did not cancel');
 perform public.finance_refund_credit(credit,cash,day::date);perform public.finance_refund_credit(credit,cash,day::date);
 perform pg_temp.check_ok((select count(*)=1 from public.finance_refunds where credit_id=credit),'duplicate refund');
 perform pg_temp.check_ok((public.finance_dashboard(day::date,day::date)->>'revenue')::numeric=20600,'revenue incorrectly includes cash or duplicate credit');
 perform pg_temp.check_ok((public.finance_dashboard(day::date,day::date)->>'expenses')::numeric=1200,'expense correction or purchase double counted');
 perform public.finance_report('source',day::date,day::date);
 perform public.finance_report('product',day::date,day::date);
 perform public.finance_report('category',day::date,day::date);
 perform public.finance_report('orders',day::date,day::date);
 perform public.finance_report('expenses',day::date,day::date);
 perform public.finance_report('accounts',day::date,day::date);
 perform pg_temp.check_ok(public.finance_document(invoice,'invoice',gen_random_uuid()) is null,'wrong tracking token accessed invoice');
 perform pg_temp.check_ok(public.finance_document(invoice,'invoice',(select public_token from public.orders where id=oid)) is not null,'valid tracking denied');
 perform pg_temp.check_ok(not has_table_privilege('anon','public.invoices','SELECT'),'public finance tables');
 perform pg_temp.check_ok(not has_table_privilege('authenticated','public.invoices','UPDATE'),'direct invoice updates');
 perform pg_temp.check_ok(not has_function_privilege('authenticated','public.finance_archive_pdf(uuid,text,text,text)','EXECUTE'),'client may publish arbitrary PDF');
end;
$$;

-- Individual payment, unknown costs and failure isolation.
do $$
declare oid uuid; inv uuid; t uuid; before_stock integer; p jsonb; day text:=(now() at time zone 'Africa/Algiers')::date::text;
begin
 select stock into before_stock from public.product_variants where id='ffffffff-5000-4000-8000-000000000001';
 oid:=pg_temp.new_order();
 update public.orders set status='shipped' where id=oid;
 update public.orders set status='delivered',delivered_at=now() where id=oid;
 p:=jsonb_build_object('id',gen_random_uuid(),'orders',jsonb_build_array(oid),'carrier','Packers','reference','TEST-INDIVIDUAL','date',day,'expected_gross',24600,'fees',600,'withheld',0,'net',24000,'account_id','ffffffff-1000-4000-8000-000000000001');
 perform public.finance_record_settlement(p);perform public.finance_record_settlement(p);
 inv:=public.finance_prepare_order(oid);perform public.finance_issue_invoice(inv);
 perform pg_temp.check_ok((select status='paid' from public.invoices where id=inv),'invoice issued after receipt unpaid');
 perform pg_temp.check_ok((select stock=before_stock-2 from public.product_variants where id='ffffffff-5000-4000-8000-000000000001'),'finance purchase changed stock');
 insert into public.product_variants(id,product_id,price,stock) values('ffffffff-5000-4000-8000-000000000002','ffffffff-4000-4000-8000-000000000001',1000,5);
 t:=public.place_order('{"customer_name":"Unknown Cost","phone":"0555123456","wilaya":"Alger","commune":"Alger Centre","address":"Adresse de test"}','[{"variant_id":"ffffffff-5000-4000-8000-000000000002","quantity":1}]');
 select id into oid from public.orders where public_token=t;
 update public.orders set status='confirmed',confirmed_at=clock_timestamp() where id=oid;
 perform pg_temp.check_ok((select product_cost is null and missing_costs=1 from public.order_finance where order_id=oid),'unknown cost treated as zero');
 perform public.finance_set_cost('ffffffff-5000-4000-8000-000000000002',500,gen_random_uuid());
 perform pg_temp.check_ok((select product_cost is null from public.order_finance where order_id=oid),'future cost filled old unknown snapshot');
 update public.finance_settings set cod_account_id=null where id=1;
 oid:=pg_temp.new_order();
 perform pg_temp.check_ok((select status='confirmed' from public.orders where id=oid),'financial failure blocked order');
 perform pg_temp.check_ok(exists(select 1 from public.finance_failures where order_id=oid),'capture failure not persisted');
 update public.finance_settings set cod_account_id='ffffffff-1000-4000-8000-000000000002' where id=1;
 perform public.finance_prepare_order(oid);
 perform pg_temp.check_ok(not exists(select 1 from public.finance_failures where order_id=oid),'retry did not clear error');
 perform pg_temp.check_ok(('2026-11-02'::date::timestamp at time zone 'Africa/Algiers')='2026-11-01T23:00:00Z'::timestamptz,'Algiers timezone boundary');
 oid:=pg_temp.new_order();
 update public.orders set status='shipped' where id=oid;
 update public.orders set status='delivered',delivered_at=now() where id=oid;
 inv:=public.finance_prepare_order(oid);perform public.finance_issue_invoice(inv);
 update public.orders set status='returned' where id=oid;
 perform public.finance_create_credit(inv,'Retour physique reçu');perform public.finance_create_credit(inv,'Retour physique reçu');
 perform pg_temp.check_ok((select count(*)=1 and sum(amount)=14000 from public.financial_movements where order_id=oid and kind='cost_recovery'),'physical return cost recovery duplicated or wrong');
 perform public.finance_configure('{"issue_trigger":"confirmed"}');
 oid:=pg_temp.new_order();inv:=public.finance_prepare_order(oid);perform public.finance_issue_invoice(inv);
 perform public.finance_create_credit(inv,'Annulation avant livraison');
 perform pg_temp.check_ok(not exists(select 1 from public.financial_movements where order_id=oid and kind in ('sale','credit_note')),'undelivered credit reduced revenue');
 perform pg_temp.reject('delete from public.financial_movements','movement history deletable');
end;
$$;

-- Staff can process invoices; no costs, global cash or expenses can be read.
select set_config('request.jwt.claim.sub','ffffffff-0000-4000-8000-000000000002',true);
set local role authenticated;
select pg_temp.check_ok((select count(*)=0 from public.order_finance),'staff cost disclosure');
select pg_temp.check_ok((select count(*)=0 from public.financial_movements),'staff cash disclosure');
select pg_temp.check_ok((select count(*)=0 from public.finance_expenses),'staff expenses disclosure');
select pg_temp.check_ok((select count(*)>0 from public.invoices),'staff invoices unavailable');
select pg_temp.reject('select public.finance_dashboard(current_date,current_date)','staff global dashboard');
select pg_temp.reject('select public.finance_record_expense(''{}'')','staff expense write');
reset role;
select set_config('request.jwt.claim.sub','',true);
set local role anon;
select pg_temp.reject('select * from public.invoices','anon invoice read');
select pg_temp.reject('select public.finance_issue_invoice(gen_random_uuid())','anon invoice issue');
reset role;
rollback;
