-- Additive finance integration. No price, stock or carrier trigger is replaced.
create table public.order_finance (
  order_id uuid primary key references public.orders(id) on delete cascade,
  erp_customer_id text,
  erp_sales_order_id text unique,
  erp_sales_invoice_id text unique,
  erp_payment_entry_id text unique,
  erp_sync_status text not null default 'unsynced'
    check (erp_sync_status in ('unsynced','synced','invoiced','paid','error','cancelled')),
  erp_last_sync_at timestamptz,
  erp_sync_error text,
  cod_received_at timestamptz,
  cod_received_by uuid references auth.users(id),
  cod_received_amount integer check (cod_received_amount >= 0),
  cod_receipt_reference text,
  check ((cod_received_at is null and cod_received_by is null and cod_received_amount is null and cod_receipt_reference is null)
    or (cod_received_at is not null and cod_received_by is not null and cod_received_amount is not null and cod_receipt_reference is not null
      and length(trim(cod_receipt_reference)) between 1 and 200))
);
create table public.erp_customers (
  phone text primary key check (phone ~ '^0[567][0-9]{8}$'),
  erp_customer_id text not null unique
);
-- SKU is a reviewed snapshot, not a presumed unique catalogue key.
create table public.erp_item_mappings (
  variant_id uuid primary key references public.product_variants(id) on delete restrict,
  erp_item_code text not null unique check (length(trim(erp_item_code)) between 1 and 140),
  sku text,
  updated_at timestamptz not null default now()
);
create table public.erp_sync_queue (
  order_id uuid primary key references public.orders(id) on delete cascade,
  revision integer not null default 1,
  processed_revision integer not null default 0,
  claimed_revision integer,
  lock_token uuid,
  locked_until timestamptz,
  attempts integer not null default 0,
  started_at timestamptz,
  blocked boolean not null default false,
  next_attempt_at timestamptz not null default now()
);
alter table public.order_finance enable row level security;
alter table public.erp_customers enable row level security;
alter table public.erp_item_mappings enable row level security;
alter table public.erp_sync_queue enable row level security;
revoke all on public.order_finance, public.erp_customers, public.erp_item_mappings, public.erp_sync_queue
  from public, anon, authenticated, service_role;
grant select on public.order_finance, public.erp_item_mappings to authenticated;
grant insert, update, delete on public.erp_item_mappings to authenticated;
grant select, insert, update on public.order_finance, public.erp_customers, public.erp_sync_queue to service_role;
grant select on public.erp_item_mappings to service_role;
create policy finance_admin_read on public.order_finance for select to authenticated
  using ((select public.has_admin_role((select auth.uid()), array['owner','staff']::public.admin_role[])));
create policy erp_mapping_admin on public.erp_item_mappings for all to authenticated
  using ((select public.has_admin_role((select auth.uid()), array['owner','staff']::public.admin_role[])))
  with check ((select public.has_admin_role((select auth.uid()), array['owner','staff']::public.admin_role[])));

-- Preserve deletion of never-synchronized negative orders while the flag is off.
-- Serialize with claim: an uncertain remote write must never lose its local key.
create function public.erp_protect_history() returns trigger
language plpgsql security definer set search_path = '' as $$
declare started timestamptz;
begin
  select started_at into started from public.erp_sync_queue where order_id=old.id for update;
  if started is not null or exists(select 1 from public.order_finance where order_id=old.id
    and (erp_customer_id is not null or erp_sales_order_id is not null or erp_sales_invoice_id is not null
      or erp_payment_entry_id is not null or cod_received_at is not null)) then
    raise exception 'Financial synchronization history cannot be deleted' using errcode='check_violation';
  end if;
  return old;
end;
$$;
revoke all on function public.erp_protect_history() from public,anon,authenticated;
create trigger erp_protect_order_delete before delete on public.orders
  for each row execute function public.erp_protect_history();

create function public.erp_enqueue_order() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if tg_op = 'UPDATE' and new.status is not distinct from old.status then return new; end if;
  if new.status in ('confirmed','shipped','delivered')
     or exists(select 1 from public.order_finance where order_id=new.id) then
    insert into public.order_finance(order_id) values(new.id) on conflict do nothing;
    insert into public.erp_sync_queue(order_id) values(new.id)
      on conflict(order_id) do update set revision=erp_sync_queue.revision+1,
        blocked=false, next_attempt_at=now();
  end if;
  return new;
end;
$$;
revoke all on function public.erp_enqueue_order() from public, anon, authenticated;
create trigger erp_order_event after insert or update of status on public.orders
  for each row execute function public.erp_enqueue_order();

-- Explicit synchronization also allows reviewed historical orders, without bulk backfill.
create function public.erp_request_sync(p_order_id uuid) returns void
language plpgsql security definer set search_path = '' as $$
declare o public.orders%rowtype;
begin
  select * into o from public.orders where id=p_order_id for update;
  if not found then raise exception 'Order missing'; end if;
  if o.status not in ('confirmed','shipped','delivered')
    and not exists(select 1 from public.order_finance where order_id=p_order_id) then return; end if;
  insert into public.order_finance(order_id) values(p_order_id) on conflict do nothing;
  insert into public.erp_sync_queue(order_id) values(p_order_id)
    on conflict(order_id) do update set revision=erp_sync_queue.revision+1, blocked=false, next_attempt_at=now();
end;
$$;
revoke all on function public.erp_request_sync(uuid) from public, anon, authenticated;
grant execute on function public.erp_request_sync(uuid) to service_role;

create function public.erp_claim_sync(p_order_id uuid default null) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare q public.erp_sync_queue%rowtype; token uuid := gen_random_uuid();
begin
  select * into q from public.erp_sync_queue
   where revision > processed_revision and not blocked and next_attempt_at <= now()
     and (locked_until is null or locked_until < now())
     and (p_order_id is null or order_id=p_order_id)
   order by next_attempt_at, order_id for update skip locked limit 1;
  if not found then return null; end if;
  update public.erp_sync_queue set lock_token=token, locked_until=now()+interval '2 minutes',
    claimed_revision=revision, attempts=attempts+1, started_at=coalesce(started_at,now()) where order_id=q.order_id;
  return jsonb_build_object('order_id',q.order_id,'lock_token',token);
end;
$$;
revoke all on function public.erp_claim_sync(uuid) from public, anon, authenticated;
grant execute on function public.erp_claim_sync(uuid) to service_role;

create function public.erp_save_sync(p_order_id uuid, p_lock uuid, p_patch jsonb,
  p_complete boolean default false, p_retryable boolean default false) returns boolean
language plpgsql security definer set search_path = '' as $$
declare q public.erp_sync_queue%rowtype;
begin
  select * into q from public.erp_sync_queue where order_id=p_order_id and lock_token=p_lock for update;
  if not found then return false; end if;
  -- Stop before the next ERP document if a new local event arrived during I/O.
  if not p_complete and q.revision <> q.claimed_revision then return false; end if;
  update public.order_finance set
    erp_customer_id=coalesce(p_patch->>'erp_customer_id',erp_customer_id),
    erp_sales_order_id=coalesce(p_patch->>'erp_sales_order_id',erp_sales_order_id),
    erp_sales_invoice_id=coalesce(p_patch->>'erp_sales_invoice_id',erp_sales_invoice_id),
    erp_payment_entry_id=coalesce(p_patch->>'erp_payment_entry_id',erp_payment_entry_id),
    erp_sync_status=coalesce(p_patch->>'erp_sync_status',erp_sync_status),
    erp_sync_error=case when p_patch ? 'erp_sync_error' then left(p_patch->>'erp_sync_error',500) else erp_sync_error end,
    erp_last_sync_at=now()
  where order_id=p_order_id;
  if p_complete then
    update public.erp_sync_queue set lock_token=null, locked_until=null,
      processed_revision=case when p_patch->>'erp_sync_status'='error' then processed_revision else q.claimed_revision end,
      blocked=(p_patch->>'erp_sync_status'='error' and not p_retryable and revision=q.claimed_revision),
      next_attempt_at=case when revision>q.claimed_revision then now()
        when p_patch->>'erp_sync_status'='error' then now()+make_interval(secs=>least(3600,30*power(2,least(q.attempts,7))::integer)) else now() end,
      attempts=case when p_patch->>'erp_sync_status'='error' then attempts else 0 end
    where order_id=p_order_id;
  end if;
  return true;
end;
$$;
revoke all on function public.erp_save_sync(uuid,uuid,jsonb,boolean,boolean) from public, anon, authenticated;
grant execute on function public.erp_save_sync(uuid,uuid,jsonb,boolean,boolean) to service_role;

create function public.erp_record_cod_receipt(p_order_id uuid, p_amount integer, p_reference text,
  p_received_at timestamptz) returns void
language plpgsql security definer set search_path = '' as $$
declare o public.orders%rowtype; f public.order_finance%rowtype;
begin
  if public.has_admin_role(auth.uid(),array['owner','staff']::public.admin_role[]) is not true then
    raise exception 'Admin only' using errcode='insufficient_privilege';
  end if;
  select * into o from public.orders where id=p_order_id for update;
  if not found or o.status <> 'delivered' or p_amount is distinct from o.total or p_amount<=0
    or p_received_at is null or p_received_at>now() or p_received_at<o.created_at
    or p_reference is null or length(trim(p_reference)) not between 1 and 200 then
    raise exception 'Invalid full COD receipt' using errcode='check_violation';
  end if;
  insert into public.order_finance(order_id) values(p_order_id) on conflict do nothing;
  select * into f from public.order_finance where order_id=p_order_id for update;
  if f.cod_received_at is not null then
    if f.cod_received_amount=p_amount and f.cod_receipt_reference=trim(p_reference) and f.cod_received_at=p_received_at then return; end if;
    raise exception 'Receipt already recorded' using errcode='check_violation';
  end if;
  update public.order_finance set cod_received_at=p_received_at, cod_received_by=auth.uid(),
    cod_received_amount=p_amount, cod_receipt_reference=trim(p_reference) where order_id=p_order_id;
  perform public.erp_request_sync(p_order_id);
end;
$$;
revoke all on function public.erp_record_cod_receipt(uuid,integer,text,timestamptz) from public, anon;
grant execute on function public.erp_record_cod_receipt(uuid,integer,text,timestamptz) to authenticated;
notify pgrst, 'reload schema';
