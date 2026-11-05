// @vitest-environment node
import { afterAll, beforeAll, expect, it } from "vitest";
import { nativeTestDatabase } from "../../../scripts/testing/native-database";
import type { CataloguePage } from "../catalogue";
let db: Awaited<ReturnType<typeof nativeTestDatabase>>;
let legacyAnalytics: string;
const product = "edededed-0000-4000-8000-000000000001";
const variant = "edededed-0000-4000-8000-000000000002";
const pack = "edededed-0000-4000-8000-000000000003";
beforeAll(async () => {
  db = await nativeTestDatabase(undefined, async (before) => {
    legacyAnalytics = (
      await before.query<{ definition: string }>(
        "select pg_get_functiondef('public.admin_analytics(integer)'::regprocedure) definition",
      )
    ).rows[0].definition;
  });
  await db.exec(`insert into categories(slug,name,is_active) values('primary-fixture','Primary',true),('secondary-fixture','Secondary',true);
    insert into products(id,slug,name,name_fr,status,category_id,kind) values
    ('${product}','bedding-compatibility','بارور','Parure test','published',(select id from categories where slug='primary-fixture'),'single'),
    ('${pack}','pack-compatibility','Pack','Pack test','published',(select id from categories where slug='primary-fixture'),'pack');
    insert into product_categories(product_id,category_id) select p.id,c.id from products p cross join categories c where p.id in ('${product}','${pack}') and c.slug='secondary-fixture';
    insert into product_variants(id,product_id,price,stock,size,sku,fabric,fabric_origin,set_type,piece_count,composition,flat_sheet_size,fitted_sheet_size,duvet_cover_size)
    values('${variant}','${product}',9500,5,'Queen size','EH-COMPAT','Coton','Turquie','Parure housse de couette',6,'Housse + drap + taies','240 × 280','160 × 190','220 × 240');
    insert into product_variants(id,product_id,price,stock,size) values('${pack}','${pack}',17000,10,'Queen size');
    insert into pack_items(product_id,variant_id,quantity) values('${pack}','${variant}',2);`);
}, 30000);
afterAll(async () => {
  await db?.close();
});
async function catalogue(args = {}) {
  const { rows } = await db.query<{ data: CataloguePage }>(
    "select catalogue_page(p_category_slug:='secondary-fixture',p_in_stock:=$1,p_query:=$2) data",
    [(args as { inStock?: boolean }).inStock ?? false, (args as { query?: string }).query ?? null],
  );
  return rows[0].data;
}
it("préserve le RPC du dashboard déjà déployé sans changement de définition", async () => {
  expect(
    (
      await db.query<{ definition: string }>(
        "select pg_get_functiondef('public.admin_analytics(integer)'::regprocedure) definition",
      )
    ).rows[0].definition,
  ).toBe(legacyAnalytics);
});
it("retrouve les produits par leur catégorie secondaire et conserve tous les champs literie", async () => {
  const result = await catalogue({ query: "EH-COMPAT" });
  expect(result.total).toBe(1);
  expect(result.products[0].product_variants[0]).toMatchObject({
    fabric: "Coton",
    fabric_origin: "Turquie",
    set_type: "Parure housse de couette",
    piece_count: 6,
    composition: "Housse + drap + taies",
    flat_sheet_size: "240 × 280",
    fitted_sheet_size: "160 × 190",
    duvet_cover_size: "220 × 240",
  });
});
it("conserve le filtrage des packs par catégorie secondaire avec leur stock réel de composants", async () => {
  const initial = await catalogue({ inStock: true, query: "pack-compatibility" });
  expect(initial.total).toBe(1);
  expect(initial.products[0].product_variants[0].stock).toBe(2);
  await db.query("update product_variants set stock=0 where id=$1", [variant]);
  expect((await catalogue({ inStock: true, query: "pack-compatibility" })).total).toBe(0);
});

it("préserve aussi Finance déjà activée avant les migrations", async () => {
  const active = await nativeTestDatabase(undefined, async (before) => {
    await before.exec("update finance_settings set enabled=true where id=1");
  });
  try {
    expect((await active.query("select enabled from finance_settings where id=1")).rows).toEqual([
      { enabled: true },
    ]);
  } finally {
    await active.close();
  }
}, 30000);
