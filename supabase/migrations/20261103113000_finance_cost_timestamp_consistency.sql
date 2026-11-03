-- Keep variant cost effective timestamps on the same transaction-time clock used by
-- order confirmation (`now()`). This prevents a cost created earlier in the same
-- transaction from appearing to be in the future relative to `confirmed_at`.
-- Existing historical rows are intentionally left unchanged.
alter table public.variant_costs
  alter column recorded_at set default now();
