create function commerce_private.dispatch_exports() returns integer
language plpgsql security definer set search_path='' as $$
declare job record; response record; payload jsonb; signature text; request bigint; ack jsonb; sent integer:=0;
begin
 if not pg_try_advisory_xact_lock(hashtext('elegancia-export-dispatch')) then return 0; end if;
 for job in select j.*,t.url,t.secret from public.order_export_jobs j
  join public.order_export_targets t on t.id=j.target_id
  where t.enabled and j.status in ('pending','queued') and j.next_attempt_at<=now()
  order by j.next_attempt_at,j.id limit 50 for update of j skip locked
 loop
  begin
   if job.status='queued' then
    ack:=null;
    if to_regclass('net._http_response') is not null then
     execute 'select status_code,content,timed_out,error_msg from net._http_response where id=$1'
      into response using job.request_id;
     if response.status_code between 200 and 299 and not coalesce(response.timed_out,false) then
      begin ack:=response.content::jsonb; exception when others then ack:=null; end;
     end if;
    end if;
    if ack->>'ok'='true' and ack->>'order_id'=job.order_id::text and ack->>'revision'=job.revision::text then
     update public.order_export_jobs set status='succeeded',last_error=null,updated_at=now() where id=job.id;
     continue;
    end if;
    -- Never persist receiver bodies, URLs, signatures or customer data in errors.
    update public.order_export_jobs set status=case when attempts>=5 then 'failed' else 'pending' end,
     next_attempt_at=now()+make_interval(secs=>least(3600,30*power(2,attempts)::integer)),
     last_error='Réception non confirmée (HTTP, signature ou délai)',updated_at=now() where id=job.id;
    continue;
   end if;
   payload:=(public.order_export_payload(job.order_id,job.event)#-'{order,token}')
    ||jsonb_build_object('revision',job.revision::text,'event_id',job.id::text||':'||job.revision::text);
   payload:=jsonb_set(payload,'{order,delivery_method}',to_jsonb((select delivery_method from public.orders where id=job.order_id)));
   signature:=encode(extensions.hmac(payload::text,job.secret,'sha256'),'hex');
   select net.http_post(url:=job.url,body:=payload,params:=jsonb_build_object('sig',signature),
    headers:=jsonb_build_object('Content-Type','application/json','X-OpenStore-Signature','sha256='||signature),
    timeout_milliseconds:=10000) into request;
   update public.order_export_jobs set status='queued',attempts=attempts+1,request_id=request,
    next_attempt_at=now()+interval '2 minutes',updated_at=now() where id=job.id;
   sent:=sent+1;
  exception when others then
   update public.order_export_jobs set attempts=least(5,attempts+1),
    status=case when attempts>=4 then 'failed' else 'pending' end,
    next_attempt_at=now()+interval '5 minutes',last_error='Transport export indisponible',updated_at=now() where id=job.id;
  end;
 end loop;
 return sent;
end $$;
revoke all on function commerce_private.dispatch_exports() from public,anon,authenticated;
select cron.schedule('elegancia-order-exports','* * * * *',$cron$select commerce_private.dispatch_exports();$cron$);
notify pgrst,'reload schema';
