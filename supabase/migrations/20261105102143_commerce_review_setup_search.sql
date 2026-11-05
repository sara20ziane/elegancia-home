-- Correct 8-to-8 translation; the legacy string mapped ة to ي accidentally.
create or replace function public.normalise_dz_phone(raw text) returns text
language sql immutable security invoker set search_path='' as $$
 select regexp_replace(regexp_replace(coalesce(raw,''),'[^0-9+]','','g'),'^00213','+213');
$$;
create or replace function public.canonical_dz_phone(raw text) returns text
language sql immutable security invoker set search_path='' as $$
 select case when p~'^\+?213' then '0'||regexp_replace(p,'^\+?213','') else p end
 from(select public.normalise_dz_phone(raw) p) normalized;
$$;
-- Rebuild the existing expression index after the normalization improvement; no row changes.
reindex index public.orders_phone_canon_idx;
create function commerce_private.lock_order_phone() returns trigger
language plpgsql security definer set search_path='' as $$
begin
 perform pg_advisory_xact_lock(hashtext('elegancia-pending-phone:'||public.canonical_dz_phone(new.phone)));
 return new;
end $$;
create trigger a_commerce_pending_phone before insert on public.orders
 for each row execute function commerce_private.lock_order_phone();
revoke all on function commerce_private.lock_order_phone() from public,anon,authenticated;
create or replace function public.normalize_arabic(input text) returns text
language sql immutable security invoker set search_path='' as $$
 select trim(regexp_replace(regexp_replace(
  translate(lower(coalesce(input,'')),'أإآٱىةؤئ','اااايهوي'),
  '[ؐ-ًؚ-ٰٟۖ-ۭـ]','','g'),'\s+',' ','g'));
$$;
create or replace function public.validate_review() returns trigger
language plpgsql security definer set search_path='' as $$
begin
 perform pg_advisory_xact_lock(hashtext('elegancia-review-limit'));
 if (select count(*) from public.reviews where not is_approved and created_at>now()-interval '1 hour')>=20 then
  raise exception 'Trop d’avis en attente. Réessayez plus tard.' using errcode='check_violation';
 end if;
 if length(trim(coalesce(new.customer_name,''))) not between 2 and 120
  or length(trim(coalesce(new.comment,''))) not between 3 and 2000
  or new.rating not between 1 and 5 then raise exception 'Avis invalide'; end if;
 if not exists(select 1 from public.products where id=new.product_id and status='published')
  and public.has_admin_role(auth.uid(),array['owner','staff']::public.admin_role[]) is not true then
  raise exception 'Produit indisponible';
 end if;
 if exists(select 1 from public.reviews r where r.product_id is not distinct from new.product_id
  and lower(trim(r.customer_name))=lower(trim(new.customer_name)) and trim(r.comment)=trim(new.comment)
  and r.created_at>now()-interval '24 hours') then
  raise exception 'Cet avis a déjà été envoyé. Merci de patienter.' using errcode='check_violation';
 end if;
 new.customer_name:=trim(new.customer_name);new.comment:=trim(new.comment);new.is_approved:=false;
 return new;
end $$;
revoke all on function public.validate_review() from public,anon,authenticated;

create function public.admin_setup_audit() returns jsonb
language plpgsql stable security definer set search_path='' as $$
begin
 if public.has_admin_role(auth.uid(),array['owner','staff']::public.admin_role[]) is not true then
  raise exception 'Admin only' using errcode='insufficient_privilege';
 end if;
 return jsonb_build_object(
  'published',(select count(*) from public.products where status='published'),
  'missingVariants',(select count(*) from public.products p where p.status='published'
   and not exists(select 1 from public.product_variants v where v.product_id=p.id and v.is_active)),
  'invalidPrices',(select count(*) from public.products p join public.product_variants v on v.product_id=p.id
   where p.status='published' and v.is_active and v.price<=0),
  'missingPhotos',(select count(*) from public.products p where p.status='published' and not exists(
   select 1 from public.product_variants v join public.variant_images i on i.variant_id=v.id where v.product_id=p.id and v.is_active)),
  'demoContent',(select count(distinct p.id) from public.products p left join public.product_variants v on v.product_id=p.id
   left join public.variant_images i on i.variant_id=v.id where p.status='published'
   and (p.slug~'(^|[-_])demo([-_]|$)' or i.url~'(/demo/|picsum\.photos|placehold\.co)')),
  'deliveryReady',exists(select 1 from public.delivery_zones z join public.store_settings s
   on z.wilaya=any(s.delivery_wilayas) where s.id=1 and z.is_active and z.fee>=0),
  'checkoutReady',(select accepts_cod and cardinality(delivery_wilayas)>0 from public.store_settings where id=1)
 );
end $$;
revoke all on function public.admin_setup_audit() from public,anon;
grant execute on function public.admin_setup_audit() to authenticated;
notify pgrst,'reload schema';
