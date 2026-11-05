-- Durable outbox contains no customer snapshot or signing secret.
alter table public.order_export_targets alter column enabled set default false;
create sequence commerce_private.export_revisions;
revoke all on sequence commerce_private.export_revisions from public,anon,authenticated;
create table public.order_export_jobs (
 id bigint generated always as identity primary key,
 target_id uuid not null references public.order_export_targets(id) on delete cascade,
 order_id uuid not null references public.orders(id) on delete cascade,
 revision bigint not null default nextval('commerce_private.export_revisions'),
 event text not null check(event in ('created','status_changed','updated')),
 status text not null default 'pending' check(status in ('pending','queued','succeeded','failed')),
 attempts integer not null default 0 check(attempts between 0 and 5),
 request_id bigint,next_attempt_at timestamptz not null default now(),
 last_error text,updated_at timestamptz not null default now(),unique(target_id,order_id)
);
create index order_export_jobs_due on public.order_export_jobs(next_attempt_at) where status in ('pending','queued');
alter table public.order_export_jobs enable row level security;
revoke all on public.order_export_jobs from public,anon,authenticated;
grant select on public.order_export_jobs to authenticated;
create policy export_jobs_owner on public.order_export_jobs for select to authenticated
 using(public.has_admin_role(auth.uid(),array['owner']::public.admin_role[]));

create or replace function public.enqueue_order_export() returns trigger
language plpgsql security definer set search_path='' as $$
declare event_name text;
begin
 if tg_op='INSERT' then event_name:='created';
 elsif new.status is distinct from old.status then event_name:='status_changed';
 elsif (to_jsonb(new)-'updated_at') is distinct from (to_jsonb(old)-'updated_at') then event_name:='updated';
 else return new; end if;
 insert into public.order_export_jobs(target_id,order_id,event)
 select id,new.id,event_name from public.order_export_targets where enabled
 on conflict(target_id,order_id) do update set revision=nextval('commerce_private.export_revisions'),
 event=excluded.event,status='pending',attempts=0,request_id=null,next_attempt_at=now(),last_error=null,updated_at=now();
 return new;
exception when others then
 -- An optional export must never abort checkout. No customer data or SQL error text is logged.
 return new;
end $$;
drop trigger if exists order_export_enqueue on public.orders;
create trigger order_export_enqueue after insert or update on public.orders
 for each row execute function public.enqueue_order_export();

create function commerce_private.enqueue_items_export() returns trigger
language plpgsql security definer set search_path='' as $$
declare oid uuid;
begin
 if tg_op='DELETE' then oid:=old.order_id; else oid:=new.order_id; end if;
 insert into public.order_export_jobs(target_id,order_id,event)
 select t.id,oid,'updated' from public.order_export_targets t where t.enabled
  and exists(select 1 from public.orders where id=oid)
 on conflict(target_id,order_id) do update set revision=nextval('commerce_private.export_revisions'),
 event='updated',status='pending',attempts=0,request_id=null,next_attempt_at=now(),last_error=null,updated_at=now();
 return null;
exception when others then return null;
end $$;
create trigger commerce_export_items after insert or update or delete on public.order_items
 for each row execute function commerce_private.enqueue_items_export();

create function public.retry_order_export(p_id bigint) returns void
language plpgsql security definer set search_path='' as $$
begin
 if public.has_admin_role(auth.uid(),array['owner']::public.admin_role[]) is not true then
  raise exception 'Owner only' using errcode='insufficient_privilege';
 end if;
 update public.order_export_jobs j set status='pending',attempts=0,request_id=null,
 revision=nextval('commerce_private.export_revisions'),next_attempt_at=now(),last_error=null,updated_at=now()
 where j.id=p_id and j.status='failed' and exists(select 1 from public.order_export_targets t where t.id=j.target_id and t.enabled);
 if not found then raise exception 'Export inactif ou sans échec à reprendre'; end if;
end $$;
revoke all on function public.retry_order_export(bigint) from public,anon;
grant execute on function public.retry_order_export(bigint) to authenticated;
revoke all on function public.enqueue_order_export() from public,anon,authenticated;
revoke all on all functions in schema commerce_private from public,anon,authenticated;
