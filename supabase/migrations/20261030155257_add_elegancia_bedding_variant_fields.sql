-- Elegancia Home bedding configuration fields.
-- Public product information only. Purchase costs stay out of this table and
-- will live in a private/admin-only finance model.

alter table if exists public.product_variants
  add column if not exists fabric text,
  add column if not exists fabric_origin text,
  add column if not exists set_type text,
  add column if not exists piece_count integer,
  add column if not exists composition text,
  add column if not exists flat_sheet_size text,
  add column if not exists fitted_sheet_size text,
  add column if not exists duvet_cover_size text;

alter table public.product_variants
  drop constraint if exists product_variants_piece_count_check;

alter table public.product_variants
  add constraint product_variants_piece_count_check
  check (piece_count is null or piece_count > 0);

notify pgrst, 'reload schema';
