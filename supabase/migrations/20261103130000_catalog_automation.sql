-- Additive catalogue tools. No product backfill, order writes or Finance changes.
create schema catalog_private;
revoke all on schema catalog_private from public, anon, authenticated;
create table catalog_private.requests(id uuid primary key, payload jsonb not null, product_id uuid not null);
-- A separate unique claim preserves legacy duplicate SKUs without rewriting them.
create table catalog_private.sku_claims(sku text primary key, variant_id uuid not null
 references public.product_variants(id) on delete cascade deferrable initially deferred);
insert into catalog_private.sku_claims select distinct on (sku) sku,id
 from public.product_variants where nullif(trim(sku),'') is not null order by sku,id;

create function catalog_private.require_admin() returns void language plpgsql set search_path='' as $$
begin
 if public.has_admin_role(auth.uid(),array['owner','staff']::public.admin_role[]) is not true then
  raise exception 'Session administrateur requise.' using errcode='42501';
 end if;
end;
$$;
create function catalog_private.token(value text, fallback text) returns text language sql immutable set search_path='' as $$
 select coalesce(nullif(trim(both '-' from regexp_replace(upper(translate(replace(replace(replace(replace(coalesce(value,''),'œ','oe'),'Œ','OE'),'æ','ae'),'Æ','AE'),
 'àáâãäåèéêëìíîïòóôõöùúûüýÿçñÀÁÂÃÄÅÈÉÊËÌÍÎÏÒÓÔÕÖÙÚÛÜÝŸÇÑ',
 'aaaaaaeeeeiiiiooooouuuuyycnAAAAAAEEEEIIIIOOOOOUUUUYYCN')),'[^A-Z0-9]+','-','g')),''),fallback);
$$;
create function catalog_private.sku_base(model text, set_type text, size text, colour text) returns text language sql immutable set search_path='' as $$
 select trim(trailing '-' from left('ELG-'||trim(trailing '-' from left(catalog_private.token(model,'MODELE'),14))||'-'||
 case set_type when 'Parure housse de couette' then 'HC' when 'Parure de drap' then 'DR' else trim(trailing '-' from left(catalog_private.token(set_type,'SET'),5)) end||'-'||
 case size when 'Queen size' then 'QN' when 'King size' then 'KG' else trim(trailing '-' from left(catalog_private.token(size,'TAILLE'),8)) end||'-'||trim(trailing '-' from left(catalog_private.token(colour,'UNI'),6)),36));
$$;
create function catalog_private.claim_sku() returns trigger language plpgsql security definer set search_path='' as $$
declare automatic boolean:=nullif(trim(new.sku),'') is null or coalesce(current_setting('catalog.auto_sku',true),'')='true'; base text; candidate text; n integer:=1; claimed uuid; model text; suffix text;
begin
 if tg_op='UPDATE' and new.sku is not distinct from old.sku then return new; end if;
 if automatic then
  select coalesce(nullif(name_fr,''),slug) into model from public.products where id=new.product_id;
  base:=coalesce(nullif(trim(new.sku),''),catalog_private.sku_base(model,new.set_type,new.size,new.color_name));
 else
  base:=trim(new.sku);
 end if;
 if length(base)>40 or base!~'^[A-Z0-9]+(-[A-Z0-9]+)*$' then
  raise exception 'SKU invalide : 40 caractères maximum, lettres majuscules, chiffres et tirets.';
 end if;
 candidate:=base;
 loop
  claimed:=null;
  if not exists(select 1 from public.product_variants where sku=candidate and id<>new.id) then
  insert into catalog_private.sku_claims(sku,variant_id) values(candidate,new.id)
   on conflict(sku) do update set variant_id=excluded.variant_id
   where catalog_private.sku_claims.variant_id=excluded.variant_id returning variant_id into claimed;
  end if;
  exit when claimed is not null;
  if not automatic then raise exception 'Ce SKU existe déjà. Choisis un autre SKU.' using errcode='23505'; end if;
  n:=n+1;
  suffix:='-'||lpad(n::text,greatest(2,length(n::text)),'0');
  candidate:=left(base,40-length(suffix))||suffix;
 end loop;
 if tg_op='UPDATE' then delete from catalog_private.sku_claims where variant_id=new.id and sku<>candidate; end if;
 new.sku:=candidate;
 return new;
end;
$$;
create trigger catalog_variant_sku before insert or update of sku on public.product_variants
 for each row execute function catalog_private.claim_sku();

create table public.catalog_bedding_presets(id uuid primary key, value jsonb not null check(jsonb_typeof(value)='object'));
create unique index catalog_preset_size_type on public.catalog_bedding_presets((value->>'size'),(value->>'set_type'));
alter table public.catalog_bedding_presets enable row level security;
revoke all on public.catalog_bedding_presets from public,anon,authenticated;
create function public.catalog_presets(p jsonb default null) returns jsonb language plpgsql security definer set search_path='' as $$
declare result jsonb; key text;
begin
 perform catalog_private.require_admin();
 if p is not null then
  p:=jsonb_strip_nulls(p);
  p:=jsonb_set(jsonb_set(p,'{size}',to_jsonb(trim(p->>'size'))),'{set_type}',to_jsonb(trim(p->>'set_type')));
  if nullif(trim(p->>'name'),'') is null or nullif(trim(p->>'size'),'') is null or nullif(trim(p->>'set_type'),'') is null then
   raise exception 'Indique le nom, la taille et le type du preset.';
  end if;
  for key in select jsonb_object_keys(p) loop
   if key not in ('id','name','size','set_type','piece_count','composition','fitted_sheet_size','flat_sheet_size','duvet_cover_size','weight_grams')
    or jsonb_typeof(p->key)<>'string' or length(p->>key)>220 then raise exception 'Champ de preset invalide.'; end if;
  end loop;
  if nullif(p->>'piece_count','') is not null and (p->>'piece_count')::integer<1 then raise exception 'Nombre de pièces invalide.'; end if;
  if nullif(p->>'weight_grams','') is not null and (p->>'weight_grams')::integer<0 then raise exception 'Poids invalide.'; end if;
  insert into public.catalog_bedding_presets values((p->>'id')::uuid,p)
   on conflict(id) do update set value=excluded.value;
 end if;
 select coalesce(jsonb_agg(value order by value->>'name'),'[]') into result from public.catalog_bedding_presets;
 return result;
end;
$$;
revoke all on function public.catalog_presets(jsonb) from public,anon;
grant execute on function public.catalog_presets(jsonb) to authenticated;

-- One transaction for the model, categories and configurations; retry is idempotent.
create function public.catalog_generate(p jsonb) returns uuid language plpgsql security definer set search_path='' as $$
declare pid uuid; request uuid:=(p->>'request_id')::uuid; previous catalog_private.requests%rowtype; x jsonb; v public.product_variants; position integer; vid uuid;
begin
 perform catalog_private.require_admin();
 if request is null then raise exception 'Identifiant de requête manquant.'; end if;
 perform pg_advisory_xact_lock(hashtextextended(request::text,0));
 select * into previous from catalog_private.requests where id=request;
 if found then
  if previous.payload<>p then raise exception 'Cette requête a déjà été utilisée.'; end if;
  return previous.product_id;
 end if;
 if jsonb_typeof(p->'variants') is distinct from 'array' or jsonb_array_length(p->'variants') not between 0 and 100 then
  raise exception 'Choisis au maximum 100 configurations.';
 end if;
 pid:=(p->>'product_id')::uuid;
 if pid is null then
  if nullif(trim(p->'model'->>'name'),'') is null then raise exception 'Indique le nom du modèle.'; end if;
  insert into public.products(name,name_fr,slug,description,description_fr,kind,status)
   values(trim(p->'model'->>'name'),nullif(trim(p->'model'->>'name_fr'),''),p->'model'->>'slug',
    nullif(p->'model'->>'description',''),nullif(p->'model'->>'description_fr',''),'single','draft') returning id into pid;
  insert into public.product_categories(product_id,category_id,sort_order)
   select pid,value::uuid,(ordinality-1)::integer from jsonb_array_elements_text(p->'model'->'category_ids') with ordinality;
  update public.products set category_id=(p->'model'->'category_ids'->>0)::uuid where id=pid;
 else
  perform 1 from public.products where id=pid for update;
  if not found then raise exception 'Modèle introuvable.'; end if;
 end if;
 select coalesce(max(sort_order)+1,0) into position from public.product_variants where product_id=pid;
 for x in select value from jsonb_array_elements(p->'variants') loop
  v:=jsonb_populate_record(null::public.product_variants,x);
  if v.price is null or v.price<=0 or v.stock is null or v.stock<0 then raise exception 'Prix ou stock invalide.'; end if;
  perform set_config('catalog.auto_sku',coalesce(x->>'automatic_sku','false'),true);
  insert into public.product_variants(product_id,size,color_name,color_hex,sku,price,compare_at_price,stock,weight_grams,
   fabric,fabric_origin,set_type,piece_count,composition,flat_sheet_size,fitted_sheet_size,duvet_cover_size,sort_order,is_active)
   values(pid,v.size,v.color_name,v.color_hex,v.sku,v.price,v.compare_at_price,v.stock,v.weight_grams,v.fabric,v.fabric_origin,
    v.set_type,v.piece_count,v.composition,v.flat_sheet_size,v.fitted_sheet_size,v.duvet_cover_size,position,true) returning id into vid;
  insert into public.variant_images(variant_id,url,alt,sort_order)
   select vid,url,alt,sort_order from (select distinct on (i.url) i.url,i.alt,i.sort_order
    from public.variant_images i join public.product_variants src on src.id=i.variant_id
    where src.product_id=pid and src.id<>vid and src.color_name is not distinct from v.color_name
    order by i.url,i.sort_order) photos;
  perform set_config('catalog.auto_sku','false',true);
  position:=position+1;
 end loop;
 insert into catalog_private.requests values(request,p,pid);
 return pid;
end;
$$;
revoke all on function public.catalog_generate(jsonb) from public,anon;
grant execute on function public.catalog_generate(jsonb) to authenticated;

create function public.catalog_apply_common(p_product uuid,p_patch jsonb) returns integer language plpgsql security definer set search_path='' as $$
declare key text; affected integer;
begin
 perform catalog_private.require_admin();
 if jsonb_typeof(p_patch) is distinct from 'object' or p_patch='{}' then raise exception 'Choisis un champ à appliquer.'; end if;
 for key in select jsonb_object_keys(p_patch) loop
  if key not in ('fabric','fabric_origin','set_type','price','compare_at_price','weight_grams','composition') then
   raise exception 'Ce champ ne peut pas être appliqué en masse.';
  end if;
 end loop;
 if p_patch?'price' and ((p_patch->>'price')::integer is null or (p_patch->>'price')::integer<=0) then raise exception 'Le prix doit être positif.'; end if;
 update public.product_variants set
  fabric=case when p_patch?'fabric' then p_patch->>'fabric' else fabric end,
  fabric_origin=case when p_patch?'fabric_origin' then p_patch->>'fabric_origin' else fabric_origin end,
  set_type=case when p_patch?'set_type' then p_patch->>'set_type' else set_type end,
  price=case when p_patch?'price' then (p_patch->>'price')::integer else price end,
  compare_at_price=case when p_patch?'compare_at_price' then (p_patch->>'compare_at_price')::integer else compare_at_price end,
  weight_grams=case when p_patch?'weight_grams' then (p_patch->>'weight_grams')::integer else weight_grams end,
  composition=case when p_patch?'composition' then p_patch->>'composition' else composition end
 where product_id=p_product;
 get diagnostics affected=row_count;
 return affected;
end;
$$;
revoke all on function public.catalog_apply_common(uuid,jsonb) from public,anon;
grant execute on function public.catalog_apply_common(uuid,jsonb) to authenticated;
revoke all on all functions in schema catalog_private from public,anon,authenticated;
notify pgrst,'reload schema';

-- Persist an ALT only when absent. Existing hand-written text is always retained.
create function catalog_private.image_alt() returns trigger language plpgsql security definer set search_path='' as $$
begin
 if nullif(trim(new.alt),'') is null then
  select concat_ws(' – ',coalesce(nullif(p.name_fr,''),p.name),nullif(trim(v.color_name),''),'Elegancia Home')
   into new.alt from public.product_variants v join public.products p on p.id=v.product_id where v.id=new.variant_id;
 end if;
 return new;
end;
$$;
create trigger catalog_image_alt before insert or update of alt on public.variant_images
 for each row execute function catalog_private.image_alt();
revoke all on function catalog_private.image_alt() from public,anon,authenticated;

create function catalog_private.publication_check() returns trigger language plpgsql set search_path='' as $$
begin
 if new.status='published' and old.status is distinct from new.status and not exists(
  select 1 from public.product_variants where product_id=new.id and is_active and price>0
 ) then raise exception 'Ajoute une configuration active avec un prix avant de publier.'; end if;
 return new;
end;
$$;
create trigger catalog_publication_check before update of status on public.products
 for each row execute function catalog_private.publication_check();
revoke all on function catalog_private.publication_check() from public,anon,authenticated;
