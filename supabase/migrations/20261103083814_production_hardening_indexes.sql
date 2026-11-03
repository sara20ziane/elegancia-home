-- Additive only. Reverse FK lookups in withholding totals and variant history.
-- Unique(invoice_id,source_item_id), unique(purchase_id,variant_id) and the
-- existing settlement/order indexes already cover the other important joins.
set lock_timeout = '3s';
set statement_timeout = '30s';
create index if not exists cod_withholding_receipts_settlement_idx
  on public.cod_withholding_receipts(settlement_id);
create index if not exists finance_purchase_items_variant_idx
  on public.finance_purchase_items(variant_id);
reset statement_timeout;
reset lock_timeout;
