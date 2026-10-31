alter table public.orders
  add column if not exists carrier_status text,
  add column if not exists carrier_status_updated_at timestamptz;

grant select (carrier_status, carrier_status_updated_at) on public.orders to authenticated;
grant update (carrier_status, carrier_status_updated_at) on public.orders to authenticated;
