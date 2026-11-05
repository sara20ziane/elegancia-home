// @vitest-environment node
import { afterAll, afterEach, beforeAll, beforeEach, expect, it } from "vitest";
import { nativeTestDatabase } from "../../../scripts/testing/native-database";
let db: Awaited<ReturnType<typeof nativeTestDatabase>>;
const owner = "abababab-0000-4000-8000-000000000001";
const variant = "abababab-1000-4000-8000-000000000001";
beforeAll(async () => {
  db = await nativeTestDatabase();
  // Transport and cryptography are explicit stubs here; receiver tests verify real HMAC.
  await db.exec(`create table net.test_requests(id bigserial primary key,url text,body jsonb,params jsonb,headers jsonb);
    create table net._http_response(id bigint,status_code integer,content text,timed_out boolean,error_msg text);
    create function extensions.hmac(text,text,text) returns bytea language sql as $$select decode(repeat('ab',32),'hex')$$;
    create function net.http_post(url text,body jsonb,params jsonb,headers jsonb,timeout_milliseconds integer) returns bigint language plpgsql as $$declare result bigint;begin insert into net.test_requests(url,body,params,headers) values($1,$2,$3,$4) returning id into result;return result;end$$;`);
}, 30000);
afterAll(async () => {
  await db?.close();
});
beforeEach(async () => {
  await db.exec(`begin; insert into auth.users values('${owner}'); insert into admin_users(user_id,role) values('${owner}','owner'); select set_config('request.jwt.claim.sub','${owner}',true);
    update store_settings set accepts_cod=true,delivery_wilayas=array['Alger'] where id=1;
    insert into delivery_zones(wilaya,fee,is_active) values('Alger',600,true) on conflict(wilaya) do update set fee=600,is_active=true;
    insert into products(id,slug,name,status) values('${variant}','outbox-fixture','Fixture','published');
    insert into product_variants(id,product_id,price,stock) values('${variant}','${variant}',1000,100);
    insert into order_export_targets(label,url) values('Private sheet','https://script.google.com/macros/s/fixture/exec');`);
});
afterEach(async () => {
  await db.exec("rollback");
});
async function place() {
  await db.query("select place_order($1::jsonb,$2::jsonb)", [
    JSON.stringify({
      customer_name: "Fictive",
      phone: "0555123456",
      wilaya: "Alger",
      commune: "Alger Centre",
      address: "Adresse fictive",
    }),
    JSON.stringify([{ variant_id: variant, quantity: 1 }]),
  ]);
}
async function job() {
  return (
    await db.query<{
      id: number;
      revision: number;
      request_id: number;
      order_id: string;
      attempts: number;
      status: string;
      last_error: string;
    }>("select * from order_export_jobs")
  ).rows[0];
}
it("désactive toute nouvelle destination et ne lance aucun appel réseau dans le checkout", async () => {
  expect((await db.query("select enabled from order_export_targets")).rows).toEqual([
    { enabled: false },
  ]);
  await place();
  expect((await db.query("select count(*)::int n from order_export_jobs")).rows).toEqual([
    { n: 0 },
  ]);
  expect((await db.query("select count(*)::int n from net.test_requests")).rows).toEqual([
    { n: 0 },
  ]);
});
it("fusionne créations, modifications, suivi et statuts dans une seule tâche par commande", async () => {
  await db.exec("update order_export_targets set enabled=true");
  await place();
  const initial = await job();
  await db.exec(
    "update orders set address='Nouvelle adresse',tracking_number='TEST-TRACK',status='confirmed'",
  );
  expect(Number((await job()).revision)).toBeGreaterThan(Number(initial.revision));
  expect((await db.query("select count(*)::int n from order_export_jobs")).rows).toEqual([
    { n: 1 },
  ]);
  await db.query("select commerce_private.dispatch_exports()");
  const sent = (
    await db.query<{
      body: { order: Record<string, unknown>; items: unknown[] };
      params: { sig: string };
    }>("select body,params from net.test_requests")
  ).rows[0];
  expect(sent.body.order).toMatchObject({
    address: "Nouvelle adresse",
    tracking_number: "TEST-TRACK",
    total: 1600,
    status: "confirmed",
    delivery_method: "home",
  });
  expect(sent.body.order).not.toHaveProperty("token");
  expect(sent.body.items).toHaveLength(1);
  expect(sent.params.sig).toMatch(/^[a-f0-9]{64}$/);
  const queued = await job();
  await db.query("insert into net._http_response values($1,200,$2,false,null)", [
    queued.request_id,
    JSON.stringify({ ok: true, order_id: queued.order_id, revision: String(queued.revision) }),
  ]);
  await db.exec(
    "update order_export_jobs set next_attempt_at=now(); select commerce_private.dispatch_exports()",
  );
  expect((await job()).status).toBe("succeeded");
});
it("borne les reprises à cinq, vérifie les accusés et ne conserve aucune réponse cliente", async () => {
  await db.exec("update order_export_targets set enabled=true");
  await place();
  for (let i = 0; i < 5; i++) {
    await db.exec(
      "update order_export_jobs set next_attempt_at=now(); select commerce_private.dispatch_exports()",
    );
    const queued = await job();
    await db.query("insert into net._http_response values($1,200,$2,false,null)", [
      queued.request_id,
      JSON.stringify({
        ok: true,
        order_id: "wrong",
        revision: String(queued.revision),
        private: "NEVER-LOG-ME",
      }),
    ]);
    await db.exec(
      "update order_export_jobs set next_attempt_at=now(); select commerce_private.dispatch_exports()",
    );
  }
  expect(await job()).toMatchObject({ status: "failed", attempts: 5 });
  expect((await job()).last_error).not.toContain("NEVER-LOG-ME");
  await db.exec("select commerce_private.dispatch_exports()");
  expect((await db.query("select count(*)::int n from net.test_requests")).rows).toEqual([
    { n: 5 },
  ]);
  await db.query("select retry_order_export($1)", [(await job()).id]);
  expect(await job()).toMatchObject({ status: "pending", attempts: 0 });
});
it("suspend les tâches lorsque la destination est désactivée et protège la file", async () => {
  await db.exec("update order_export_targets set enabled=true");
  await place();
  await db.exec(
    "update order_export_targets set enabled=false; select commerce_private.dispatch_exports()",
  );
  expect((await db.query("select count(*)::int n from net.test_requests")).rows).toEqual([
    { n: 0 },
  ]);
  await db.exec("set local role anon; savepoint unauthorized");
  await expect(db.query("select * from order_export_jobs")).rejects.toThrow(/permission/);
  await db.exec("rollback to unauthorized; reset role");
});
