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

describe("transactions financières PostgreSQL", () => {
  it("exécute les scénarios réels facture/COD/coûts/dépenses/achats/avoirs/permissions", async () => {
    await db.exec(await readFile("supabase/tests/native-finance.sql", "utf8"));
    expect((await db.query("select count(*)::int n from public.invoices")).rows[0]).toEqual({
      n: 0,
    });
  }, 30000);
  it("alloue des numéros distincts pour des appels simultanés", async () => {
    // PGlite serializes one connection; multi-session contention still needs a real Supabase staging database.
    const results = await Promise.all(
      Array.from({ length: 40 }, () =>
        db.query<{ number: string }>("select finance_private.number('FAC') number"),
      ),
    );
    const numbers = results.map((result) => result.rows[0].number);
    expect(new Set(numbers).size).toBe(40);
    expect(numbers.every((number) => /^FAC-\d{4}-\d{6}$/.test(number))).toBe(true);
  });
  it("ne régresse pas sur les réservations et retours Packers existants", async () => {
    await db.exec(
      "insert into public.products(id,slug,name,status) values('eeeeeeee-1111-4111-8111-111111111111','native-stock-test','Fixture','published'); insert into public.product_variants(product_id,price,stock) values('eeeeeeee-1111-4111-8111-111111111111',1000,10)",
    );
    await db.exec(await readFile("supabase/tests/packers-stock-regression.sql", "utf8"));
  });
  it("active RLS sur toutes les tables natives et ne donne aucun SELECT public", async () => {
    const result = await db.query<{ tablename: string; rowsecurity: boolean; readable: boolean }>(
      "select tablename,rowsecurity,has_table_privilege('anon','public.'||tablename,'SELECT') readable from pg_tables where schemaname='public' and (tablename like 'finance_%' or tablename in ('order_finance','variant_costs','invoices','invoice_items','invoice_counters','credit_notes','financial_movements','cod_settlements','cod_settlement_items','cod_withholding_receipts'))",
    );
    expect(result.rows.length).toBe(20);
    expect(result.rows.every((table) => table.rowsecurity && !table.readable)).toBe(true);
  });
});
