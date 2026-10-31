create or replace function public.recalculate_order_totals()
returns trigger
language plpgsql
security definer
set search_path to ''
as $function$
declare
  v_order_id uuid;
begin
  if tg_op = 'DELETE' then
    v_order_id := old.order_id;
    if exists (select 1 from public.orders o where o.id = v_order_id) then
      perform public.recalculate_for_order(v_order_id);
    end if;
    return old;
  end if;

  perform public.recalculate_for_order(new.order_id);
  return new;
end;
$function$;
