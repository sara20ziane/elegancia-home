create table if not exists public.product_categories (
  product_id uuid not null references public.products(id) on delete cascade,
  category_id uuid not null references public.categories(id) on delete cascade,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  primary key (product_id, category_id)
);

create index if not exists product_categories_category_id_idx
  on public.product_categories(category_id, product_id);

alter table public.product_categories enable row level security;

drop policy if exists "Admins manage product categories" on public.product_categories;
create policy "Admins manage product categories"
  on public.product_categories
  for all
  to authenticated
  using ((select public.has_admin_role((select auth.uid()), array['owner'::public.admin_role, 'staff'::public.admin_role])) is true)
  with check ((select public.has_admin_role((select auth.uid()), array['owner'::public.admin_role, 'staff'::public.admin_role])) is true);

drop policy if exists "Public reads published product categories" on public.product_categories;
create policy "Public reads published product categories"
  on public.product_categories
  for select
  to anon, authenticated
  using (
    exists (
      select 1
      from public.products p
      join public.categories c on c.id = product_categories.category_id
      where p.id = product_categories.product_id
        and p.status = 'published'
        and c.is_active
    )
  );

grant select on public.product_categories to anon;
grant select, insert, update, delete on public.product_categories to authenticated;

insert into public.product_categories (product_id, category_id, sort_order)
select id, category_id, 0
from public.products
where category_id is not null
on conflict (product_id, category_id) do nothing;

update public.categories
set slug = 'parure-de-drap',
    name = 'أطقم الشراشف',
    name_fr = 'Parure de drap',
    sort_order = 0,
    is_active = true
where slug = 'parures-de-lit';

update public.categories
set slug = 'parure-housse-de-couette',
    name = 'أطقم أغطية اللحاف',
    name_fr = 'Parure housse de couette',
    sort_order = 1,
    is_active = true
where slug = 'housses-de-couette';

update public.categories
set name = 'بطانيات خفيفة',
    name_fr = 'Plaid',
    sort_order = 2,
    is_active = true
where slug = 'plaids';

update public.categories
set slug = 'taies-d-oreillers',
    name = 'أغطية الوسائد',
    name_fr = 'Taies d’oreillers',
    sort_order = 3,
    is_active = true
where slug = 'oreillers';

update public.categories
set slug = 'jetees',
    name = 'مفارش السرير',
    name_fr = 'Jetées',
    sort_order = 4,
    is_active = true
where slug = 'linge-de-maison';

update public.categories
set is_active = false,
    sort_order = case slug
      when 'draps' then 100
      when 'couettes' then 101
      when 'protege-matelas' then 102
      else sort_order
    end
where slug in ('draps', 'couettes', 'protege-matelas');

create or replace function public.category_product_counts()
returns table(category_id uuid, product_count bigint)
language sql
stable security definer
set search_path to ''
as $function$
  select pc.category_id, count(distinct pc.product_id)::bigint as product_count
  from public.product_categories pc
  join public.products p on p.id = pc.product_id
  join public.categories c on c.id = pc.category_id
  where p.status = 'published'
    and c.is_active
  group by pc.category_id;
$function$;

create or replace function public.catalogue_page(
  p_category_slug text default null,
  p_query text default null,
  p_sizes text[] default null,
  p_colors text[] default null,
  p_min_price integer default null,
  p_max_price integer default null,
  p_in_stock boolean default false,
  p_sort text default 'newest',
  p_limit integer default 12,
  p_offset integer default 0
)
returns jsonb
language sql
stable security definer
set search_path to ''
as $function$
with matched as (
  select
    p.id,
    p.name,
    p.published_at,
    (select min(v.price) from public.product_variants v
      where v.product_id = p.id and v.is_active) as min_price,
    (select max(v.price) from public.product_variants v
      where v.product_id = p.id and v.is_active) as max_price
  from public.products p
  where p.status = 'published'
    and (
      p_category_slug is null
      or exists (
        select 1
        from public.product_categories pc
        join public.categories c on c.id = pc.category_id
        where pc.product_id = p.id
          and c.slug = p_category_slug
          and c.is_active
      )
    )
    and (
      coalesce(trim(p_query), '') = ''
      or not exists (
        select 1
        from unnest(string_to_array(public.normalize_arabic(p_query), ' ')) as word
        where word <> ''
          and public.normalize_arabic(
            p.name || ' ' || coalesce(p.name_fr, '') || ' ' || coalesce(p.description, '')
            || ' ' || p.slug || ' ' || coalesce((
              select string_agg(
                coalesce(v.sku, '') || ' ' || coalesce(v.size, '') || ' ' || coalesce(v.color_name, ''),
                ' '
              )
              from public.product_variants v where v.product_id = p.id
            ), '')
          ) not like '%' || word || '%'
      )
    )
    and (
      coalesce(array_length(p_sizes, 1), 0) = 0
      or exists (select 1 from public.product_variants v
        where v.product_id = p.id and v.is_active and v.size = any(p_sizes))
    )
    and (
      coalesce(array_length(p_colors, 1), 0) = 0
      or exists (select 1 from public.product_variants v
        where v.product_id = p.id and v.is_active and v.color_name = any(p_colors))
    )
    and (
      not coalesce(p_in_stock, false)
      or exists (select 1 from public.product_variants v
        where v.product_id = p.id and v.is_active and v.stock > 0)
    )
    and (
      p_min_price is null
      or exists (select 1 from public.product_variants v
        where v.product_id = p.id and v.is_active and v.price >= p_min_price)
    )
    and (
      p_max_price is null
      or exists (select 1 from public.product_variants v
        where v.product_id = p.id and v.is_active and v.price <= p_max_price)
    )
),
ranked as (
  select
    m.id,
    row_number() over (
      order by
        case when p_sort = 'price-asc' then m.min_price end asc nulls last,
        case when p_sort = 'price-desc' then m.max_price end desc nulls last,
        case when p_sort = 'name' then m.name end asc,
        case when p_sort not in ('price-asc', 'price-desc', 'name') then m.published_at end desc nulls last,
        m.id
    ) as ord
  from matched m
),
page as (
  select r.id, r.ord from ranked r
  order by r.ord
  limit greatest(coalesce(p_limit, 12), 1)
  offset greatest(coalesce(p_offset, 0), 0)
)
select jsonb_build_object(
  'total', (select count(*) from matched),
  'products', coalesce((
    select jsonb_agg(
      jsonb_build_object(
        'id', p.id,
        'slug', p.slug,
        'name', p.name,
        'name_fr', p.name_fr,
        'description', p.description,
        'description_fr', p.description_fr,
        'kind', p.kind,
        'status', p.status,
        'category_id', p.category_id,
        'published_at', p.published_at,
        'rating_avg', (select round(avg(r.rating)::numeric, 2) from public.reviews r where r.product_id = p.id and r.is_approved),
        'rating_count', (select count(*) from public.reviews r where r.product_id = p.id and r.is_approved),
        'categories', case when c.id is null then null else jsonb_build_object(
          'slug', c.slug, 'name', c.name, 'name_fr', c.name_fr
        ) end,
        'product_variants', coalesce((
          select jsonb_agg(
            jsonb_build_object(
              'id', v.id,
              'size', v.size,
              'color_name', v.color_name,
              'price', v.price,
              'compare_at_price', v.compare_at_price,
              'stock', v.stock,
              'is_active', v.is_active,
              'sort_order', v.sort_order,
              'variant_images', case
                when v.id = (
                  select v2.id from public.product_variants v2
                  where v2.product_id = p.id and v2.is_active
                    and exists (select 1 from public.variant_images i2 where i2.variant_id = v2.id)
                  order by v2.sort_order, v2.price
                  limit 1
                ) then coalesce((
                  select jsonb_agg(jsonb_build_object('id', i.id, 'url', i.url, 'alt', i.alt, 'sort_order', i.sort_order))
                  from (select * from public.variant_images where variant_id = v.id order by sort_order limit 1) i
                ), '[]'::jsonb)
                else '[]'::jsonb
              end
            ) order by v.sort_order
          )
          from public.product_variants v
          where v.product_id = p.id and v.is_active
        ), '[]'::jsonb)
      )
      order by page.ord
    )
    from page
    join public.products p on p.id = page.id
    left join public.categories c on c.id = p.category_id
  ), '[]'::jsonb),
  'facets', jsonb_build_object(
    'sizes', coalesce((
      select jsonb_agg(distinct v.size order by v.size)
      from public.product_variants v
      join public.products p on p.id = v.product_id
      where p.status = 'published' and v.is_active and coalesce(v.size, '') <> ''
    ), '[]'::jsonb),
    'colors', coalesce((
      select jsonb_agg(distinct v.color_name order by v.color_name)
      from public.product_variants v
      join public.products p on p.id = v.product_id
      where p.status = 'published' and v.is_active and coalesce(v.color_name, '') <> ''
    ), '[]'::jsonb),
    'priceMin', coalesce((
      select min(v.price) from public.product_variants v
      join public.products p on p.id = v.product_id
      where p.status = 'published' and v.is_active
    ), 0),
    'priceMax', coalesce((
      select max(v.price) from public.product_variants v
      join public.products p on p.id = v.product_id
      where p.status = 'published' and v.is_active
    ), 0)
  )
);
$function$;
