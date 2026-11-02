create table public.finance_expenses (
 id uuid primary key, date date not null, category_id uuid not null references public.finance_categories(id),
 description text not null check(length(trim(description)) between 1 and 500),amount numeric(16,2) not null check(amount>0),
 account_id uuid not null references public.finance_accounts(id),supplier_id uuid references public.finance_suppliers(id),
 receipt_path text,note text,status text not null default 'posted' check(status in ('posted','voided')),
 replaces_id uuid unique references public.finance_expenses(id),request_payload jsonb not null,
 created_by uuid not null references auth.users(id),created_at timestamptz not null default now()
);
create index expenses_period on public.finance_expenses(date,status);
create table public.finance_purchases (
 id uuid primary key,supplier_id uuid not null references public.finance_suppliers(id),date date not null,
 reference text not null check(length(trim(reference)) between 1 and 150),total numeric(16,2) not null check(total>0),
 status text not null check(status in ('unpaid','paid')),account_id uuid references public.finance_accounts(id),
 receipt_path text,note text,request_payload jsonb not null,paid_at timestamptz,
 created_by uuid not null references auth.users(id),created_at timestamptz not null default now(),unique(supplier_id,reference)
);
create table public.finance_purchase_items (
 id uuid primary key default gen_random_uuid(),purchase_id uuid not null references public.finance_purchases(id),
 variant_id uuid not null references public.product_variants(id) on delete restrict,name text not null,sku text,
 quantity integer not null check(quantity>0),unit_cost numeric(16,2) not null check(unit_cost>=0),total numeric(16,2) not null,
 unique(purchase_id,variant_id),check(total=quantity*unit_cost)
);
create table public.cod_withholding_receipts (
 id uuid primary key,settlement_id uuid not null references public.cod_settlements(id),amount numeric(16,2) not null check(amount>0),
 account_id uuid not null references public.finance_accounts(id),date date not null,request_payload jsonb not null,
 created_by uuid not null references auth.users(id),created_at timestamptz not null default now()
);
create table public.finance_refunds (
 id uuid primary key,credit_id uuid not null unique references public.credit_notes(id),amount numeric(16,2) not null check(amount>0),
 account_id uuid not null references public.finance_accounts(id),date date not null,
 created_by uuid not null references auth.users(id),created_at timestamptz not null default now()
);
create function finance_private.date(p_date text) returns timestamptz language plpgsql set search_path='' as $$
begin
 if p_date is null or p_date::date>(now() at time zone 'Africa/Algiers')::date then raise exception 'Date passée ou du jour requise';end if;
 return p_date::date::timestamp at time zone 'Africa/Algiers';
end;
$$;
create function finance_private.receipt(p_path text) returns void language plpgsql set search_path='' as $$
begin
 if p_path is not null and not exists(select 1 from storage.objects where bucket_id='finance-documents' and name=p_path and name like 'receipts/%') then raise exception 'Justificatif privé introuvable';end if;
end;
$$;
create function public.finance_record_settlement(p jsonb) returns uuid language plpgsql security definer set search_path='' as $$
declare sid uuid:=(p->>'id')::uuid; ids uuid[]; oid uuid; f public.order_finance%rowtype; old_p jsonb;
 gross numeric:=0; fees numeric:=(p->>'fees')::numeric; held numeric:=(p->>'withheld')::numeric; net numeric:=(p->>'net')::numeric;
 at_time timestamptz; destination uuid:=(p->>'account_id')::uuid; cum numeric:=0; ded_used numeric:=0; fee_used numeric:=0; ded numeric; line_fee numeric;
begin
 perform finance_private.require_role();at_time:=finance_private.date(p->>'date');
 if sid is null then raise exception 'Identifiant opération requis'; end if;
 perform pg_advisory_xact_lock(hashtext(sid::text));
 select request_payload into old_p from public.cod_settlements where id=sid;
 if found then if old_p<>p then raise exception 'Identifiant réutilisé avec un autre contenu';end if;return sid;end if;
 perform finance_private.cash_account(destination);
 if jsonb_typeof(p->'orders')<>'array' or jsonb_array_length(p->'orders') not between 1 and 200 then raise exception 'Lot de 1 à 200 commandes requis';end if;
 select array_agg(x::uuid order by x) into ids from jsonb_array_elements_text(p->'orders')x;
 if cardinality(ids)<>(select count(distinct x) from unnest(ids)x) then raise exception 'Commande dupliquée dans le lot';end if;
 foreach oid in array ids loop
  select * into f from public.order_finance where order_id=oid for update;
  if not found or f.delivered_at is null or f.carrier is distinct from trim(p->>'carrier') or not exists(select 1 from public.orders where id=oid and status='delivered' and total=f.total) then raise exception 'Commande non livrée, transporteur ou montant incohérent';end if;
  if exists(select 1 from public.cod_settlement_items where order_id=oid) then raise exception 'Commande déjà reversée';end if;
  if exists(select 1 from public.credit_notes c join public.invoices i on i.id=c.invoice_id where i.order_id=oid) then raise exception 'Commande créditée';end if;
  if (f.delivered_at at time zone 'Africa/Algiers')::date>(p->>'date')::date then raise exception 'Reversement antérieur à la livraison';end if;
  gross:=gross+f.total;
 end loop;
 if fees is null or held is null or net is null or fees<0 or held<0 or fees<>round(fees,2) or held<>round(held,2)
  or net<>gross-fees-held or net<=0 or (p->>'expected_gross')::numeric is distinct from gross then raise exception 'Brut, frais, retenues ou net incohérents';end if;
 insert into public.cod_settlements(id,carrier,reference,occurred_at,gross,fees,withheld,net,account_id,note,request_payload,created_by)
 values(sid,trim(p->>'carrier'),trim(p->>'reference'),at_time,gross,fees,held,net,destination,p->>'note',p,auth.uid());
 foreach oid in array ids loop
  select * into f from public.order_finance where order_id=oid;
  cum:=cum+f.total;ded:=round(cum*(fees+held)/gross,2)-ded_used;
  line_fee:=case when fees+held=0 then 0 else round((ded_used+ded)*fees/(fees+held),2)-fee_used end;
  insert into public.cod_settlement_items(order_id,settlement_id,gross,fees,withheld) values(oid,sid,f.total,line_fee,ded-line_fee);
  perform finance_private.move('receivable','cod_settlement',f.total,'out',at_time,'settlement',sid,'receivable:'||oid,f.cod_account_id,oid);
  perform finance_private.move('receivable','withholding',ded-line_fee,'in',at_time,'settlement',sid,'withheld:'||oid,f.cod_account_id,oid);
  update public.invoices set status='paid',paid_at=at_time where order_id=oid and status='issued' and held=0;
  ded_used:=ded_used+ded;fee_used:=fee_used+line_fee;
 end loop;
 perform finance_private.move('cash','cod_settlement',net,'in',at_time,'settlement',sid,'cash',destination);
 perform finance_private.move('analytic','carrier_fee',fees,'out',at_time,'settlement',sid,'fees');
 perform finance_private.audit('settlement_recorded','settlement',sid,null,p);return sid;
end;
$$;
create function public.finance_receive_withholding(p jsonb) returns uuid language plpgsql security definer set search_path='' as $$
declare rid uuid:=(p->>'id')::uuid; sid uuid:=(p->>'settlement_id')::uuid; amount numeric:=(p->>'amount')::numeric; due numeric; old_p jsonb; at_time timestamptz;
 collected numeric; preceding numeric:=0; allocation numeric; line record;
begin
 perform finance_private.require_role();at_time:=finance_private.date(p->>'date');
 perform pg_advisory_xact_lock(hashtext(rid::text));
 select request_payload into old_p from public.cod_withholding_receipts where id=rid;
 if found then if old_p<>p then raise exception 'Identifiant réutilisé';end if;return rid;end if;
 select withheld into due from public.cod_settlements where id=sid for update;
 if not found then raise exception 'Reversement introuvable';end if;
 if (p->>'date')::date<(select (occurred_at at time zone 'Africa/Algiers')::date from public.cod_settlements where id=sid) then raise exception 'Date antérieure au reversement';end if;
 collected:=coalesce((select sum(r.amount) from public.cod_withholding_receipts r where settlement_id=sid),0);due:=due-collected;
 if amount is null or amount<=0 or amount<>round(amount,2) or amount>due then raise exception 'Retenue à recevoir incohérente';end if;
 perform finance_private.cash_account((p->>'account_id')::uuid);
 insert into public.cod_withholding_receipts(id,settlement_id,amount,account_id,date,request_payload,created_by)
 values(rid,sid,amount,(p->>'account_id')::uuid,(p->>'date')::date,p,auth.uid());
 perform finance_private.move('cash','withholding_receipt',amount,'in',at_time,'withholding_receipt',rid,'cash',(p->>'account_id')::uuid,null,sid::text);
 for line in select si.order_id,si.withheld,f.cod_account_id from public.cod_settlement_items si join public.order_finance f on f.order_id=si.order_id where si.settlement_id=sid order by si.order_id loop
  allocation:=greatest(0,least(line.withheld,collected+amount-preceding))-greatest(0,least(line.withheld,collected-preceding));
  perform finance_private.move('receivable','withholding_receipt',allocation,'out',at_time,'withholding_receipt',rid,'receivable:'||line.order_id,line.cod_account_id,line.order_id,sid::text);
  preceding:=preceding+line.withheld;
 end loop;
 if amount=due then update public.invoices set status='paid',paid_at=at_time where status='issued' and order_id in(select order_id from public.cod_settlement_items where settlement_id=sid);end if;
 perform finance_private.audit('withholding_received','withholding_receipt',rid,null,p);return rid;
end;
$$;
create function public.finance_record_expense(p jsonb) returns uuid language plpgsql security definer set search_path='' as $$
declare eid uuid:=(p->>'id')::uuid; amount numeric:=(p->>'amount')::numeric; old_p jsonb; old_e public.finance_expenses%rowtype; m public.financial_movements%rowtype; at_time timestamptz;
begin
 perform finance_private.require_role();at_time:=finance_private.date(p->>'date');perform pg_advisory_xact_lock(hashtext(eid::text));
 select request_payload into old_p from public.finance_expenses where id=eid;
 if found then if old_p<>p then raise exception 'Identifiant réutilisé';end if;return eid;end if;
 if amount is null or amount<=0 or amount<>round(amount,2) then raise exception 'Montant invalide';end if;
 perform finance_private.cash_account((p->>'account_id')::uuid);perform finance_private.receipt(nullif(p->>'receipt_path',''));
 if nullif(p->>'replaces_id','') is not null then
  select * into old_e from public.finance_expenses where id=(p->>'replaces_id')::uuid for update;
  if not found or old_e.status<>'posted' then raise exception 'Dépense déjà corrigée';end if;
  if (p->>'date')::date<old_e.date then raise exception 'Correction antérieure à la dépense';end if;
  for m in select * from public.financial_movements where source_type='expense' and source_id=old_e.id loop
   insert into public.financial_movements(domain,kind,amount,direction,occurred_at,source_type,source_id,entry_key,account_id,reverses_id,created_by)
   values(m.domain,'reversal',m.amount,'in',at_time,'expense_correction',eid,m.entry_key,m.account_id,m.id,auth.uid());
  end loop;
  update public.finance_expenses set status='voided' where id=old_e.id;
 end if;
 insert into public.finance_expenses(id,date,category_id,description,amount,account_id,supplier_id,receipt_path,note,replaces_id,request_payload,created_by)
 values(eid,(p->>'date')::date,(p->>'category_id')::uuid,trim(p->>'description'),amount,(p->>'account_id')::uuid,
 nullif(p->>'supplier_id','')::uuid,nullif(p->>'receipt_path',''),p->>'note',nullif(p->>'replaces_id','')::uuid,p,auth.uid());
 perform finance_private.move('cash','expense',amount,'out',at_time,'expense',eid,'cash',(p->>'account_id')::uuid);
 perform finance_private.move('analytic','expense',amount,'out',at_time,'expense',eid,'expense');
 perform finance_private.audit('expense_recorded','expense',eid,to_jsonb(old_e),p);return eid;
end;
$$;
create function public.finance_record_purchase(p jsonb) returns uuid language plpgsql security definer set search_path='' as $$
declare pid uuid:=(p->>'id')::uuid; x jsonb; qty integer; cost numeric; total numeric:=0; old_p jsonb; at_time timestamptz; v public.product_variants%rowtype; name text;
begin
 perform finance_private.require_role();at_time:=finance_private.date(p->>'date');perform pg_advisory_xact_lock(hashtext(pid::text));
 select request_payload into old_p from public.finance_purchases where id=pid;
 if found then if old_p<>p then raise exception 'Identifiant réutilisé';end if;return pid;end if;
 if jsonb_typeof(p->'items')<>'array' or jsonb_array_length(p->'items') not between 1 and 100 then raise exception 'Lignes achat requises';end if;
 for x in select * from jsonb_array_elements(p->'items') loop
  qty:=(x->>'quantity')::integer;cost:=(x->>'unit_cost')::numeric;
  if qty is null or qty<=0 or cost is null or cost<0 or cost<>round(cost,2) then raise exception 'Ligne achat invalide';end if;
  total:=total+qty*cost;
 end loop;
 perform finance_private.receipt(nullif(p->>'receipt_path',''));
 if nullif(p->>'account_id','') is not null then perform finance_private.cash_account((p->>'account_id')::uuid);end if;
 insert into public.finance_purchases(id,supplier_id,date,reference,total,status,account_id,receipt_path,note,request_payload,created_by,paid_at)
 values(pid,(p->>'supplier_id')::uuid,(p->>'date')::date,trim(p->>'reference'),total,
 case when nullif(p->>'account_id','') is null then 'unpaid' else 'paid' end,nullif(p->>'account_id','')::uuid,
 nullif(p->>'receipt_path',''),p->>'note',p,auth.uid(),case when nullif(p->>'account_id','') is not null then at_time end);
 for x in select * from jsonb_array_elements(p->'items') loop
  select * into v from public.product_variants where id=(x->>'variant_id')::uuid;
  if not found then raise exception 'Variante introuvable';end if;
  select pr.name into name from public.products pr where id=v.product_id;
  qty:=(x->>'quantity')::integer;cost:=(x->>'unit_cost')::numeric;
  insert into public.finance_purchase_items(purchase_id,variant_id,name,sku,quantity,unit_cost,total) values(pid,v.id,name,v.sku,qty,cost,qty*cost);
  insert into public.variant_costs(variant_id,unit_cost,source_id,created_by) values(v.id,cost,pid,auth.uid());
 end loop;
 if nullif(p->>'account_id','') is not null then perform finance_private.move('cash','purchase',total,'out',at_time,'purchase',pid,'cash',(p->>'account_id')::uuid);end if;
 perform finance_private.audit('purchase_recorded','purchase',pid,null,p);return pid;
end;
$$;
create function public.finance_pay_purchase(p_id uuid,p_account uuid,p_date date) returns void language plpgsql security definer set search_path='' as $$
declare d public.finance_purchases%rowtype; at_time timestamptz;
begin
 perform finance_private.require_role();perform finance_private.cash_account(p_account);at_time:=finance_private.date(p_date::text);
 select * into d from public.finance_purchases where id=p_id for update;
 if not found then raise exception 'Achat introuvable';end if;
 if d.status='paid' then return;end if;
 if p_date<d.date then raise exception 'Paiement antérieur à l’achat';end if;
 update public.finance_purchases set status='paid',account_id=p_account,paid_at=at_time where id=p_id;
 perform finance_private.move('cash','purchase',d.total,'out',at_time,'purchase',p_id,'cash',p_account);
 perform finance_private.audit('purchase_paid','purchase',p_id,null,jsonb_build_object('account_id',p_account));
end;
$$;
create function public.finance_refund_credit(p_id uuid,p_account uuid,p_date date) returns uuid language plpgsql security definer set search_path='' as $$
declare c public.credit_notes%rowtype; oid uuid; rid uuid; at_time timestamptz;
begin
 perform finance_private.require_role();at_time:=finance_private.date(p_date::text);perform finance_private.cash_account(p_account);
 select * into c from public.credit_notes where id=p_id for update;
 if not found then raise exception 'Avoir introuvable';end if;
 if p_date<(c.issued_at at time zone 'Africa/Algiers')::date then raise exception 'Remboursement antérieur à l’avoir';end if;
 select id into rid from public.finance_refunds where credit_id=p_id;if found then return rid;end if;
 select order_id into oid from public.invoices where id=c.invoice_id;
 if not exists(select 1 from public.cod_settlement_items where order_id=oid) then raise exception 'Aucun reversement reçu pour cette commande';end if;
 insert into public.finance_refunds(id,credit_id,amount,account_id,date,created_by) values(gen_random_uuid(),p_id,c.total,p_account,p_date,auth.uid()) returning id into rid;
 perform finance_private.move('cash','refund',c.total,'out',at_time,'refund',rid,'cash',p_account,oid);
 perform finance_private.audit('refund_recorded','refund',rid,null,jsonb_build_object('credit_id',p_id,'amount',c.total));return rid;
end;
$$;
create function public.finance_adjust(p jsonb) returns uuid language plpgsql security definer set search_path='' as $$
declare aid uuid:=(p->>'id')::uuid;amount numeric:=(p->>'amount')::numeric;at_time timestamptz;
begin
 perform finance_private.require_role();perform finance_private.cash_account((p->>'account_id')::uuid);at_time:=finance_private.date(p->>'date');
 perform pg_advisory_xact_lock(hashtext(aid::text));
 if exists(select 1 from public.financial_movements where source_type='adjustment' and source_id=aid) then
  if not exists(select 1 from public.finance_audit_log where source_type='adjustment' and source_id=aid and new_value=p) then raise exception 'Identifiant réutilisé';end if;return aid;
 end if;
 if amount is null or amount<=0 or amount<>round(amount,2) or length(trim(coalesce(p->>'note','')))<3 then raise exception 'Montant et motif requis';end if;
 perform finance_private.move('cash','adjustment',amount,p->>'direction',at_time,'adjustment',aid,'cash',(p->>'account_id')::uuid,null,p->>'note');
 perform finance_private.audit('adjustment_recorded','adjustment',aid,null,p);return aid;
end;
$$;
do $$ declare t text; begin
 foreach t in array array['finance_expenses','finance_purchases','finance_purchase_items','cod_withholding_receipts','finance_refunds'] loop
  execute format('alter table public.%I enable row level security',t);
  execute format('revoke all on public.%I from public,anon,authenticated,service_role',t);
  execute format('grant select on public.%I to authenticated',t);
  execute format('create policy owner_read on public.%I for select to authenticated using ((select public.finance_is_owner()))',t);
 end loop;
end $$;
create trigger expense_no_delete before delete on public.finance_expenses for each row execute function finance_private.immutable();
create trigger purchase_no_delete before delete on public.finance_purchases for each row execute function finance_private.immutable();
create trigger purchase_lines_immutable before update or delete on public.finance_purchase_items for each row execute function finance_private.immutable();
create trigger holding_receipt_immutable before update or delete on public.cod_withholding_receipts for each row execute function finance_private.immutable();
create trigger refunds_immutable before update or delete on public.finance_refunds for each row execute function finance_private.immutable();
revoke all on function public.finance_record_settlement(jsonb),public.finance_receive_withholding(jsonb),public.finance_record_expense(jsonb),public.finance_record_purchase(jsonb),public.finance_pay_purchase(uuid,uuid,date),public.finance_refund_credit(uuid,uuid,date),public.finance_adjust(jsonb) from public,anon;
grant execute on function public.finance_record_settlement(jsonb),public.finance_receive_withholding(jsonb),public.finance_record_expense(jsonb),public.finance_record_purchase(jsonb),public.finance_pay_purchase(uuid,uuid,date),public.finance_refund_credit(uuid,uuid,date),public.finance_adjust(jsonb) to authenticated;
revoke all on all functions in schema finance_private from public,anon,authenticated;

create function finance_private.order_paid(p_order uuid) returns boolean language sql stable set search_path='' as $$
 select exists(select 1 from public.cod_settlement_items si join public.cod_settlements s on s.id=si.settlement_id
 where si.order_id=p_order and (s.withheld=0 or s.withheld<=coalesce((select sum(amount) from public.cod_withholding_receipts where settlement_id=s.id),0)));
$$;
revoke all on function finance_private.order_paid(uuid) from public,anon,authenticated;
