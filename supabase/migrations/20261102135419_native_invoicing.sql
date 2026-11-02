create table public.invoice_counters(kind text,year integer,last_value bigint not null,primary key(kind,year));
create table public.invoices (
 id uuid primary key default gen_random_uuid(), order_id uuid not null unique references public.order_finance(order_id) on delete restrict,
 number text unique, status text not null default 'draft' check(status in ('draft','issued','paid','cancelled')),
 currency text not null default 'DZD' check(currency='DZD'), payload jsonb not null,
 subtotal numeric(16,2) not null, delivery_fee numeric(16,2) not null, discount numeric(16,2) not null default 0,
 tax numeric(16,2) not null default 0, total numeric(16,2) not null check(total>=0),
 issued_at timestamptz, paid_at timestamptz, created_by uuid references auth.users(id), created_at timestamptz not null default now(),
 pdf_path text unique,pdf_sha256 text check(pdf_sha256 ~ '^[a-f0-9]{64}$'), renderer_version text not null default 'elegancia-a4-v1',
 check((number is null)=(issued_at is null)), check(total=subtotal+delivery_fee-discount)
);
create index invoice_period on public.invoices(issued_at,status);
create index invoice_status_list on public.invoices(status,created_at desc,id);
create table public.invoice_items (
 id uuid primary key default gen_random_uuid(),invoice_id uuid not null references public.invoices(id) on delete restrict,
 source_item_id uuid not null, product_id uuid, variant_id uuid, name text not null, variant text,sku text,
 quantity integer not null check(quantity>0),unit_price numeric(16,2) not null check(unit_price>=0),discount numeric(16,2) not null default 0 check(discount>=0),
 total numeric(16,2) not null,unique(invoice_id,source_item_id),check(total=quantity*unit_price-discount)
);
create table public.credit_notes (
 id uuid primary key default gen_random_uuid(), invoice_id uuid not null unique references public.invoices(id) on delete restrict,
 number text not null unique,total numeric(16,2) not null check(total>=0),reason text not null check(length(trim(reason)) between 3 and 500),
 payload jsonb not null, created_by uuid not null references auth.users(id),issued_at timestamptz not null default now(),
 pdf_path text unique,pdf_sha256 text check(pdf_sha256 ~ '^[a-f0-9]{64}$'),renderer_version text not null default 'elegancia-a4-v1'
);
create function finance_private.number(p_kind text) returns text language plpgsql set search_path='' as $$
declare yr integer:=extract(year from now() at time zone 'Africa/Algiers'); n bigint;
begin
 insert into public.invoice_counters(kind,year,last_value) values(p_kind,yr,1)
 on conflict(kind,year) do update set last_value=invoice_counters.last_value+1 returning last_value into n;
 return p_kind||'-'||yr||'-'||lpad(n::text,greatest(6,length(n::text)),'0');
end;
$$;
create function finance_private.capture(p_order uuid) returns void language plpgsql set search_path='' as $$
declare o public.orders%rowtype;s public.finance_settings%rowtype; lines jsonb; cost numeric; missing integer; fee numeric;
begin
 select * into o from public.orders where id=p_order for update;
 select * into s from public.finance_settings where id=1;
 if not found or not s.enabled then raise exception 'Finance désactivée'; end if;
 if o.status not in ('confirmed','shipped','delivered') then raise exception 'Commande non confirmée'; end if;
 if exists(select 1 from public.credit_notes c join public.invoices i on i.id=c.invoice_id where i.order_id=p_order) then raise exception 'Commande déjà créditée : vérification requise';end if;
 if not exists(select 1 from public.order_finance where order_id=p_order) then
  select jsonb_agg(jsonb_build_object('source_item_id',i.id,'product_id',v.product_id,'variant_id',i.variant_id,
   'name',i.product_name,'variant',i.variant_label,'sku',v.sku,'quantity',i.quantity,'unit_price',i.unit_price,
   'discount',0,'total',i.quantity*i.unit_price,'unit_cost',c.unit_cost,'category_id',pr.category_id,'category_name',cat.name_fr) order by i.id),
   sum(i.quantity*c.unit_cost),count(*) filter(where c.unit_cost is null)
  into lines,cost,missing from public.order_items i left join public.product_variants v on v.id=i.variant_id
  left join public.products pr on pr.id=v.product_id left join public.categories cat on cat.id=pr.category_id
  left join lateral(select vc.unit_cost from public.variant_costs vc where vc.variant_id=i.variant_id
    and vc.recorded_at<=coalesce(o.confirmed_at,now()) order by vc.recorded_at desc,vc.id desc limit 1)c on true
  where i.order_id=p_order;
  if lines is null or (select sum((x->>'total')::numeric) from jsonb_array_elements(lines)x)<>o.subtotal
   or o.total<>o.subtotal+o.delivery_fee then raise exception 'Montants canoniques incohérents'; end if;
  select case when o.delivery_method='stopdesk' then stopdesk_fee else dz.fee end into fee
   from public.delivery_zones dz where dz.wilaya=o.wilaya and dz.is_active;
  insert into public.order_finance(order_id,snapshot,product_cost,missing_costs,total,delivery_cost,cod_account_id,created_by)
   values(p_order,jsonb_build_object('order_id',o.id,'reference',o.public_token,'customer_name',o.customer_name,'phone',o.phone,
    'address',o.address,'commune',o.commune,'wilaya',o.wilaya,'source',o.order_source,'subtotal',o.subtotal,
    'delivery_fee',o.delivery_fee,'total',o.total,'currency','DZD','items',lines),case when missing=0 then cost end,
    missing,o.total,fee,s.cod_account_id,auth.uid());
  perform finance_private.audit('order_captured','order',p_order,null,jsonb_build_object('total',o.total,'missing_costs',missing));
 end if;
 if o.status='delivered' and not exists(select 1 from public.financial_movements where source_type='order' and source_id=p_order and entry_key='sale') then
  update public.order_finance set delivered_at=coalesce(o.delivered_at,now()),carrier=o.carrier where order_id=p_order;
  perform finance_private.move('analytic','sale',o.total,'in',coalesce(o.delivered_at,now()),'order',p_order,'sale',null,p_order);
  perform finance_private.move('receivable','cod_receivable',o.total,'in',coalesce(o.delivered_at,now()),'order',p_order,'cod',s.cod_account_id,p_order);
 end if;
end;
$$;
create function finance_private.draft(p_order uuid) returns uuid language plpgsql set search_path='' as $$
declare f public.order_finance%rowtype; doc_id uuid; safe_items jsonb; x jsonb;
begin
 select id into doc_id from public.invoices where order_id=p_order;
 if found then return doc_id; end if;
 select * into f from public.order_finance where order_id=p_order for update;
 select jsonb_agg(line_value-'unit_cost'-'category_id') into safe_items from jsonb_array_elements(f.snapshot->'items') as lines(line_value);
 insert into public.invoices(order_id,payload,subtotal,delivery_fee,total,created_by)
 values(p_order,(f.snapshot-'items')||jsonb_build_object('items',safe_items),
  (f.snapshot->>'subtotal')::numeric,(f.snapshot->>'delivery_fee')::numeric,f.total,auth.uid()) returning id into doc_id;
 for x in select * from jsonb_array_elements(safe_items) loop
  insert into public.invoice_items(invoice_id,source_item_id,product_id,variant_id,name,variant,sku,quantity,unit_price,total)
  values(doc_id,(x->>'source_item_id')::uuid,(x->>'product_id')::uuid,(x->>'variant_id')::uuid,x->>'name',x->>'variant',x->>'sku',
   (x->>'quantity')::integer,(x->>'unit_price')::numeric,(x->>'total')::numeric);
 end loop;
 perform finance_private.audit('invoice_drafted','invoice',doc_id,null,jsonb_build_object('order_id',p_order));return doc_id;
end;
$$;
create function finance_private.issue(p_id uuid) returns uuid language plpgsql set search_path='' as $$
declare d public.invoices%rowtype; o public.orders%rowtype; s public.finance_settings%rowtype; issuer jsonb; vat numeric; n text; at_time timestamptz:=now();
begin
 select * into d from public.invoices where id=p_id;
 if not found then raise exception 'Facture introuvable'; end if;
 if d.status<>'draft' then return d.id; end if;
 select * into o from public.orders where id=d.order_id for update;
 perform 1 from public.order_finance where order_id=d.order_id for update;
 select * into d from public.invoices where id=p_id for update;
 if d.status<>'draft' then return d.id;end if;
 select * into s from public.finance_settings where id=1;
 if array_position(array['confirmed','shipped','delivered'],o.status::text)<array_position(array['confirmed','shipped','delivered'],s.issue_trigger)
  or o.status not in ('confirmed','shipped','delivered') then raise exception 'Émission prématurée ou commande terminée négativement'; end if;
 if o.total<>d.total then raise exception 'Commande modifiée après snapshot : vérification requise';end if;
 if (select sum(total) from public.invoice_items where invoice_id=d.id)<>d.subtotal then raise exception 'Lignes facture incohérentes'; end if;
 select jsonb_build_object('name',coalesce(s.company_name,st.legal_name,st.name),'address',coalesce(s.legal_address,st.address_fr,st.address),
  'phone',coalesce(s.phone,st.phone),'email',coalesce(s.email,st.email),'rc',coalesce(s.rc,st.rc_number),
  'nif',coalesce(s.nif,st.nif),'nis',s.nis,'ai',s.ai,'logo_path',s.logo_path,'brand_color',st.brand_color) into issuer from public.store_settings st where st.id=1;
 vat:=case when s.tax_rate is null then 0 else round(d.total*s.tax_rate/(100+s.tax_rate),2) end;
 n:=finance_private.number('FAC');
 update public.invoices set number=n,status=case when finance_private.order_paid(d.order_id) then 'paid' else 'issued' end,
  issued_at=at_time,paid_at=case when finance_private.order_paid(d.order_id) then (select greatest(cs.occurred_at,coalesce((select max(r.date)::timestamp at time zone 'Africa/Algiers' from public.cod_withholding_receipts r where r.settlement_id=cs.id),cs.occurred_at)) from public.cod_settlement_items si join public.cod_settlements cs on cs.id=si.settlement_id where si.order_id=d.order_id) end,tax=vat,
  payload=payload||jsonb_build_object('kind','invoice','number',n,'date',(at_time at time zone 'Africa/Algiers')::date,
   'issuer',issuer,'tax',vat,'tax_rate',s.tax_rate,'tax_label',s.tax_label,'renderer_version','elegancia-a4-v1') where id=d.id;
 perform finance_private.audit('invoice_issued','invoice',d.id,null,jsonb_build_object('number',n,'total',d.total));return d.id;
end;
$$;
create function public.finance_prepare_order(p_order uuid,p_import boolean default false) returns uuid language plpgsql security definer set search_path='' as $$
declare since_at timestamptz;
begin
 perform finance_private.require_role(false);
 select enabled_since into since_at from public.finance_settings where id=1;
 if not exists(select 1 from public.order_finance where order_id=p_order) and exists(select 1 from public.orders where id=p_order and created_at<coalesce(since_at,'infinity'))
  and not(p_import and public.finance_is_owner()) then raise exception 'Import historique : aperçu et confirmation owner requis'; end if;
 perform finance_private.capture(p_order); delete from public.finance_failures where order_id=p_order; return finance_private.draft(p_order);
end;
$$;
create function public.finance_issue_invoice(p_id uuid) returns uuid language plpgsql security definer set search_path='' as $$
begin perform finance_private.require_role(false); return finance_private.issue(p_id); end;
$$;
create function finance_private.order_event() returns trigger language plpgsql security definer set search_path='' as $$
declare s public.finance_settings%rowtype; doc_id uuid;
begin
 if new.status is not distinct from old.status then return new; end if;
 select * into s from public.finance_settings where id=1;
 if (not s.enabled and new.status not in ('cancelled','refused','returned')) or (new.created_at<s.enabled_since and not exists(select 1 from public.order_finance where order_id=new.id)) then return new;end if;
 begin
  if new.status in ('confirmed','shipped','delivered') then
   perform finance_private.capture(new.id);
   if s.auto_issue and array_position(array['confirmed','shipped','delivered'],new.status::text)>=array_position(array['confirmed','shipped','delivered'],s.issue_trigger) then
    doc_id:=finance_private.draft(new.id);perform finance_private.issue(doc_id);
   end if;
  elsif new.status in ('cancelled','refused','returned') then
   update public.order_finance set cancelled_at=coalesce(cancelled_at,now()) where order_id=new.id;
   update public.invoices set status='cancelled' where order_id=new.id and status='draft';
  end if;
  delete from public.finance_failures where order_id=new.id;
 exception when others then
  insert into public.finance_failures(order_id,code) values(new.id,sqlstate) on conflict(order_id) do update set code=excluded.code,occurred_at=now();
 end;
 return new;
end;
$$;
create trigger native_finance_order after update of status on public.orders for each row execute function finance_private.order_event();
create function finance_private.protect_invoice() returns trigger language plpgsql set search_path='' as $$
begin
 if tg_op='DELETE' then raise exception 'Facture non supprimable'; end if;
 if old.issued_at is not null and (to_jsonb(new)-array['status','paid_at','pdf_path','pdf_sha256']) is distinct from (to_jsonb(old)-array['status','paid_at','pdf_path','pdf_sha256']) then raise exception 'Facture émise immuable'; end if;
 if old.pdf_path is not null and (new.pdf_path is distinct from old.pdf_path or new.pdf_sha256 is distinct from old.pdf_sha256) then raise exception 'PDF archivé immuable'; end if;
 return new;
end;
$$;
create trigger invoice_immutable before update or delete on public.invoices for each row execute function finance_private.protect_invoice();
create trigger invoice_lines_immutable before update or delete on public.invoice_items for each row execute function finance_private.immutable();
create function public.finance_create_credit(p_invoice uuid,p_reason text) returns uuid language plpgsql security definer set search_path='' as $$
declare d public.invoices%rowtype; c uuid; n text; due numeric; recovered numeric;
begin
 perform finance_private.require_role();
 select * into d from public.invoices where id=p_invoice;
 perform 1 from public.order_finance where order_id=d.order_id for update;
 select * into d from public.invoices where id=p_invoice for update;
 select id into c from public.credit_notes where invoice_id=p_invoice; if found then return c; end if;
 if d.issued_at is null then raise exception 'Facture émise requise'; end if;
 n:=finance_private.number('AV');
 insert into public.credit_notes(invoice_id,number,total,reason,payload,created_by)
 values(d.id,n,d.total,trim(p_reason),d.payload||jsonb_build_object('kind','credit','number',n,'original_number',d.number,'reason',trim(p_reason),'refund_due',case when exists(select 1 from public.cod_settlement_items where order_id=d.order_id) then d.total else 0 end,'date',(now() at time zone 'Africa/Algiers')::date),auth.uid()) returning id into c;
 update public.invoices set status='cancelled' where id=d.id;
 if exists(select 1 from public.financial_movements where order_id=d.order_id and kind='sale') then
  perform finance_private.move('analytic','credit_note',d.total,'out',now(),'credit',c,'credit',null,d.order_id,p_reason);
 end if;
 -- Financial valuation only: the existing order workflow is the sole stock writer.
 if exists(select 1 from public.orders where id=d.order_id and status='returned') and exists(select 1 from public.financial_movements where order_id=d.order_id and kind='sale') then
  select product_cost into recovered from public.order_finance where order_id=d.order_id;
  if recovered is not null then perform finance_private.move('analytic','cost_recovery',recovered,'in',now(),'credit',c,'cost_recovery',null,d.order_id,p_reason);end if;
 end if;
 select coalesce(sum(case when direction='in' then amount else -amount end),0) into due from public.financial_movements where domain='receivable' and order_id=d.order_id and kind in ('cod_receivable','cod_settlement');
 if due>0 then perform finance_private.move('receivable','credit_note',due,'out',now(),'credit',c,'receivable',null,d.order_id,p_reason);end if;
 perform finance_private.audit('credit_issued','credit',c,null,jsonb_build_object('number',n,'invoice_id',d.id,'reason',p_reason));return c;
end;
$$;

do $$ declare t text; begin
 foreach t in array array['invoices','invoice_items','credit_notes','invoice_counters'] loop
  execute format('alter table public.%I enable row level security',t);
  execute format('revoke all on public.%I from public,anon,authenticated,service_role',t);
  if t<>'invoice_counters' then
   execute format('grant select on public.%I to authenticated',t);
   execute format('create policy admin_read on public.%I for select to authenticated using ((select public.finance_is_admin()))',t);
  end if;
 end loop;
end $$;
revoke all on function public.finance_prepare_order(uuid,boolean),public.finance_issue_invoice(uuid),public.finance_create_credit(uuid,text) from public,anon;
grant execute on function public.finance_prepare_order(uuid,boolean),public.finance_issue_invoice(uuid),public.finance_create_credit(uuid,text) to authenticated;
revoke all on all functions in schema finance_private from public,anon,authenticated;
