// @vitest-environment node
import { afterAll, afterEach, beforeAll, beforeEach, expect, it } from "vitest";
import { nativeTestDatabase } from "../../../scripts/testing/native-database";
let db: Awaited<ReturnType<typeof nativeTestDatabase>>;
const owner = "dededede-0000-4000-8000-000000000001";
const product = "dededede-1000-4000-8000-000000000001";
beforeAll(async () => {
  db = await nativeTestDatabase();
}, 30000);
afterAll(async () => {
  await db?.close();
});
beforeEach(async () => {
  await db.exec(`begin; insert into auth.users values('${owner}'); insert into admin_users(user_id,role) values('${owner}','owner');
    insert into products(id,slug,name,status) values('${product}','reviews-fixture','Fictive','published');
    select set_config('request.jwt.claim.sub','',true);set local role anon;`);
});
afterEach(async () => {
  await db.exec("rollback");
});
async function denied(sql: string, params: unknown[] = []) {
  await db.exec("savepoint denied");
  await expect(db.query(sql, params)).rejects.toThrow();
  await db.exec("rollback to denied");
}
it("force les nouveaux avis en attente, interdit modification/suppression publiques et neutralise les doublons", async () => {
  await db.query(
    "insert into reviews(product_id,customer_name,rating,comment,is_approved) values($1,'Cliente',5,'Superbe literie',true)",
    [product],
  );
  expect((await db.query("select * from reviews")).rows).toEqual([]);
  await denied(
    "insert into reviews(product_id,customer_name,rating,comment) values($1,'Cliente',5,'Superbe literie')",
    [product],
  );
  await denied(
    "insert into reviews(product_id,customer_name,rating,comment) values($1,'Cliente',6,'Autre commentaire')",
    [product],
  );
  await denied("update reviews set comment='Manipulation'");
  await denied("delete from reviews");
  await db.exec(
    `reset role; select set_config('request.jwt.claim.sub','${owner}',true); set local role authenticated; update reviews set is_approved=true;`,
  );
  expect((await db.query("select is_approved from reviews")).rows).toEqual([{ is_approved: true }]);
  await db.exec(
    "update reviews set is_approved=false;reset role;select set_config('request.jwt.claim.sub','',true);set local role anon",
  );
  expect((await db.query("select * from reviews")).rows).toEqual([]);
});
it("refuse tous les diagnostics privés et la lecture des numéros bloqués aux visiteurs", async () => {
  for (const sql of [
    "select * from blocked_phones",
    "select * from order_export_jobs",
    "select * from order_export_targets",
    "select admin_commerce_analytics()",
    "select admin_setup_audit()",
    "select * from admin_commerce_phone_history(array['0555123456'])",
    "select commerce_private.dispatch_exports()",
  ])
    await denied(sql);
  await db.exec("reset role;set local role authenticated");
  for (const sql of [
    "select admin_commerce_analytics()",
    "select admin_setup_audit()",
    "select * from admin_commerce_phone_history(array['0555123456'])",
    "select retry_order_export(1)",
  ])
    await denied(sql);
});
it("normalise les formes locales/internationales, borne pending et ne bloque jamais à cause des refus", async () => {
  await db.exec(`reset role; update store_settings set accepts_cod=true,delivery_wilayas=array['Alger'] where id=1;
    insert into delivery_zones(wilaya,fee,is_active) values('Alger',600,true) on conflict(wilaya) do update set fee=600,is_active=true;
    insert into product_variants(id,product_id,price,stock) values('${product}','${product}',1000,100);set local role anon;`);
  const customer = {
    customer_name: "Cliente",
    phone: "0555123456",
    wilaya: "Alger",
    commune: "Alger Centre",
    address: "Adresse fictive",
  };
  const place = "select place_order($1::jsonb,$2::jsonb)";
  const items = JSON.stringify([{ variant_id: product, quantity: 1 }]);
  for (const phone of ["0555123456", "+213555123456", "00213555123456"])
    await db.query(place, [JSON.stringify({ ...customer, phone }), items]);
  await denied(place, [JSON.stringify(customer), items]);
  await db.exec(
    `reset role;select set_config('request.jwt.claim.sub','${owner}',true);update orders set status='refused';select set_config('request.jwt.claim.sub','',true);set local role anon`,
  );
  await db.query(place, [JSON.stringify(customer), items]);
  await db.exec(
    `reset role;select set_config('request.jwt.claim.sub','${owner}',true);set local role authenticated`,
  );
  expect((await db.query("select count(*)::int n from blocked_phones")).rows).toEqual([{ n: 0 }]);
  await db.query("insert into blocked_phones(phone) values('0555123456')");
  await db.exec(
    "reset role;select set_config('request.jwt.claim.sub','',true);set local role anon",
  );
  await denied(place, [JSON.stringify(customer), items]);
  await db.exec(
    `reset role;select set_config('request.jwt.claim.sub','${owner}',true);set local role authenticated;delete from blocked_phones`,
  );
});
