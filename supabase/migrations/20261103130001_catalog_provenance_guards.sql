-- Supplement the undeployed catalogue migration. Finance objects are not touched.
-- Initial values confirmed by the owner. No updates to Serena/Aveline variants.
-- Kept in sync with src/lib/bedding-presets.initial.json by a database test.
insert into public.catalog_bedding_presets(id,value)
select (value->>'id')::uuid,value from jsonb_array_elements($presets$
[
  {
    "id": "e1e9a000-0000-4000-8000-000000000001",
    "name": "Elegancia — Parure de drap — 3 pièces — Queen size",
    "size": "Queen size",
    "set_type": "Parure de drap",
    "piece_count": "3",
    "composition": {
      "state": "known",
      "value": "1 drap plat + 2 taies d’oreiller"
    },
    "flat_sheet_size": {
      "state": "known",
      "value": "250 × 240 cm"
    },
    "fitted_sheet_size": {
      "state": "not_applicable"
    },
    "duvet_cover_size": {
      "state": "not_applicable"
    }
  },
  {
    "id": "e1e9a000-0000-4000-8000-000000000002",
    "name": "Elegancia — Parure de drap — 6 pièces — Queen size",
    "size": "Queen size",
    "set_type": "Parure de drap",
    "piece_count": "6",
    "composition": {
      "state": "known",
      "value": "1 drap plat + 1 drap-housse + 4 taies d’oreiller"
    },
    "flat_sheet_size": {
      "state": "known",
      "value": "250 × 240 cm"
    },
    "fitted_sheet_size": {
      "state": "known",
      "value": "160 × 190 cm"
    },
    "duvet_cover_size": {
      "state": "not_applicable"
    }
  },
  {
    "id": "e1e9a000-0000-4000-8000-000000000003",
    "name": "Elegancia — Parure housse de couette — 3 pièces — Queen size",
    "size": "Queen size",
    "set_type": "Parure housse de couette",
    "piece_count": "3",
    "composition": {
      "state": "known",
      "value": "1 housse de couette + 2 taies d’oreiller"
    },
    "flat_sheet_size": {
      "state": "not_applicable"
    },
    "fitted_sheet_size": {
      "state": "not_applicable"
    },
    "duvet_cover_size": {
      "state": "known",
      "value": "220 × 240 cm"
    }
  },
  {
    "id": "e1e9a000-0000-4000-8000-000000000004",
    "name": "Elegancia — Parure housse de couette — 6 pièces — Queen size",
    "size": "Queen size",
    "set_type": "Parure housse de couette",
    "piece_count": "6",
    "composition": {
      "state": "known",
      "value": "1 housse de couette + 1 drap-housse + 4 taies d’oreiller"
    },
    "flat_sheet_size": {
      "state": "not_applicable"
    },
    "fitted_sheet_size": {
      "state": "known",
      "value": "160 × 190 cm"
    },
    "duvet_cover_size": {
      "state": "known",
      "value": "220 × 240 cm"
    }
  },
  {
    "id": "e1e9a000-0000-4000-8000-000000000005",
    "name": "Elegancia — Parure de drap — 3 pièces — King size",
    "size": "King size",
    "set_type": "Parure de drap",
    "piece_count": "3",
    "composition": {
      "state": "known",
      "value": "1 drap plat + 2 taies d’oreiller"
    },
    "flat_sheet_size": {
      "state": "known",
      "value": "250 × 240 cm"
    },
    "fitted_sheet_size": {
      "state": "not_applicable"
    },
    "duvet_cover_size": {
      "state": "not_applicable"
    }
  },
  {
    "id": "e1e9a000-0000-4000-8000-000000000006",
    "name": "Elegancia — Parure de drap — 6 pièces — King size",
    "size": "King size",
    "set_type": "Parure de drap",
    "piece_count": "6",
    "composition": {
      "state": "known",
      "value": "1 drap plat + 1 drap-housse + 4 taies d’oreiller"
    },
    "flat_sheet_size": {
      "state": "known",
      "value": "250 × 240 cm"
    },
    "fitted_sheet_size": {
      "state": "known",
      "value": "180 × 200 cm"
    },
    "duvet_cover_size": {
      "state": "not_applicable"
    }
  },
  {
    "id": "e1e9a000-0000-4000-8000-000000000007",
    "name": "Elegancia — Parure housse de couette — 3 pièces — King size",
    "size": "King size",
    "set_type": "Parure housse de couette",
    "piece_count": "3",
    "composition": {
      "state": "known",
      "value": "1 housse de couette + 2 taies d’oreiller"
    },
    "flat_sheet_size": {
      "state": "not_applicable"
    },
    "fitted_sheet_size": {
      "state": "not_applicable"
    },
    "duvet_cover_size": {
      "state": "known",
      "value": "260 × 240 cm"
    }
  },
  {
    "id": "e1e9a000-0000-4000-8000-000000000008",
    "name": "Elegancia — Parure housse de couette — 6 pièces — King size",
    "size": "King size",
    "set_type": "Parure housse de couette",
    "piece_count": "6",
    "composition": {
      "state": "known",
      "value": "1 housse de couette + 1 drap-housse + 4 taies d’oreiller"
    },
    "flat_sheet_size": {
      "state": "not_applicable"
    },
    "fitted_sheet_size": {
      "state": "known",
      "value": "180 × 200 cm"
    },
    "duvet_cover_size": {
      "state": "known",
      "value": "260 × 240 cm"
    }
  }
]
$presets$::jsonb);

create function catalog_private.preset_values(bed text,kind text,pieces integer) returns jsonb
language plpgsql stable set search_path='' as $$
declare configured jsonb; result jsonb;
begin
 select value into configured from public.catalog_bedding_presets
  where catalog_private.norm(value->>'size')=catalog_private.norm(bed)
   and catalog_private.norm(value->>'set_type')=catalog_private.norm(kind)
   and (value->>'piece_count')::integer=pieces;
 if found then return configured; end if;
 result:='{"composition":{"state":"unknown"},"flat_sheet_size":{"state":"unknown"},"fitted_sheet_size":{"state":"unknown"},"duvet_cover_size":{"state":"unknown"}}';
 if catalog_private.norm(kind) not in ('parure de drap','parure housse de couette') then return result; end if;
 if pieces=3 then
  result:=jsonb_set(result,'{fitted_sheet_size}','{"state":"not_applicable"}');
 elsif pieces=6 and catalog_private.norm(bed)='90 × 190 cm' then
  result:=jsonb_set(result,'{fitted_sheet_size}','{"state":"known","value":"90 × 190 cm"}');
 end if;
 if catalog_private.norm(kind)='parure de drap' then
  result:=jsonb_set(result,'{duvet_cover_size}','{"state":"not_applicable"}');
 end if;
 return result;
end;
$$;

create function catalog_private.bedding_transition() returns trigger language plpgsql security definer set search_path='' as $$
declare key text; origin jsonb; resolved jsonb;
begin
 if new.bedding_provenance is null then return new; end if;
 if jsonb_typeof(new.bedding_provenance)<>'object' then raise exception 'Provenance invalide.'; end if;
 for key,origin in select * from jsonb_each(new.bedding_provenance) loop
  if key not in ('composition','flat_sheet_size','fitted_sheet_size','duvet_cover_size') or
   coalesce(origin->>'source','') not in ('manual','legacy','preset') or
   (origin->>'source'='preset' and coalesce(origin->>'state','') not in ('known','unknown','not_applicable')) then
   raise exception 'Provenance invalide.';
  end if;
 end loop;
 if tg_op='INSERT' or row(new.size,new.set_type,new.piece_count) is distinct from row(old.size,old.set_type,old.piece_count) then
  resolved:=catalog_private.preset_values(new.size,new.set_type,new.piece_count);
  for key,origin in select * from jsonb_each(new.bedding_provenance) loop
   if origin->>'source'='preset' then
    new:=jsonb_populate_record(new,jsonb_build_object(key,case when resolved->key->>'state'='known' then resolved->key->>'value' else null end));
    new.bedding_provenance:=jsonb_set(new.bedding_provenance,array[key],jsonb_build_object('source','preset','state',resolved->key->>'state'));
   end if;
  end loop;
 end if;
 return new;
end;
$$;
create trigger catalog_variant_bedding before insert or update of size,set_type,piece_count,bedding_provenance on public.product_variants
 for each row execute function catalog_private.bedding_transition();

-- Protect the advanced editor and colour clones as well as catalog_generate.
-- Legacy duplicates are left unchanged when their normalized identity is unchanged.
create function catalog_private.configuration_guard() returns trigger language plpgsql security definer set search_path='' as $$
begin
 if tg_op='UPDATE' and old.product_id=new.product_id and
  catalog_private.configuration_key(to_jsonb(new))=catalog_private.configuration_key(to_jsonb(old)) then return new; end if;
 perform catalog_private.assert_configuration(new.product_id,to_jsonb(new),new.id);
 return new;
end;
$$;
create trigger catalog_variant_configuration before insert or update of product_id,size,set_type,piece_count,color_name,color_hex,fabric,fabric_origin
 on public.product_variants for each row execute function catalog_private.configuration_guard();
revoke all on all functions in schema catalog_private from public,anon,authenticated;
notify pgrst,'reload schema';
