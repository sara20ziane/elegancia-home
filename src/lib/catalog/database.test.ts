import { readFile } from "node:fs/promises";
// @vitest-environment node
import { beforeAll, afterAll, expect, it } from "vitest";
import { nativeTestDatabase } from "../../../scripts/testing/native-database";
import { generateSku } from "../sku";
import { INITIAL_BEDDING_PRESETS } from "../bedding-presets";

let db: Awaited<ReturnType<typeof nativeTestDatabase>>;
const owner = "aaaaaaaa-1111-4111-8111-111111111111";
const variant = {
  size: "Queen size",
  set_type: "Parure housse de couette",
  price: 9500,
  stock: 3,
  piece_count: 6,
  color_name: "",
  fabric: "Coton",
  sku: null as string | null,
  fitted_sheet_size: "160 × 190 cm",
  duvet_cover_size: "220 × 240 cm",
};
beforeAll(async () => {
  db = await nativeTestDatabase();
  await db.exec(
    `insert into auth.users values('${owner}'); insert into admin_users(user_id,role) values('${owner}','owner'); update finance_settings set enabled=true; set role authenticated; select set_config('request.jwt.claim.sub','${owner}',false)`,
  );
}, 30000);
afterAll(async () => {
  await db?.close();
});
function input(variants = [variant], productId?: string) {
  return {
    request_id: crypto.randomUUID(),
    product_id: productId,
    model: {
      name: "موديل",
      name_fr: "Aveline Écru",
      slug: `fixture-${crypto.randomUUID()}`,
      category_ids: [],
    },
    variants,
  };
}
async function generate(payload: ReturnType<typeof input>) {
  return (
    await db.query<{ id: string }>("select catalog_generate($1::jsonb) id", [
      JSON.stringify(payload),
    ])
  ).rows[0].id;
}
it("crée Queen/King en brouillon et rejoue une requête sans doublon", async () => {
  const payload = input([variant, { ...variant, size: "King size" }]);
  const id = await generate(payload);
  expect(await generate(payload)).toBe(id);
  const { rows } = await db.query<{ sku: string; status: string }>(
    "select v.sku,p.status from products p join product_variants v on v.product_id=p.id where p.id=$1 order by sort_order",
    [id],
  );
  expect(rows).toEqual([
    { sku: generateSku("Aveline Écru", variant.set_type, variant.size, ""), status: "draft" },
    {
      sku: generateSku("Aveline Écru", variant.set_type, "King size", ""),
      status: "draft",
    },
  ]);
  expect((await db.query("select enabled from finance_settings")).rows).toEqual([
    { enabled: true },
  ]);
});
it("annule modèle et première configuration si la deuxième est invalide", async () => {
  const payload = input([variant, { ...variant, stock: -1 }]);
  await expect(generate(payload)).rejects.toThrow(/stock/i);
  expect(
    (await db.query("select id from products where slug=$1", [payload.model.slug])).rows,
  ).toEqual([]);
});
it("conserve les IDs et coûts Finance lors des ajouts et mises à jour communes", async () => {
  const id = await generate(input());
  const vid = (
    await db.query<{ id: string }>("select id from product_variants where product_id=$1", [id])
  ).rows[0].id;
  await db.query("select finance_set_cost($1,1200,$2)", [vid, crypto.randomUUID()]);
  const before = (await db.query("select * from variant_costs where variant_id=$1", [vid])).rows;
  await generate(input([{ ...variant, size: "King size" }], id));
  await db.query(
    'select catalog_apply_common($1,\'{"fabric":"Percale de coton","price":10000}\')',
    [id],
  );
  expect((await db.query("select * from variant_costs where variant_id=$1", [vid])).rows).toEqual(
    before,
  );
  expect(
    (await db.query("select fabric,price from product_variants where id=$1", [vid])).rows,
  ).toEqual([{ fabric: "Percale de coton", price: 10000 }]);
  expect(
    (await db.query("select count(*)::int n from product_variants where product_id=$1", [id])).rows,
  ).toEqual([{ n: 2 }]);
  for (const table of ["invoices", "financial_movements", "orders"])
    expect((await db.query(`select count(*)::int n from ${table}`)).rows).toEqual([{ n: 0 }]);
});
it("refuse un SKU manuel en double et préserve un ALT manuel", async () => {
  const id = await generate(input([{ ...variant, sku: "ELG-MANUEL" }]));
  await expect(generate(input([{ ...variant, sku: "ELG-MANUEL" }]))).rejects.toThrow(/SKU existe/);
  const vid = (
    await db.query<{ id: string }>("select id from product_variants where product_id=$1", [id])
  ).rows[0].id;
  await db.query(
    "insert into variant_images(variant_id,url,alt) values($1,'/fixture',null),($1,'/manual','ALT manuel')",
    [vid],
  );
  expect(
    (await db.query("select alt from variant_images where variant_id=$1 order by url", [vid])).rows,
  ).toEqual([{ alt: "Aveline Écru – Elegancia Home" }, { alt: "ALT manuel" }]);
  await db.query("update product_variants set size='King size' where id=$1", [vid]);
  expect((await db.query("select sku from product_variants where id=$1", [vid])).rows).toEqual([
    { sku: "ELG-MANUEL" },
  ]);
});
it("bloque la publication sans configuration et valide les presets persistants", async () => {
  const payload = input([]);
  const id = await generate(payload);
  await expect(
    db.query("update products set status='published' where id=$1", [id]),
  ).rejects.toThrow(/configuration active/);
  const preset = {
    id: crypto.randomUUID(),
    name: "Standard confirmé",
    size: "Fixture size",
    set_type: "Parure de drap",
    piece_count: "3",
    composition: { state: "known", value: "Texte propriétaire" },
    flat_sheet_size: { state: "unknown" },
    fitted_sheet_size: { state: "not_applicable" },
    duvet_cover_size: { state: "not_applicable" },
  };
  expect(
    (
      await db.query<{ data: unknown[] }>("select catalog_presets($1::jsonb) data", [
        JSON.stringify(preset),
      ])
    ).rows[0].data,
  ).toEqual([...INITIAL_BEDDING_PRESETS, preset].sort((a, b) => a.name.localeCompare(b.name)));
  await expect(
    db.query("select catalog_presets($1::jsonb)", [
      JSON.stringify({ ...preset, piece_count: "0" }),
    ]),
  ).rejects.toThrow(/pièces/);
});
it("ne réutilise pas un ancien SKU dupliqué après suppression de son premier détenteur", async () => {
  await db.exec("reset role");
  const id = await generate(input());
  // Simulate legacy duplicates that existed before this migration; never applied to production.
  await db.exec(
    "alter table product_variants disable trigger catalog_variant_sku; alter table product_variants disable trigger catalog_variant_configuration",
  );
  await db.query(
    "insert into product_variants(product_id,sku,price,stock) values($1,'LEGACY-DOUBLON',9500,2),($1,'LEGACY-DOUBLON',9500,2)",
    [id],
  );
  await db.exec(
    "alter table product_variants enable trigger catalog_variant_sku; alter table product_variants enable trigger catalog_variant_configuration",
  );
  await db.query(
    "insert into catalog_private.sku_claims select sku,id from product_variants where sku='LEGACY-DOUBLON' limit 1",
  );
  await db.exec(
    "delete from product_variants where id=(select variant_id from catalog_private.sku_claims where sku='LEGACY-DOUBLON')",
  );
  await expect(generate(input([{ ...variant, sku: "LEGACY-DOUBLON" }]))).rejects.toThrow(
    /SKU existe/,
  );
  await db.exec("set role authenticated");
});
it("conserve intégralement les données Finance non vides", async () => {
  await db.exec("reset role");
  await db.exec(await readFile("supabase/tests/catalog-finance-preservation.sql", "utf8"));
  await db.exec("set role authenticated");
});
it("refuse les RPC catalogue aux non administrateurs et protège les presets", async () => {
  await db.exec("reset role; set role anon");
  await expect(db.query("select catalog_generate('{}')")).rejects.toThrow();
  await expect(db.query("select catalog_presets()")).rejects.toThrow();
  await db.exec(
    "reset role; set role authenticated; select set_config('request.jwt.claim.sub','',false)",
  );
  await expect(db.query("select catalog_generate('{}')")).rejects.toThrow(/administrateur/);
  await expect(db.query("select catalog_presets()")).rejects.toThrow(/administrateur/);
});
