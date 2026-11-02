import "@tanstack/react-start/server-only";
import { assertAdmin } from "../server/packers-auth";
import type { Json } from "../supabase/types";
import type { FinanceInput, FinanceRow, FinanceResult } from "./types";

const TABLES: Record<string, { table: string; date: string }> = {
  invoices: { table: "invoices", date: "created_at" },
  credits: { table: "credit_notes", date: "issued_at" },
  settlements: { table: "cod_settlements", date: "occurred_at" },
  expenses: { table: "finance_expenses", date: "created_at" },
  purchases: { table: "finance_purchases", date: "created_at" },
  suppliers: { table: "finance_suppliers", date: "created_at" },
  movements: { table: "financial_movements", date: "occurred_at" },
  costs: { table: "variant_costs", date: "recorded_at" },
  audit: { table: "finance_audit_log", date: "created_at" },
  settings: { table: "finance_settings", date: "updated_at" },
};

function rpcFor(operation: string, p: FinanceRow): [string, Record<string, unknown>] {
  switch (operation) {
    case "dashboard":
      return ["finance_dashboard", { p_from: p.from, p_to: p.to }];
    case "report":
      return [
        "finance_report",
        { p_kind: p.kind, p_from: p.from, p_to: p.to, p_page: p.page || 1 },
      ];
    case "order":
      return ["finance_order_status", { p_order: p.order_id }];
    case "configure":
      return ["finance_configure", { p }];
    case "entity":
      return ["finance_save_entity", { p_kind: p.kind, p: p.values }];
    case "cost":
      return [
        "finance_set_cost",
        { p_variant: p.variant_id, p_cost: p.unit_cost, p_request: p.id },
      ];
    case "prepare":
      return ["finance_prepare_order", { p_order: p.order_id, p_import: p.import === true }];
    case "issue":
      return ["finance_issue_invoice", { p_id: p.id }];
    case "credit":
      return ["finance_create_credit", { p_invoice: p.id, p_reason: p.reason }];
    case "settlement":
      return ["finance_record_settlement", { p }];
    case "withholding":
      return ["finance_receive_withholding", { p }];
    case "expense":
      return ["finance_record_expense", { p }];
    case "purchase":
      return ["finance_record_purchase", { p }];
    case "pay_purchase":
      return ["finance_pay_purchase", { p_id: p.id, p_account: p.account_id, p_date: p.date }];
    case "refund":
      return ["finance_refund_credit", { p_id: p.id, p_account: p.account_id, p_date: p.date }];
    case "adjust":
      return ["finance_adjust", { p }];
    default:
      throw new Error("Opération Finance inconnue.");
  }
}

export async function runFinance(input: FinanceInput): Promise<FinanceResult> {
  try {
    const auth = await assertAdmin(input.accessToken);
    if (!auth.supabase) return { ok: false, error: "Accès administrateur requis." };
    const db = auth.supabase;
    const p = input.input;
    if (input.operation === "options") {
      const results = await Promise.all([
        db.from("finance_accounts").select("id,name,kind,active").order("name").limit(200),
        db.from("finance_categories").select("id,name,active").order("name").limit(200),
        db.from("finance_suppliers").select("id,name").order("name").limit(200),
        db
          .from("product_variants")
          .select("id,sku,size,color_name,products(name)")
          .eq("is_active", true)
          .order("id")
          .limit(200),
      ]);
      if (results.some((result) => result.error))
        throw new Error("Options Finance indisponibles. Vérifiez les migrations de recette.");
      return {
        ok: true,
        data: Object.fromEntries(
          ["accounts", "categories", "suppliers", "variants"].map((key, i) => [
            key,
            results[i].data,
          ]),
        ) as Json,
      };
    }
    if (input.operation === "list") {
      if (p.kind === "receivables") {
        const result = await db.rpc("finance_receivables", {
          p_page: Number(p.page) || 1,
          p_carrier: p.carrier || null,
        });
        if (result.error) throw result.error;
        return { ok: true, data: result.data as Json };
      }
      const spec = TABLES[String(p.kind)];
      if (!spec) throw new Error("Liste inconnue.");
      const page = Math.max(1, Math.min(10000, Number(p.page) || 1));
      let query = db
        .from(spec.table)
        .select(
          p.kind === "credits"
            ? "*,finance_refunds(id)"
            : p.kind === "settlements"
              ? "*,cod_withholding_receipts(amount)"
              : "*",
          { count: "exact" },
        )
        .order(spec.date, { ascending: false })
        .order("id", { ascending: false });
      if (typeof p.status === "string" && p.status) query = query.eq("status", p.status);
      const result = await query.range((page - 1) * 30, page * 30 - 1);
      if (result.error) throw result.error;
      return { ok: true, data: { rows: result.data, total: result.count || 0 } as Json };
    }
    const [name, args] = rpcFor(input.operation, p);
    const result = await db.rpc(name, args);
    if (result.error) throw result.error;
    return { ok: true, data: (result.data as Json) ?? null };
  } catch (error) {
    const message =
      error && typeof error === "object" && "message" in error
        ? String(error.message)
        : "Finance indisponible.";
    // No logs or upstream request/headers. PostgreSQL business exceptions contain no credentials.
    return {
      ok: false,
      error:
        message.length < 300
          ? message
          : "Finance indisponible. Vérifiez la configuration et les permissions.",
    };
  }
}
