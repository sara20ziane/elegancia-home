// @vitest-environment node
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { nativeTestDatabase } from "../../../scripts/testing/native-database";
import type { Analytics } from "../analytics";

let db: Awaited<ReturnType<typeof nativeTestDatabase>>;
const owner = "cccccccc-0000-4000-8000-000000000001";
const component = "cccccccc-1000-4000-8000-000000000001";
const extra = "cccccccc-1000-4000-8000-000000000002";
const pack = "cccccccc-2000-4000-8000-000000000001";
let legacy: unknown[];
beforeAll(async () => {
  db = await nativeTestDatabase(undefined, async (before) => {
    await before.exec(
      "insert into products(slug,name,status) values('historic-preserve','Historique','published'); insert into product_variants(product_id,price,stock) select id,9500,12 from products where slug='historic-preserve'",
    );
    legacy = (await before.query("select to_jsonb(v) data from product_variants v order by id"))
      .rows;
  });
}, 30000);
afterAll(async () => {
  await db?.close();
});
beforeEach(async () => {
  await db.exec(`begin; insert into auth.users values('${owner}'); insert into admin_users(user_id,role) values('${owner}','owner'); select set_config('request.jwt.claim.sub','${owner}',true);
    update store_settings set accepts_cod=true,delivery_wilayas=array['Alger'] where id=1;
    insert into delivery_zones(wilaya,fee,stopdesk_fee,is_active) values('Alger',600,400,true) on conflict(wilaya) do update set fee=600,stopdesk_fee=400,is_active=true;
    insert into products(id,slug,name,name_fr,status,kind) values('${component}','commerce-single','حَافَة','Drap été','published','single'),('${pack}','commerce-pack','Pack literie','Pack literie','published','pack');
    insert into product_variants(id,product_id,price,stock,size,sku) values('${component}','${component}',1000,6,'Queen','EH-REINE'),('${extra}','${component}',1000,4,'King','EH-ROI'),('${pack}','${pack}',2500,10,'Pack','EH-PACK');
    insert into pack_items(product_id,variant_id,quantity) values('${pack}','${component}',2),('${pack}','${extra}',1);`);
});
afterEach(async () => {
  await db.exec("rollback");
});
async function order(lines = [{ variant_id: pack, quantity: 1 }], phone = "0555123456") {
  const { rows } = await db.query<{ token: string }>(
    "select place_order($1::jsonb,$2::jsonb) token",
    [
      JSON.stringify({
        customer_name: "Cliente fictive",
        phone,
        wilaya: "Alger",
        commune: "Alger Centre",
        address: "Adresse synthétique",
      }),
      JSON.stringify(lines),
    ],
  );
  return (
    await db.query<{ id: string; public_token: string }>(
      "select id,public_token from orders where public_token=$1",
      [rows[0].token],
    )
  ).rows[0];
}
async function stocks() {
  return (
    await db.query<{ stock: number }>(
      "select stock from product_variants where id=any($1::uuid[]) order by id",
      [[component, extra, pack]],
    )
  ).rows.map((r) => r.stock);
}
async function status(id: string, value: string) {
  await db.query("update orders set status=$2::order_status where id=$1", [id, value]);
}

it("ne modifie aucun stock, prix, SKU historique ni Finance OFF pendant la migration", async () => {
  expect(
    (
      await db.query(
        "select to_jsonb(v) data from product_variants v join products p on p.id=v.product_id where p.slug='historic-preserve' order by v.id",
      )
    ).rows,
  ).toEqual(legacy);
  expect((await db.query("select enabled from finance_settings")).rows).toEqual([
    { enabled: false },
  ]);
});
describe("packs transactionnels", () => {
  it("réserve les composants une seule fois, conserve prix global et cap du pack", async () => {
    const placed = await order([{ variant_id: pack, quantity: 2 }]);
    expect(await stocks()).toEqual([2, 2, 8]);
    expect(
      (await db.query("select subtotal,total from orders where id=$1", [placed.id])).rows,
    ).toEqual([{ subtotal: 5000, total: 5600 }]);
    await status(placed.id, "confirmed");
    expect(await stocks()).toEqual([2, 2, 8]);
    await db.query("update pack_items set quantity=3 where product_id=$1 and variant_id=$2", [
      pack,
      component,
    ]);
    await status(placed.id, "cancelled");
    expect(await stocks()).toEqual([6, 4, 10]);
    await status(placed.id, "refused");
    await status(placed.id, "returned");
    expect(await stocks()).toEqual([6, 4, 10]);
    await status(placed.id, "confirmed");
    expect(await stocks()).toEqual([2, 2, 8]);
    await status(placed.id, "returned");
    expect(await stocks()).toEqual([6, 4, 10]);
  });
  it("refuse la survente et annule tous les débits si un composant manque", async () => {
    await db.exec("savepoint oversell");
    await expect(order([{ variant_id: pack, quantity: 4 }])).rejects.toThrow(/Composant/);
    await db.exec("rollback to oversell");
    expect(await stocks()).toEqual([6, 4, 10]);
    expect((await db.query("select count(*)::int n from orders")).rows).toEqual([{ n: 0 }]);
  });
  it("agrège les lignes répétées et composants partagés au retour", async () => {
    const placed = await order([
      { variant_id: pack, quantity: 1 },
      { variant_id: pack, quantity: 1 },
      { variant_id: component, quantity: 1 },
    ]);
    expect(await stocks()).toEqual([1, 2, 8]);
    await status(placed.id, "returned");
    expect(await stocks()).toEqual([6, 4, 10]);
  });
  it("restitue les composants à l'expiration pending, jamais après confirmation", async () => {
    const a = await order();
    const b = await order();
    await status(b.id, "confirmed");
    await db.exec("update orders set created_at=now()-interval '25 hours'");
    await db.query("select expire_stale_pending_orders()");
    expect(await stocks()).toEqual([4, 3, 9]);
    await db.query("select expire_stale_pending_orders()");
    expect(await stocks()).toEqual([4, 3, 9]);
    expect((await db.query("select status from orders where id=$1", [a.id])).rows[0]).toEqual({
      status: "cancelled",
    });
  });
  it("supprime uniquement une commande admissible et restitue exactement sa réservation", async () => {
    const placed = await order();
    await db.query("select delete_elegancia_order($1,$2)", [placed.id, placed.public_token]);
    expect(await stocks()).toEqual([6, 4, 10]);
    const refused = await order();
    await status(refused.id, "refused");
    await db.query("select delete_elegancia_order($1,$2)", [refused.id, refused.public_token]);
    expect(await stocks()).toEqual([6, 4, 10]);
  });
  it("ne vend ni pack vide, imbriqué, ni composant brouillon", async () => {
    await db.exec("savepoint expected_failure");
    await expect(
      db.query("insert into pack_items(product_id,variant_id,quantity) values($1,$1,1)", [pack]),
    ).rejects.toThrow(/produits simples/);
    await db.exec("rollback to expected_failure");
    await db.query("update products set status='draft' where id=$1", [component]);
    await db.exec("set local role anon");
    expect((await db.query("select * from pack_availability($1)", [pack])).rows).toEqual([
      { variant_id: pack, stock: 0 },
    ]);
    await db.exec("reset role; savepoint unavailable");
    await expect(order()).rejects.toThrow(/Composant/);
    await db.exec("rollback to unavailable");
  });
});
it("sépare les statuts, corrige le panier moyen et exclut les petits échantillons du classement", async () => {
  const states = [
    "pending",
    "confirmed",
    "shipped",
    "delivered",
    "refused",
    "returned",
    "cancelled",
  ];
  for (const [i, state] of states.entries()) {
    await db.query("update product_variants set stock=100 where id=$1", [component]);
    const placed = await order(
      [{ variant_id: component, quantity: 1 }],
      `05551234${String(i).padStart(2, "0")}`,
    );
    if (state !== "pending") await status(placed.id, state);
  }
  const data = (await db.query<{ data: Analytics }>("select admin_commerce_analytics(30,3) data"))
    .rows[0].data;
  expect(data.totals).toMatchObject({
    orders: 7,
    confirmedOrders: 3,
    confirmedValue: 4800,
    deliveredValue: 1600,
    refused: 1,
    returned: 1,
    cancelled: 1,
  });
  expect(data.byWilaya[0]).toMatchObject({
    eligible: true,
    refusedValue: 1600,
    refused: 1,
    returned: 1,
  });
  expect(data.cashReceived).toBeNull();
  expect(
    (await db.query<{ data: Analytics }>("select admin_commerce_analytics(30,8) data")).rows[0].data
      .byWilaya[0].eligible,
  ).toBe(false);
});
it("normalise l'arabe sans perdre le français, les références ou modifier les noms", async () => {
  expect((await db.query("select normalize_arabic('أ إ آ ا ى ي ة ه ـ بَ') s")).rows).toEqual([
    { s: "ا ا ا ا ي ي ه ه ب" },
  ]);
  for (const query of ["حافه", "حافة", "été", "EH-REINE"]) {
    const result = (
      await db.query<{ data: { total: number } }>("select catalogue_page(p_query:=$1) data", [
        query,
      ])
    ).rows[0].data;
    expect(result.total, query).toBe(1);
  }
  expect((await db.query("select name from products where id=$1", [component])).rows[0]).toEqual({
    name: "حَافَة",
  });
});
it("normalise les téléphones et conserve un historique administratif distinct", async () => {
  const placed = await order();
  await status(placed.id, "returned");
  const refused = await order(undefined, "+213555123456");
  await status(refused.id, "refused");
  const confirmed = await order(undefined, "00213555123456");
  await status(confirmed.id, "confirmed");
  const history = (
    await db.query(
      "select * from admin_commerce_phone_history(array['0555123456','+213555123456','00213555123456'])",
    )
  ).rows;
  expect(history).toEqual([
    {
      phone: "0555123456",
      orders: 3,
      confirmed: 1,
      refused: 1,
      returned: 1,
      delivered: 0,
      pending: 0,
      blocked: false,
    },
  ]);
  expect((await db.query("select count(*)::int n from blocked_phones")).rows).toEqual([{ n: 0 }]);
});
