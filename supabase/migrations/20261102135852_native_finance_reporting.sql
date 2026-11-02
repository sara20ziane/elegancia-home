create function public.finance_order_status(p_order uuid) returns jsonb language plpgsql stable security definer set search_path='' as $$
declare result jsonb;
begin
 perform finance_private.require_role(false);
 select jsonb_build_object('enabled',(select enabled from public.finance_settings where id=1),'captured',f.order_id is not null,'total',o.total,'invoice_id',i.id,'invoice_number',i.number,
 'invoice_status',i.status,'pdf_ready',i.pdf_path is not null,'credit_id',c.id,'credit_number',c.number,
 'settlement_id',si.settlement_id,'settlement_reference',cs.reference,'cod_due',case when f.delivered_at is null or c.id is not null then 0 when si.order_id is null then f.total else greatest(0,si.withheld-greatest(0,coalesce((select sum(amount) from public.cod_withholding_receipts where settlement_id=si.settlement_id),0)-coalesce((select sum(z.withheld) from public.cod_settlement_items z where z.settlement_id=si.settlement_id and z.order_id<si.order_id),0))) end,
 'failure',exists(select 1 from public.finance_failures where order_id=o.id),
 'owner',public.finance_is_owner(),'product_cost',case when public.finance_is_owner() then f.product_cost end,
 'delivery_cost',case when public.finance_is_owner() then coalesce(si.fees,f.delivery_cost) end,
 'margin',case when public.finance_is_owner() then (case when c.id is not null then 0 else f.total end)-f.product_cost+coalesce((select sum(amount) from public.financial_movements where order_id=f.order_id and kind='cost_recovery'),0)-coalesce(si.fees,f.delivery_cost) end,
 'historical',o.created_at<(select coalesce(enabled_since,'infinity') from public.finance_settings where id=1)) into result
 from public.orders o left join public.order_finance f on f.order_id=o.id left join public.invoices i on i.order_id=o.id
 left join public.credit_notes c on c.invoice_id=i.id left join public.cod_settlement_items si on si.order_id=o.id
 left join public.cod_settlements cs on cs.id=si.settlement_id where o.id=p_order;
 return result;
end;
$$;
create function public.finance_dashboard(p_from date,p_to date) returns jsonb language plpgsql stable security definer set search_path='' as $$
declare start_at timestamptz:=p_from::timestamp at time zone 'Africa/Algiers';end_at timestamptz:=(p_to+1)::timestamp at time zone 'Africa/Algiers'; result jsonb;
begin
 perform finance_private.require_role();
 if p_from is null or p_to is null or p_to<p_from or p_to-p_from>366 then raise exception 'Période invalide (maximum 367 jours)';end if;
 with revenue as(select coalesce(sum(case direction when 'in' then amount else -amount end),0) value from public.financial_movements where domain='analytic' and kind in ('sale','credit_note') and occurred_at>=start_at and occurred_at<end_at),
 costs as(select coalesce(sum(f.product_cost),0)-(select coalesce(sum(amount),0) from public.financial_movements where kind='cost_recovery' and occurred_at>=start_at and occurred_at<end_at) products,coalesce(sum(coalesce(si.fees,f.delivery_cost)),0) delivery,
  count(*) filter(where f.product_cost is null or coalesce(si.fees,f.delivery_cost) is null) missing,
  count(*) filter(where si.order_id is null) estimated from public.order_finance f left join public.cod_settlement_items si on si.order_id=f.order_id where delivered_at>=start_at and delivered_at<end_at),
 expenses as(select coalesce(sum(case direction when 'out' then amount else -amount end),0) value from public.financial_movements where domain='analytic' and source_type in ('expense','expense_correction') and occurred_at>=start_at and occurred_at<end_at)
 select jsonb_build_object('revenue',r.value,'received',
  (select coalesce(sum(amount),0) from public.financial_movements where domain='cash' and direction='in' and kind in ('cod_settlement','withholding_receipt') and occurred_at>=start_at and occurred_at<end_at),
  'cod_due',(select coalesce(sum(case direction when 'in' then amount else -amount end),0) from public.financial_movements where domain='receivable' and occurred_at<end_at),
  'expenses',e.value,'product_cost',case when c.missing=0 then c.products end,
  'gross_margin',case when c.missing=0 then r.value-c.products-c.delivery end,
  'operating_result',case when c.missing=0 then r.value-c.products-c.delivery-e.value end,
  'missing_costs',c.missing,'estimated_delivery_costs',c.estimated,
  'failures',(select count(*) from public.finance_failures),
  'accounts',(select coalesce(jsonb_agg(x),'[]') from (select a.id,a.name,a.kind,coalesce(sum(case m.direction when 'in' then m.amount else -m.amount end),0) balance
    from public.finance_accounts a left join public.financial_movements m on m.account_id=a.id and m.occurred_at<end_at group by a.id order by a.name)x))
 into result from revenue r,costs c,expenses e;
 return result;
end;
$$;
create function public.finance_report(p_kind text,p_from date,p_to date,p_page integer default 1) returns jsonb language plpgsql stable security definer set search_path='' as $$
declare start_at timestamptz:=p_from::timestamp at time zone 'Africa/Algiers';end_at timestamptz:=(p_to+1)::timestamp at time zone 'Africa/Algiers';result jsonb;
begin
 perform finance_private.require_role();
 if p_from is null or p_to is null or p_to<p_from or p_to-p_from>366 or p_page<1 or p_page>10000 then raise exception 'Période ou page invalide';end if;
 if p_kind in ('source','product','category','wilaya','carrier') then
  with facts as(select f.snapshot,f.carrier,m.kind movement_kind,m.direction,m.amount,coalesce(si.fees,f.delivery_cost) delivery_cost,x from public.financial_movements m join public.order_finance f on f.order_id=m.order_id left join public.cod_settlement_items si on si.order_id=f.order_id
   cross join lateral jsonb_array_elements(f.snapshot->'items')x where m.domain='analytic' and m.kind in ('sale','credit_note','cost_recovery') and m.occurred_at>=start_at and m.occurred_at<end_at),
  grouped as(select case p_kind when 'source' then snapshot->>'source' when 'product' then x->>'name' when 'category' then coalesce(x->>'category_name',x->>'category_id','—') when 'wilaya' then snapshot->>'wilaya' else coalesce(carrier,'—') end label,
    round(sum(case when movement_kind='cost_recovery' then 0 else (case direction when 'in' then 1 else -1 end)*case when (snapshot->>'subtotal')::numeric>0 then (x->>'total')::numeric*amount/(snapshot->>'subtotal')::numeric else amount/jsonb_array_length(snapshot->'items') end end),2) revenue,
    case when bool_or(x->>'unit_cost' is null) then null else sum(case movement_kind when 'sale' then (x->>'unit_cost')::numeric*(x->>'quantity')::integer when 'cost_recovery' then -(x->>'unit_cost')::numeric*(x->>'quantity')::integer else 0 end) end product_cost,
    sum(case when movement_kind='sale' then delivery_cost*case when (snapshot->>'subtotal')::numeric>0 then (x->>'total')::numeric/(snapshot->>'subtotal')::numeric else 1::numeric/jsonb_array_length(snapshot->'items') end else 0 end) delivery_cost,
    bool_or(x->>'unit_cost' is null or delivery_cost is null) missing_cost from facts group by 1),
  page as(select *,case when missing_cost then null else revenue-product_cost-delivery_cost end margin from grouped order by label limit 50 offset (p_page-1)*50)
  select jsonb_build_object('rows',coalesce((select jsonb_agg(to_jsonb(page)) from page),'[]'),'total',(select count(*) from grouped)) into result;
 elsif p_kind='orders' then
  with facts as(select f.order_id,(f.snapshot->>'reference') ref,f.snapshot->>'source' source,case when exists(select 1 from public.credit_notes c join public.invoices i on i.id=c.invoice_id where i.order_id=f.order_id and c.issued_at<end_at) then 0 else f.total end total,f.product_cost-coalesce((select sum(amount) from public.financial_movements where order_id=f.order_id and kind='cost_recovery' and occurred_at<end_at),0) product_cost,
   coalesce(si.fees,f.delivery_cost) delivery_cost,(case when exists(select 1 from public.credit_notes c join public.invoices i on i.id=c.invoice_id where i.order_id=f.order_id and c.issued_at<end_at) then 0 else f.total end)-f.product_cost+coalesce((select sum(amount) from public.financial_movements where order_id=f.order_id and kind='cost_recovery' and occurred_at<end_at),0)-coalesce(si.fees,f.delivery_cost) margin,
   f.delivered_at,cs.occurred_at settled_at,extract(epoch from(cs.occurred_at-f.delivered_at))/86400 settlement_days
   from public.order_finance f left join public.cod_settlement_items si on si.order_id=f.order_id left join public.cod_settlements cs on cs.id=si.settlement_id
   where f.delivered_at>=start_at and f.delivered_at<end_at),page as(select * from facts order by delivered_at desc,order_id limit 50 offset (p_page-1)*50)
  select jsonb_build_object('rows',coalesce((select jsonb_agg(to_jsonb(page)) from page),'[]'),'total',(select count(*) from facts),'average_settlement_days',(select avg(settlement_days) from facts)) into result;
 elsif p_kind='expenses' then
  with grouped as(select c.name label,sum(case m.direction when 'out' then m.amount else -m.amount end) amount from public.financial_movements m
   join public.finance_expenses e on e.id=m.source_id left join public.finance_expenses old_e on old_e.id=e.replaces_id
   join public.finance_categories c on c.id=case when m.source_type='expense_correction' then old_e.category_id else e.category_id end
   where m.domain='analytic' and m.source_type in ('expense','expense_correction') and m.occurred_at>=start_at and m.occurred_at<end_at group by c.name),
  page as(select * from grouped order by label limit 50 offset (p_page-1)*50)
  select jsonb_build_object('rows',coalesce((select jsonb_agg(to_jsonb(page)) from page),'[]'),'total',(select count(*) from grouped)) into result;
 elsif p_kind='accounts' then
  with grouped as(select a.name label,sum(case direction when 'in' then amount else 0 end) received,sum(case direction when 'out' then amount else 0 end) spent
   from public.financial_movements m join public.finance_accounts a on a.id=m.account_id where m.domain='cash' and m.occurred_at>=start_at and m.occurred_at<end_at group by a.name),
  page as(select * from grouped order by label limit 50 offset (p_page-1)*50)
  select jsonb_build_object('rows',coalesce((select jsonb_agg(to_jsonb(page)) from page),'[]'),'total',(select count(*) from grouped)) into result;
 else raise exception 'Rapport inconnu';end if;
 return result;
end;
$$;

-- Private immutable storage: users cannot overwrite/delete issued artifacts or evidence.
insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types) values
 ('finance-invoices','finance-invoices',false,15728640,array['application/pdf']),
 ('finance-documents','finance-documents',false,8388608,array['application/pdf','image/png','image/jpeg','image/webp'])
 on conflict(id) do nothing;
create policy finance_document_insert on storage.objects for insert to authenticated
 with check(bucket_id='finance-documents' and (select public.finance_is_owner()) and (name like 'receipts/%' or name like 'brand/%'));
create policy finance_document_read on storage.objects for select to authenticated
 using(bucket_id='finance-documents' and (select public.finance_is_owner()));
create function public.finance_public_documents(p_token uuid) returns jsonb language sql stable security definer set search_path='' as $$
 select jsonb_build_object('invoice_id',i.id,'number',i.number,'credit_id',c.id) from public.invoices i
 join public.orders o on o.id=i.order_id left join public.credit_notes c on c.invoice_id=i.id where o.public_token=p_token and i.issued_at is not null;
$$;
create function public.finance_document(p_id uuid,p_kind text,p_token uuid default null) returns jsonb language plpgsql stable security definer set search_path='' as $$
declare d jsonb; oid uuid;
begin
 if p_token is null then perform finance_private.require_role(false);end if;
 if p_kind='invoice' then
  select to_jsonb(i),i.order_id into d,oid from public.invoices i where i.id=p_id and i.issued_at is not null;
 elsif p_kind='credit' then
  select to_jsonb(c),i.order_id into d,oid from public.credit_notes c join public.invoices i on i.id=c.invoice_id where c.id=p_id;
 else raise exception 'Document inconnu';end if;
 if p_token is not null and not exists(select 1 from public.orders where id=oid and public_token=p_token) then return null;end if;
 return d;
end;
$$;
create function public.finance_archive_pdf(p_id uuid,p_kind text,p_path text,p_hash text) returns void language plpgsql security definer set search_path='' as $$
declare old_hash text;
begin
 if p_kind not in ('invoice','credit') or p_path<>p_kind||'/'||p_id||'/document.pdf' or p_hash !~ '^[a-f0-9]{64}$'
  or not exists(select 1 from storage.objects where bucket_id='finance-invoices' and name=p_path) then raise exception 'Archive PDF invalide';end if;
 if p_kind='invoice' then
  select pdf_sha256 into old_hash from public.invoices where id=p_id and issued_at is not null for update;
  if not found then raise exception 'Facture non émise';end if;
  if old_hash is not null and old_hash<>p_hash then raise exception 'Archive existante différente';end if;
  update public.invoices set pdf_path=p_path,pdf_sha256=p_hash where id=p_id;
 else
  select pdf_sha256 into old_hash from public.credit_notes where id=p_id for update;
  if not found then raise exception 'Avoir absent';end if;
  if old_hash is not null and old_hash<>p_hash then raise exception 'Archive existante différente';end if;
  update public.credit_notes set pdf_path=p_path,pdf_sha256=p_hash where id=p_id;
 end if;
 perform finance_private.audit('pdf_archived',p_kind,p_id,null,jsonb_build_object('sha256',p_hash));
end;
$$;
create function finance_private.protect_snapshot() returns trigger language plpgsql set search_path='' as $$
begin
 if (to_jsonb(new)-array['delivered_at','carrier','cancelled_at']) is distinct from (to_jsonb(old)-array['delivered_at','carrier','cancelled_at'])
  or (old.delivered_at is not null and (new.delivered_at is distinct from old.delivered_at or new.carrier is distinct from old.carrier))
  or (old.cancelled_at is not null and new.cancelled_at is distinct from old.cancelled_at) then raise exception 'Snapshot financier immuable';end if;return new;
end;
$$;
create trigger order_snapshot_immutable before update on public.order_finance for each row execute function finance_private.protect_snapshot();
create trigger order_snapshot_no_delete before delete on public.order_finance for each row execute function finance_private.immutable();
create function finance_private.protect_credit() returns trigger language plpgsql set search_path='' as $$
begin
 if tg_op='DELETE' then raise exception 'Avoir non supprimable';end if;
 if (to_jsonb(new)-array['pdf_path','pdf_sha256']) is distinct from (to_jsonb(old)-array['pdf_path','pdf_sha256']) or
  (old.pdf_path is not null and (new.pdf_path is distinct from old.pdf_path or new.pdf_sha256 is distinct from old.pdf_sha256)) then raise exception 'Avoir immuable';end if;return new;
end;
$$;
create trigger credit_immutable before update or delete on public.credit_notes for each row execute function finance_private.protect_credit();
revoke all on function public.finance_order_status(uuid),public.finance_dashboard(date,date),public.finance_report(text,date,date,integer),public.finance_public_documents(uuid),public.finance_document(uuid,text,uuid),public.finance_archive_pdf(uuid,text,text,text) from public,anon,authenticated,service_role;
grant execute on function public.finance_order_status(uuid),public.finance_dashboard(date,date),public.finance_report(text,date,date,integer),public.finance_document(uuid,text,uuid) to authenticated;
grant execute on function public.finance_public_documents(uuid),public.finance_document(uuid,text,uuid),public.finance_archive_pdf(uuid,text,text,text) to service_role;
revoke all on all functions in schema finance_private from public,anon,authenticated;
notify pgrst,'reload schema';

create function public.finance_receivables(p_page integer default 1,p_carrier text default null) returns jsonb language plpgsql stable security definer set search_path='' as $$
declare result jsonb;
begin
 perform finance_private.require_role();
 if p_page<1 or p_page>10000 then raise exception 'Page invalide';end if;
 with facts as(select f.order_id,f.snapshot->>'customer_name' customer_name,upper(left(f.snapshot->>'reference',8)) reference,
 f.total,f.carrier,f.delivered_at from public.order_finance f join public.orders o on o.id=f.order_id
 where f.delivered_at is not null and o.status='delivered' and (p_carrier is null or f.carrier=p_carrier)
 and not exists(select 1 from public.cod_settlement_items where order_id=f.order_id)
 and not exists(select 1 from public.credit_notes c join public.invoices i on i.id=c.invoice_id where i.order_id=f.order_id)),
 page as(select * from facts order by delivered_at,order_id limit 30 offset (p_page-1)*30)
 select jsonb_build_object('rows',coalesce((select jsonb_agg(to_jsonb(page)) from page),'[]'),'total',(select count(*) from facts)) into result;
 return result;
end;
$$;
revoke all on function public.finance_receivables(integer,text) from public,anon;
grant execute on function public.finance_receivables(integer,text) to authenticated;
