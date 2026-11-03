-- Regression: a cost recorded immediately before an admin-confirmed order in the
-- same transaction must be eligible for the order's immutable Finance snapshot.
begin;

create function pg_temp.check_ok(value boolean, message text) returns void language plpgsql as $$
begin
  if value is not true then raise exception 'ASSERT: %', message; end if;
end;
$$;

insert into auth.users(id) values('eeeeeeee-0000-4000-8000-000000000001');
insert into public.admin_users(user_id,role) values('eeeeeeee-0000-4000-8000-000000000001','owner');
select set_config('request.jwt.claim.sub','eeeeeeee-0000-4000-8000-000000000001',true);

select public.finance_save_entity(
  'account',
  '{"id":"eeeeeeee-1000-4000-8000-000000000001","name":"Regression COD","kind":"receivable"}'
);
select public.finance_configure(
  '{"enabled":true,"cod_account_id":"eeeeeeee-1000-4000-8000-000000000001"}'
);

update public.store_settings
set accepts_cod=true, delivery_wilayas=array['Alger']
where id=1;

insert into public.delivery_zones(wilaya,fee,stopdesk_fee)
values('Alger',400,250)
on conflict(wilaya) do update
set fee=400, stopdesk_fee=250, is_active=true;

insert into public.products(id,slug,name,status)
values('eeeeeeee-4000-4000-8000-000000000001','finance-cost-timestamp-regression','Regression','published');

insert into public.product_variants(id,product_id,price,stock,sku)
values('eeeeeeee-5000-4000-8000-000000000001','eeeeeeee-4000-4000-8000-000000000001',7500,5,'REG-COST');

-- Both the cost and confirmed_at are created inside this same transaction.
select public.finance_set_cost(
  'eeeeeeee-5000-4000-8000-000000000001',
  3000,
  'eeeeeeee-6000-4000-8000-000000000001'
);

select public.place_admin_order(
  '{"customer_name":"Regression Finance","phone":"0555123456","wilaya":"Alger","commune":"Alger Centre","address":"Adresse regression","note":"finance-cost-timestamp-regression","delivery_method":"home"}',
  '[{"variant_id":"eeeeeeee-5000-4000-8000-000000000001","quantity":1}]',
  'other',
  true
);

select pg_temp.check_ok(
  (
    select ofn.product_cost=3000 and ofn.missing_costs=0
    from public.order_finance ofn
    join public.orders o on o.id=ofn.order_id
    where o.note='finance-cost-timestamp-regression'
  ),
  'same-transaction cost was not captured'
);

rollback;
