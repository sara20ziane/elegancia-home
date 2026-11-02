-- Native operational finance. No backfill and no replacement of order/stock logic.
create schema finance_private;
revoke all on schema finance_private from public, anon, authenticated;
create function public.finance_is_owner() returns boolean language sql stable security definer set search_path='' as $$
 select exists(select 1 from public.admin_users where user_id=auth.uid() and role='owner');
$$;
create function public.finance_is_admin() returns boolean language sql stable security definer set search_path='' as $$
 select exists(select 1 from public.admin_users where user_id=auth.uid() and role in ('owner','staff'));
$$;
revoke all on function public.finance_is_owner(), public.finance_is_admin() from public,anon;
grant execute on function public.finance_is_owner(), public.finance_is_admin() to authenticated,service_role;
create function finance_private.require_role(owner_only boolean default true) returns void language plpgsql set search_path='' as $$
begin
 if (case when owner_only then public.finance_is_owner() else public.finance_is_admin() end) is not true then
  raise exception 'Accès Finance refusé' using errcode='insufficient_privilege';
 end if;
end;
$$;

create table public.finance_accounts (
 id uuid primary key default gen_random_uuid(), name text not null check(length(trim(name)) between 1 and 100),
 kind text not null check(kind in ('cash','bank','receivable')), active boolean not null default true,
 created_by uuid references auth.users(id), created_at timestamptz not null default now()
);
create table public.finance_settings (
 id smallint primary key default 1 check(id=1), enabled boolean not null default false, enabled_since timestamptz,
 issue_trigger text not null default 'delivered' check(issue_trigger in ('confirmed','shipped','delivered')),
 auto_issue boolean not null default false, cod_account_id uuid references public.finance_accounts(id),
 company_name text, legal_address text, phone text, email text, rc text, nif text, nis text, ai text,
 logo_path text, tax_rate numeric(6,3) check(tax_rate between 0 and 100), tax_label text,
 updated_at timestamptz not null default now()
);
insert into public.finance_settings(id) values(1);
create table public.finance_categories (
 id uuid primary key default gen_random_uuid(), name text not null unique check(length(trim(name)) between 1 and 100), active boolean not null default true
);
create table public.finance_suppliers (
 id uuid primary key default gen_random_uuid(), name text not null check(length(trim(name)) between 1 and 150),
 phone text, email text, address text, note text, active boolean not null default true,
 created_at timestamptz not null default now(), created_by uuid references auth.users(id)
);
create table public.variant_costs (
 id uuid primary key default gen_random_uuid(), variant_id uuid not null references public.product_variants(id) on delete restrict,
 unit_cost numeric(16,2) not null check(unit_cost>=0), source_id uuid,
 recorded_at timestamptz not null default clock_timestamp(), created_by uuid references auth.users(id)
);
create index variant_cost_latest on public.variant_costs(variant_id,recorded_at desc,id);
create table public.order_finance (
 order_id uuid primary key references public.orders(id) on delete restrict,
 snapshot jsonb not null, product_cost numeric(16,2), delivery_cost numeric(16,2) check(delivery_cost>=0),
 missing_costs integer not null check(missing_costs>=0), total numeric(16,2) not null check(total>=0),
 delivered_at timestamptz, carrier text, cancelled_at timestamptz,
 cod_account_id uuid not null references public.finance_accounts(id),
 captured_at timestamptz not null default now(), created_by uuid references auth.users(id)
);
create index order_finance_delivered on public.order_finance(delivered_at,carrier) where delivered_at is not null;
create table public.financial_movements (
 id uuid primary key default gen_random_uuid(), domain text not null check(domain in ('cash','receivable','analytic')),
 kind text not null check(kind in ('sale','cod_receivable','cod_settlement','carrier_fee','withholding','withholding_receipt','expense','purchase','refund','credit_note','cost_recovery','adjustment','reversal')),
 amount numeric(16,2) not null check(amount>0), direction text not null check(direction in ('in','out')),
 occurred_at timestamptz not null, source_type text not null, source_id uuid not null, entry_key text not null,
 account_id uuid references public.finance_accounts(id), order_id uuid references public.orders(id) on delete restrict,
 reverses_id uuid unique references public.financial_movements(id), note text,
 created_by uuid references auth.users(id), created_at timestamptz not null default now(),
 unique(source_type,source_id,entry_key), check(domain<>'cash' or account_id is not null)
);
create index finance_movement_period on public.financial_movements(domain,occurred_at);
create index finance_movement_account on public.financial_movements(account_id,occurred_at);
create index finance_movement_order on public.financial_movements(order_id);
create table public.cod_settlements (
 id uuid primary key, carrier text not null check(length(trim(carrier)) between 1 and 100),
 reference text not null check(length(trim(reference)) between 1 and 150), occurred_at timestamptz not null,
 gross numeric(16,2) not null check(gross>0), fees numeric(16,2) not null check(fees>=0),
 withheld numeric(16,2) not null check(withheld>=0), net numeric(16,2) not null check(net>0),
 account_id uuid not null references public.finance_accounts(id), note text, request_payload jsonb not null,
 created_by uuid not null references auth.users(id), created_at timestamptz not null default now(),
 unique(carrier,reference), check(net=gross-fees-withheld)
);
create table public.cod_settlement_items (
 order_id uuid primary key references public.order_finance(order_id) on delete restrict,
 settlement_id uuid not null references public.cod_settlements(id) on delete restrict,
 gross numeric(16,2) not null check(gross>0), fees numeric(16,2) not null check(fees>=0),
 withheld numeric(16,2) not null check(withheld>=0), check(fees+withheld<=gross)
);
create index cod_settlement_lines on public.cod_settlement_items(settlement_id);
create table public.finance_audit_log (
 id bigint generated always as identity primary key, action text not null, source_type text not null, source_id uuid,
 old_value jsonb, new_value jsonb, created_by uuid references auth.users(id), created_at timestamptz not null default now()
);
create table public.finance_failures (
 order_id uuid primary key references public.orders(id) on delete cascade,
 code text not null, occurred_at timestamptz not null default now()
);
create function finance_private.audit(action text, source_type text, source_id uuid, old_value jsonb, new_value jsonb)
returns void language sql set search_path='' as $$
 insert into public.finance_audit_log(action,source_type,source_id,old_value,new_value,created_by)
 values(action,source_type,source_id,old_value,new_value,auth.uid());
$$;
create function finance_private.immutable() returns trigger language plpgsql set search_path='' as $$
begin raise exception 'Historique financier immuable' using errcode='check_violation'; end;
$$;
create trigger movements_immutable before update or delete on public.financial_movements for each row execute function finance_private.immutable();
create trigger audit_immutable before update or delete on public.finance_audit_log for each row execute function finance_private.immutable();
create trigger costs_immutable before update or delete on public.variant_costs for each row execute function finance_private.immutable();
create trigger settlements_immutable before update or delete on public.cod_settlements for each row execute function finance_private.immutable();
create trigger settlement_items_immutable before update or delete on public.cod_settlement_items for each row execute function finance_private.immutable();

create function finance_private.cash_account(p_id uuid) returns void language plpgsql set search_path='' as $$
begin
 perform 1 from public.finance_accounts where id=p_id and active and kind in ('cash','bank') for share;
 if not found then
  raise exception 'Compte de trésorerie actif requis' using errcode='check_violation';
 end if;
end;
$$;
create function finance_private.move(p_domain text,p_kind text,p_amount numeric,p_direction text,p_at timestamptz,
 p_source text,p_id uuid,p_key text,p_account uuid default null,p_order uuid default null,p_note text default null)
returns void language plpgsql set search_path='' as $$
begin
 if p_amount=0 then return; end if;
 insert into public.financial_movements(domain,kind,amount,direction,occurred_at,source_type,source_id,entry_key,account_id,order_id,note,created_by)
 values(p_domain,p_kind,p_amount,p_direction,p_at,p_source,p_id,p_key,p_account,p_order,p_note,auth.uid());
end;
$$;

create function public.finance_configure(p jsonb) returns void language plpgsql security definer set search_path='' as $$
declare old_s jsonb; s public.finance_settings%rowtype;
begin
 perform finance_private.require_role();
 select to_jsonb(x) into old_s from public.finance_settings x where id=1 for update;
 update public.finance_settings set
  enabled=coalesce((p->>'enabled')::boolean,enabled),
  enabled_since=case when (p->>'enabled')::boolean then coalesce(enabled_since,now()) else enabled_since end,
  issue_trigger=coalesce(p->>'issue_trigger',issue_trigger), auto_issue=coalesce((p->>'auto_issue')::boolean,auto_issue),
  cod_account_id=case when p?'cod_account_id' then nullif(p->>'cod_account_id','')::uuid else cod_account_id end,
  company_name=case when p?'company_name' then nullif(trim(p->>'company_name'),'') else company_name end,
  legal_address=case when p?'legal_address' then nullif(p->>'legal_address','') else legal_address end,
  phone=case when p?'phone' then nullif(p->>'phone','') else phone end,
  email=case when p?'email' then nullif(p->>'email','') else email end,
  rc=case when p?'rc' then nullif(p->>'rc','') else rc end,
  nif=case when p?'nif' then nullif(p->>'nif','') else nif end,
  nis=case when p?'nis' then nullif(p->>'nis','') else nis end,
  ai=case when p?'ai' then nullif(p->>'ai','') else ai end,
  logo_path=case when p?'logo_path' then nullif(p->>'logo_path','') else logo_path end,
  tax_rate=case when p?'tax_rate' then nullif(p->>'tax_rate','')::numeric else tax_rate end,
  tax_label=case when p?'tax_label' then nullif(p->>'tax_label','') else tax_label end, updated_at=now()
 where id=1 returning * into s;
 if s.enabled and not exists(select 1 from public.finance_accounts where id=s.cod_account_id and active and kind='receivable') then
  raise exception 'Configurer un compte de créances actif avant activation' using errcode='check_violation';
 end if;
 if s.logo_path is not null and not exists(select 1 from storage.objects where bucket_id='finance-documents' and name=s.logo_path and name like 'brand/%') then
  raise exception 'Logo privé introuvable' using errcode='check_violation';
 end if;
 perform finance_private.audit('settings_changed','settings',null,old_s,to_jsonb(s));
end;
$$;

create function public.finance_save_entity(p_kind text,p jsonb) returns uuid language plpgsql security definer set search_path='' as $$
declare v_id uuid:=coalesce(nullif(p->>'id','')::uuid,gen_random_uuid()); old_v jsonb;
begin
 perform finance_private.require_role();
 if p_kind='account' then
  select to_jsonb(a) into old_v from public.finance_accounts a where id=v_id for update;
  if old_v is not null and old_v->>'kind' is distinct from p->>'kind' and exists(select 1 from public.financial_movements where account_id=v_id) then raise exception 'Type de compte historique immuable'; end if;
  insert into public.finance_accounts(id,name,kind,active,created_by) values(v_id,trim(p->>'name'),p->>'kind',coalesce((p->>'active')::boolean,true),auth.uid())
   on conflict(id) do update set name=excluded.name,kind=excluded.kind,active=excluded.active;
 elsif p_kind='category' then
  select to_jsonb(a) into old_v from public.finance_categories a where id=v_id;
  insert into public.finance_categories(id,name,active) values(v_id,trim(p->>'name'),coalesce((p->>'active')::boolean,true))
   on conflict(id) do update set name=excluded.name,active=excluded.active;
 elsif p_kind='supplier' then
  select to_jsonb(a) into old_v from public.finance_suppliers a where id=v_id;
  insert into public.finance_suppliers(id,name,phone,email,address,note,created_by) values(v_id,trim(p->>'name'),p->>'phone',p->>'email',p->>'address',p->>'note',auth.uid())
   on conflict(id) do update set name=excluded.name,phone=excluded.phone,email=excluded.email,address=excluded.address,note=excluded.note;
 else raise exception 'Type inconnu'; end if;
 perform finance_private.audit('entity_saved',p_kind,v_id,old_v,p);
 return v_id;
end;
$$;
create function public.finance_set_cost(p_variant uuid,p_cost numeric,p_request uuid) returns uuid language plpgsql security definer set search_path='' as $$
declare v_id uuid;
begin
 perform finance_private.require_role();
 if p_cost is null or p_cost<0 or p_cost<>round(p_cost,2) then raise exception 'Coût invalide'; end if;
 select id into v_id from public.variant_costs where id=p_request and variant_id=p_variant and unit_cost=p_cost;
 if found then return v_id;end if;
 insert into public.variant_costs(id,variant_id,unit_cost,created_by) values(p_request,p_variant,p_cost,auth.uid()) returning id into v_id;
 perform finance_private.audit('cost_added','cost',v_id,null,jsonb_build_object('variant_id',p_variant,'unit_cost',p_cost)); return v_id;
end;
$$;

-- Public schema is opt-in: owner reads only; no direct table mutations, even by staff.
do $$ declare t text; begin
 foreach t in array array['finance_accounts','finance_settings','finance_categories','finance_suppliers','variant_costs','order_finance','financial_movements','cod_settlements','cod_settlement_items','finance_audit_log','finance_failures'] loop
  execute format('alter table public.%I enable row level security',t);
  execute format('revoke all on public.%I from public,anon,authenticated,service_role',t);
  execute format('grant select on public.%I to authenticated',t);
  execute format('create policy owner_read on public.%I for select to authenticated using ((select public.finance_is_owner()))',t);
 end loop;
end $$;
revoke all on function public.finance_configure(jsonb),public.finance_save_entity(text,jsonb),public.finance_set_cost(uuid,numeric,uuid) from public,anon;
grant execute on function public.finance_configure(jsonb),public.finance_save_entity(text,jsonb),public.finance_set_cost(uuid,numeric,uuid) to authenticated;
revoke all on all functions in schema finance_private from public,anon,authenticated;
