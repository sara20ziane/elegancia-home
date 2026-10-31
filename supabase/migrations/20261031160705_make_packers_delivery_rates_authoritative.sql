-- Packers / EcoTrack is the single source of truth for Elegancia delivery fees.
-- No flat fallback and no free-shipping override: if a synchronized Packers
-- rate is missing, order placement must fail rather than charge a guessed fee.

create or replace function public.delivery_fee_for(
  p_wilaya text,
  p_subtotal int,
  p_method text default 'home'
)
returns int
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_fee int;
begin
  if p_method = 'stopdesk' then
    select dz.stopdesk_fee
      into v_fee
      from public.delivery_zones dz
     where dz.wilaya = p_wilaya
       and dz.is_active;
  else
    select dz.fee
      into v_fee
      from public.delivery_zones dz
     where dz.wilaya = p_wilaya
       and dz.is_active;
  end if;

  if v_fee is null then
    raise exception 'Packers delivery rate unavailable for %', p_wilaya
      using errcode = 'check_violation', hint = 'delivery_rate_unavailable';
  end if;

  return v_fee;
end;
$$;

update public.store_settings
   set free_shipping_threshold = 0,
       delivery_fee_flat = 0,
       guepex_from_wilaya = 'Alger',
       updated_at = now()
 where id = 1;
