delete from public.categories c
where c.slug in ('draps', 'couettes', 'protege-matelas')
  and not exists (select 1 from public.product_categories pc where pc.category_id = c.id)
  and not exists (select 1 from public.products p where p.category_id = c.id);
