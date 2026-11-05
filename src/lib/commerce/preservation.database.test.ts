// @vitest-environment node
import { afterAll, beforeAll, expect, it } from "vitest";
import { nativeTestDatabase } from "../../../scripts/testing/native-database";
let db: Awaited<ReturnType<typeof nativeTestDatabase>>;
let before: unknown;
const component = "acacacac-0000-4000-8000-000000000001";
const pack = "acacacac-0000-4000-8000-000000000002";
async function snapshot(source: Awaited<ReturnType<typeof nativeTestDatabase>>) {
  return (
    await source.query(`select jsonb_build_object('variants',(select jsonb_agg(to_jsonb(v) order by id) from product_variants v),
    'orders',(select jsonb_agg(to_jsonb(o) order by id) from orders o),
    'items',(select jsonb_agg(to_jsonb(i)-'reserved_components' order by id) from order_items i),
    'settings',(select to_jsonb(s) from store_settings s),
    'rates',(select jsonb_agg(to_jsonb(z) order by wilaya) from delivery_zones z),
    'finance',(select to_jsonb(f) from finance_settings f)) data`)
  ).rows;
}
beforeAll(async () => {
  db = await nativeTestDatabase(undefined, async (source) => {
    await source.exec(`update store_settings set accepts_cod=true,delivery_wilayas=array['Alger'] where id=1;
      insert into delivery_zones(wilaya,fee,is_active) values('Alger',600,true) on conflict(wilaya) do update set fee=600,is_active=true;
      insert into products(id,slug,name,status,kind) values('${component}','historic-component','Historique','published','single'),('${pack}','historic-pack','Ancien pack','published','pack');
      insert into product_variants(id,product_id,price,stock) values('${component}','${component}',1000,5),('${pack}','${pack}',1500,3);
      insert into pack_items(product_id,variant_id,quantity) values('${pack}','${component}',2);`);
    await source.query("select place_order($1::jsonb,$2::jsonb)", [
      JSON.stringify({
        customer_name: "Historique fictive",
        phone: "0555123456",
        wilaya: "Alger",
        commune: "Alger Centre",
        address: "Adresse fictive historique",
      }),
      JSON.stringify([{ variant_id: pack, quantity: 1 }]),
    ]);
    before = await snapshot(source);
  });
}, 30000);
afterAll(async () => {
  await db?.close();
});
it("préserve exactement stocks, anciennes commandes/lignes, paramètres, tarifs et Finance OFF", async () => {
  expect(await snapshot(db)).toEqual(before);
  expect((await db.query("select reserved_components from order_items")).rows).toEqual([
    { reserved_components: [] },
  ]);
});
it("n'ajoute pas de composants fictivement réservés au retour d'un ancien pack", async () => {
  await db.exec("update orders set status='cancelled'");
  expect((await db.query("select stock from product_variants order by id")).rows).toEqual([
    { stock: 5 },
    { stock: 3 },
  ]);
  expect((await db.query("select enabled from finance_settings")).rows).toEqual([
    { enabled: false },
  ]);
});
