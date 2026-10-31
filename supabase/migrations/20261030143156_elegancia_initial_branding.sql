delete from public.reviews where id in ('cccccccc-1111-4111-8111-111111111111','cccccccc-2222-4222-8222-222222222222');
delete from public.products where id in ('11111111-1111-4111-8111-111111111111','22222222-2222-4222-8222-222222222222');
delete from public.categories where slug in ('shirts','packs');

update public.store_settings
set name = 'Elegancia Home',
    tagline = 'أناقة وراحة لغرفة نومك',
    tagline_fr = 'L’élégance et le confort jusque dans votre chambre',
    description = 'مفروشات وبياضات منزلية مختارة بعناية لتجمع بين الراحة والأناقة.',
    description_fr = 'Literie et linge de maison sélectionnés pour allier confort, douceur et élégance.',
    brand_color = '#9B8065',
    legal_name = null,
    nif = null,
    rc_number = null,
    phone = null,
    whatsapp = null,
    email = null,
    address = null,
    address_fr = null,
    announcement = null,
    announcement_enabled = false,
    instagram_url = null,
    facebook_url = null,
    tiktok_url = null,
    returns_note = null
where id = 1;

insert into public.categories (slug, name, name_fr, sort_order, is_active) values
('parures-de-lit', 'أطقم السرير', 'Parures de lit', 1, true),
('draps', 'شراشف', 'Draps', 2, true),
('housses-de-couette', 'أغطية اللحاف', 'Housses de couette', 3, true),
('couettes', 'ألحفة', 'Couettes', 4, true),
('oreillers', 'وسائد', 'Oreillers', 5, true),
('protege-matelas', 'واقيات المراتب', 'Protège-matelas', 6, true),
('plaids', 'بطانيات خفيفة', 'Plaids', 7, true),
('linge-de-maison', 'بياضات منزلية', 'Linge de maison', 8, true)
on conflict (slug) do update
set name = excluded.name,
    name_fr = excluded.name_fr,
    sort_order = excluded.sort_order,
    is_active = excluded.is_active;

notify pgrst, 'reload schema';
