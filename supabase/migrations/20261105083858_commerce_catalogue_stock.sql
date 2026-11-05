-- Preserve Elegancia multi-category filters and all existing catalogue fields.
create or replace function public.catalogue_page(
  p_category_slug text default null,
  p_query text default null,
  p_sizes text[] default null,
  p_colors text[] default null,
  p_min_price int default null,
  p_max_price int default null,
  p_in_stock boolean default false,
  p_sort text default 'newest',
  p_limit int default 12,
  p_offset int default 0
)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
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
  left join public.categories c on c.id = p.category_id
  where p.status = 'published'
    and (p_category_slug is null or c.slug = p_category_slug)
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
        where v.product_id = p.id and v.is_active and commerce_private.sellable_stock(v.id) > 0)
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
        -- Card ratings, aggregated here so a grid of twelve does not send twelve
        -- review requests of its own.
        'rating_avg', (select round(avg(r.rating)::numeric, 2) from public.reviews r
                        where r.product_id = p.id and r.is_approved),
        'rating_count', (select count(*) from public.reviews r
                          where r.product_id = p.id and r.is_approved),
        'categories', case when c.id is null then null else jsonb_build_object(
          'slug', c.slug, 'name', c.name, 'name_fr', c.name_fr
        ) end,
        -- Only what a card draws: price, sale, stock, order, and one photo. A
        -- product page fetches everything else itself. Sending every variant's
        -- every photo made the home page 510 KB of HTML for twelve cards.
        'product_variants', coalesce((
          select jsonb_agg(
            jsonb_build_object(
              'id', v.id,
              'size', v.size,
              'color_name', v.color_name,
              'price', v.price,
              'compare_at_price', v.compare_at_price,
              'stock', commerce_private.sellable_stock(v.id),
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
                  from (select * from public.variant_images
                        where variant_id = v.id order by sort_order limit 1) i
                ), '[]'::jsonb)
                else '[]'::jsonb
              end
            )
            order by v.sort_order
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
  -- Facets come from the whole published catalogue, not the filtered page, so the
  -- filter panel does not empty itself out as the buyer narrows.
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
$$;
