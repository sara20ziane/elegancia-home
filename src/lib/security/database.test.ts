// @vitest-environment node
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { readFile } from "node:fs/promises";
import { nativeTestDatabase } from "../../../scripts/testing/native-database";

let db: Awaited<ReturnType<typeof nativeTestDatabase>>;
beforeAll(async () => {
  db = await nativeTestDatabase();
}, 30000);
afterAll(async () => {
  await db?.close();
});

describe("frontière publique Supabase après toutes les migrations", () => {
  it("préserve les limites checkout, permissions, anti-abus et restitution de stock", async () => {
    await db.exec(
      "insert into products(id,slug,name,status) values('eeeeeeee-1111-4111-8111-111111111111','security-fixture','Synthetic','published'); insert into product_variants(product_id,price,stock) select 'eeeeeeee-1111-4111-8111-111111111111',1000,100 from generate_series(1,3)",
    );
    await db.exec(await readFile("supabase/tests/selected_openstore_safety.sql", "utf8"));
  });
  it("active RLS sur chaque table applicative", async () => {
    const { rows } = await db.query(
      "select tablename from pg_tables where schemaname='public' and not rowsecurity",
    );
    expect(rows).toEqual([]);
  });
  it("limite les SECURITY DEFINER anonymes à la surface publique prévue", async () => {
    const { rows } = await db.query<{ proname: string; proconfig: string[] }>(
      "select proname,proconfig from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.prosecdef and has_function_privilege('anon',p.oid,'EXECUTE') order by proname",
    );
    expect(rows.map((row) => row.proname)).toEqual([
      "admin_exists",
      "catalogue_page",
      "category_product_counts",
      "place_order",
      "track_order",
    ]);
    expect(rows.every((row) => row.proconfig.includes('search_path=""'))).toBe(true);
  });
  it("interdit toute lecture directe anonyme des données privées", async () => {
    for (const table of [
      "orders",
      "order_items",
      "admin_users",
      "blocked_phones",
      "order_export_targets",
      "order_export_log",
      "invoices",
      "finance_settings",
      "financial_movements",
    ]) {
      const { rows } = await db.query<{ readable: boolean }>(
        "select has_table_privilege('anon',$1,'SELECT') readable",
        [`public.${table}`],
      );
      expect(rows[0].readable, table).toBe(false);
    }
  });
  it("laisse Finance OFF, sans facture, et les deux buckets financiers privés", async () => {
    expect((await db.query("select enabled from finance_settings")).rows).toEqual([
      { enabled: false },
    ]);
    expect((await db.query("select count(*)::int n from invoices")).rows).toEqual([{ n: 0 }]);
    const { rows } = await db.query<{ id: string; public: boolean }>(
      "select id,public from storage.buckets where id like 'finance-%'",
    );
    expect(rows.length).toBe(2);
    expect(rows.every((row) => !row.public)).toBe(true);
  });
  it("refuse les RPC sensibles sans rôle administrateur, même avec authenticated", async () => {
    await db.exec("set role authenticated");
    try {
      await expect(
        db.query("select finance_dashboard(current_date,current_date)"),
      ).rejects.toThrow();
      await expect(db.query("select finance_configure('{\"enabled\":true}')")).rejects.toThrow();
      await expect(db.query("select sync_packers_delivery_rates('[]')")).rejects.toThrow();
      await expect(
        db.query("select place_admin_order('{}','[]','instagram',true)"),
      ).rejects.toThrow();
      await expect(
        db.query("select finance_public_documents(gen_random_uuid())"),
      ).rejects.toThrow();
    } finally {
      await db.exec("reset role");
    }
  });
  it("retourne null pour un token de suivi inconnu et ne permet pas de réclamer une boutique occupée", async () => {
    await db.exec("set role anon");
    try {
      expect(
        (await db.query("select track_order('aaaaaaaa-1111-4111-8111-111111111111') data")).rows,
      ).toEqual([{ data: null }]);
      await expect(db.query("select claim_store()")).rejects.toThrow();
    } finally {
      await db.exec("reset role");
    }
    await db.exec(
      "begin; insert into auth.users values('aaaaaaaa-1111-4111-8111-111111111111'); insert into admin_users(user_id,role) values('aaaaaaaa-1111-4111-8111-111111111111','owner'); set role authenticated; select set_config('request.jwt.claim.sub','aaaaaaaa-1111-4111-8111-111111111111',true)",
    );
    try {
      await expect(db.query("select claim_store()")).rejects.toThrow(
        /already has an administrator/,
      );
    } finally {
      await db.exec("rollback");
    }
  });
});
