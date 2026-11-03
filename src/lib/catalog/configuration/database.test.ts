// @vitest-environment node
import { beforeAll, afterAll, expect, it } from "vitest";
import { nativeTestDatabase } from "../../../../scripts/testing/native-database";
import { INITIAL_BEDDING_PRESETS, presetValues } from "../../bedding-presets";
import { newProvenance } from "../../bedding-provenance";
import { configurationKey } from "../../catalog-configuration-key";
import type { Json } from "../../supabase/types";

let db: Awaited<ReturnType<typeof nativeTestDatabase>>;
const owner = "bbbbbbbb-1111-4111-8111-111111111111";
const base = {
  size: "Queen size",
  set_type: "Parure housse de couette",
  piece_count: 6,
  fabric: "Coton",
  color_name: "Écru",
  price: 9500,
  stock: 3,
};
let legacy: unknown[];
beforeAll(async () => {
  db = await nativeTestDatabase(async (before) => {
    await before.exec(
      "insert into products(id,slug,name,status) values('dddddddd-1111-4111-8111-111111111111','legacy-catalog','Legacy fixture','published'); insert into product_variants(product_id,price,stock,sku,composition,fitted_sheet_size) values('dddddddd-1111-4111-8111-111111111111',9500,10,'ANCIEN','drap housse','dimension ancienne')",
    );
    legacy = (await before.query("select to_jsonb(v) data from product_variants v order by id"))
      .rows;
  });
  await db.exec(
    `insert into auth.users values('${owner}'); insert into admin_users(user_id,role) values('${owner}','owner'); set role authenticated; select set_config('request.jwt.claim.sub','${owner}',false)`,
  );
}, 30000);
afterAll(async () => {
  await db?.close();
});
function payload(variants: Record<string, Json>[] = [base], productId?: string) {
  return {
    request_id: crypto.randomUUID(),
    product_id: productId,
    model: {
      name: "أفلين",
      name_fr: "Aveline",
      slug: `fixture-${crypto.randomUUID()}`,
      category_ids: [],
    },
    variants,
  };
}
async function generate(value: ReturnType<typeof payload>) {
  return (
    await db.query<{ id: string }>("select catalog_generate($1::jsonb) id", [JSON.stringify(value)])
  ).rows[0].id;
}
it("installe les huit presets vérifiés sans normaliser ni modifier les variantes anciennes", async () => {
  const saved = (
    await db.query<{ data: typeof INITIAL_BEDDING_PRESETS }>("select catalog_presets() data")
  ).rows[0].data;
  expect(saved.sort((a, b) => a.id.localeCompare(b.id))).toEqual(
    [...INITIAL_BEDDING_PRESETS].sort((a, b) => a.id.localeCompare(b.id)),
  );
  expect(
    (
      await db.query(
        "select to_jsonb(v)-'bedding_provenance' data from product_variants v order by id",
      )
    ).rows,
  ).toEqual(legacy);
  expect(
    (await db.query("select bedding_provenance from product_variants where sku='ANCIEN'")).rows,
  ).toEqual([{ bedding_provenance: null }]);
});
it("synchronise les états connus/inconnus/non applicables entre TypeScript et PostgreSQL", async () => {
  await db.exec("reset role");
  for (const size of ["Queen size", "King size", "90 × 190 cm", "Autre taille"])
    for (const type of ["Parure de drap", "Parure housse de couette"])
      for (const pieces of ["3", "6"]) {
        const result = (
          await db.query<{ data: Record<string, Json> }>(
            "select catalog_private.preset_values($1,$2,$3) data",
            [size, type, Number(pieces)],
          )
        ).rows[0].data;
        const expected = presetValues(size, type, pieces);
        for (const key of [
          "composition",
          "flat_sheet_size",
          "fitted_sheet_size",
          "duvet_cover_size",
        ] as const)
          expect(result[key]).toEqual(expected[key]);
      }
  await db.exec("set role authenticated");
});
it("conserve les règles 3/6 distinctes et refuse prix, poids, stock, tissu ou origine dans un preset", async () => {
  const rows = (
    await db.query<{ data: typeof INITIAL_BEDDING_PRESETS }>("select catalog_presets() data")
  ).rows[0].data;
  expect(
    rows
      .filter((preset) => preset.size === "Queen size" && preset.set_type === "Parure de drap")
      .map((preset) => preset.piece_count)
      .sort(),
  ).toEqual(["3", "6"]);
  for (const field of ["price", "stock", "weight_grams", "fabric", "fabric_origin"])
    await expect(
      db.query("select catalog_presets($1::jsonb)", [
        JSON.stringify({ ...rows[0], [field]: "10" }),
      ]),
    ).rejects.toThrow(/Champ de preset/);
  await expect(
    db.query("select catalog_presets($1::jsonb)", [
      JSON.stringify({
        ...rows[0],
        id: crypto.randomUUID(),
        size: ` ${rows[0].size.toUpperCase()} `,
        piece_count: `0${rows[0].piece_count}`,
      }),
    ]),
  ).rejects.toThrow(/catalog_preset_size_type_pieces/);
});
it("refuse un doublon commercial même avec SKU, prix, stock et dimensions différents", async () => {
  const id = await generate(payload());
  const before = (await db.query("select * from product_variants where product_id=$1", [id])).rows;
  await expect(
    generate(
      payload(
        [
          {
            ...base,
            size: " QUEEN  SIZE ",
            set_type: "PARURE HOUSSE DE COUETTE",
            fabric: " coton ",
            color_name: "écru",
            price: 12345,
            stock: 9,
            sku: "DIFFERENT-02",
            fitted_sheet_size: "autre",
          },
        ],
        id,
      ),
    ),
  ).rejects.toThrow(/configuration commerciale/);
  expect((await db.query("select * from product_variants where product_id=$1", [id])).rows).toEqual(
    before,
  );
  // The advanced editor uses the same transaction lock/guard.
  await expect(
    db.query(
      "insert into product_variants(product_id,size,set_type,piece_count,fabric,color_name,price,stock) values($1,'Queen size','Parure housse de couette',6,'Coton','Écru',11000,3)",
      [id],
    ),
  ).rejects.toThrow(/configuration commerciale/);
});
it("annule tout le lot si une ligne est dupliquée et autorise les vraies différences commerciales", async () => {
  const id = await generate(payload());
  await expect(generate(payload([{ ...base, size: "King size" }, base], id))).rejects.toThrow(
    /configuration commerciale/,
  );
  expect(
    (await db.query("select count(*)::int n from product_variants where product_id=$1", [id])).rows,
  ).toEqual([{ n: 1 }]);
  const failed = payload([base, { ...base, sku: "DIFFERENT-02" }]);
  await expect(generate(failed)).rejects.toThrow(/configuration commerciale/);
  expect(
    (await db.query("select id from products where slug=$1", [failed.model.slug])).rows,
  ).toEqual([]);
  await generate(
    payload(
      [
        { ...base, size: "King size" },
        { ...base, piece_count: 3 },
        { ...base, color_name: "Bleu" },
        { ...base, fabric: "Percale" },
      ],
      id,
    ),
  );
  expect(
    (await db.query("select count(*)::int n from product_variants where product_id=$1", [id])).rows,
  ).toEqual([{ n: 5 }]);
});
it("persiste la provenance et recalcule les champs automatiques, en préservant les vrais champs manuels", async () => {
  const id = await generate(payload([{ ...base, bedding_provenance: newProvenance() }]));
  const vid = (
    await db.query<{ id: string }>("select id from product_variants where product_id=$1", [id])
  ).rows[0].id;
  await db.query("update product_variants set size='King size' where id=$1", [vid]);
  expect(
    (
      await db.query(
        "select fitted_sheet_size,duvet_cover_size from product_variants where id=$1",
        [vid],
      )
    ).rows,
  ).toEqual([{ fitted_sheet_size: "180 × 200 cm", duvet_cover_size: "260 × 240 cm" }]);
  await db.query(
    "update product_variants set bedding_provenance=jsonb_set(bedding_provenance,'{fitted_sheet_size}','{\"source\":\"manual\"}') where id=$1",
    [vid],
  );
  await db.query(
    "update product_variants set size='Queen size',set_type='Parure de drap',piece_count=3 where id=$1",
    [vid],
  );
  expect(
    (
      await db.query(
        "select fitted_sheet_size,duvet_cover_size,composition from product_variants where id=$1",
        [vid],
      )
    ).rows,
  ).toEqual([
    {
      fitted_sheet_size: "180 × 200 cm",
      duvet_cover_size: null,
      composition: "1 drap plat + 2 taies d’oreiller",
    },
  ]);
  await db.query("update product_variants set size='Autre taille' where id=$1", [vid]);
  expect(
    (
      await db.query("select fitted_sheet_size,flat_sheet_size from product_variants where id=$1", [
        vid,
      ])
    ).rows,
  ).toEqual([{ fitted_sheet_size: "180 × 200 cm", flat_sheet_size: null }]);
});
it("utilise la même clé normalisée en PostgreSQL et dans l’aperçu", async () => {
  await db.exec("reset role");
  const value = {
    ...base,
    size: " QUEEN\u00a0 SIZE ",
    piece_count: " 03 ",
    color_name: "écru",
    fabric: " COTON ",
  };
  expect(
    (
      await db.query<{ data: unknown }>(
        "select catalog_private.configuration_key($1::jsonb) data",
        [JSON.stringify(value)],
      )
    ).rows[0].data,
  ).toEqual(JSON.parse(configurationKey(value)));
  await db.exec("set role authenticated");
});
