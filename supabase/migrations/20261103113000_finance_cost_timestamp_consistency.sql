-- Variant costs deliberately use clock_timestamp() so multiple cost changes inside a
-- long transaction retain their true ordering. Admin order confirmation must use the
-- same wall-clock semantics; otherwise a cost recorded earlier in the transaction can
-- appear later than confirmed_at (because now() is fixed at transaction start).
--
-- This changes only future admin-confirmation timestamps. Existing orders and costs
-- are left untouched.
create or replace function public.place_admin_order(
  p_customer jsonb,
  p_items jsonb,
  p_source text default 'other'::text,
  p_confirmed boolean default false
)
returns uuid
language plpgsql
security definer
set search_path to ''
as $function$
declare
  v_user_id uuid := (select auth.uid());
  v_source text := lower(trim(coalesce(p_source, 'other')));
  v_token uuid;
begin
  if v_user_id is null
     or (select public.has_admin_role(
       v_user_id,
       array['owner','staff']::public.admin_role[]
     )) is not true then
    raise exception 'Only store administrators can create manual orders'
      using errcode = 'insufficient_privilege';
  end if;

  if v_source not in ('instagram', 'facebook', 'whatsapp', 'phone', 'other') then
    raise exception 'Invalid manual order source' using errcode = 'check_violation';
  end if;

  v_token := public.place_order(p_customer, p_items);

  update public.orders
     set order_source = v_source,
         status = case when p_confirmed then 'confirmed'::public.order_status else status end,
         confirmed_at = case when p_confirmed then clock_timestamp() else confirmed_at end,
         confirmed_by = case when p_confirmed then v_user_id::text else confirmed_by end
   where public_token = v_token;

  return v_token;
end;
$function$;
