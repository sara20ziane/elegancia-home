import type { ErpDocument } from "../../src/lib/erpnext/types";
import { erpConfig } from "./erpnext-fixtures";

/** Synthetic ERP protocol simulator. Does not validate an installed ERPNext version. */
export class MockErp {
  docs = new Map<string, ErpDocument>();
  writes: string[] = [];
  loseCreateResponse = false;
  loseSubmitResponse = false;
  status = 200;

  constructor() {
    for (const type of ["Customer", "Sales Order", "Sales Invoice", "Payment Entry"]) {
      this.docs.set(`Custom Field/${type}-custom_elegancia_key`, {
        name: "field",
        docstatus: 0,
        unique: 1,
        fieldtype: "Data",
      });
    }
    this.docs.set(`Company/${erpConfig.company}`, {
      name: erpConfig.company,
      docstatus: 0,
      default_currency: "DZD",
    });
    this.docs.set(`Warehouse/${erpConfig.warehouse}`, {
      name: erpConfig.warehouse,
      docstatus: 0,
      company: erpConfig.company,
      disabled: 0,
    });
    this.docs.set(`Price List/${erpConfig.priceList}`, {
      name: erpConfig.priceList,
      docstatus: 0,
      currency: "DZD",
      selling: 1,
      enabled: 1,
    });
  }

  fetcher: typeof fetch = async (input, init) => {
    const url = new URL(String(input));
    const path = decodeURIComponent(url.pathname);
    if (this.status !== 200) return new Response("private upstream data", { status: this.status });
    const body = init?.body ? (JSON.parse(String(init.body)) as Record<string, unknown>) : {};
    let result: unknown;
    if (path.startsWith("/api/resource/")) {
      const [type, ...parts] = path.slice(14).split("/");
      const name = parts.join("/");
      if (init?.method === "POST") return this.create(type, body);
      if (name) {
        result = this.docs.get(`${type}/${name}`) || this.defaultDoc(type, name);
        if (init?.method === "PUT") {
          result = { ...(result as object), ...body };
          this.docs.set(`${type}/${name}`, result as ErpDocument);
        }
      } else {
        const filters = url.searchParams.get("filters");
        const key = filters ? (JSON.parse(filters)[0][2] as string) : null;
        result = [...this.docs.entries()]
          .filter(
            ([id, doc]) =>
              id.startsWith(`${type}/`) && key !== null && doc.custom_elegancia_key === key,
          )
          .map(([, doc]) => ({ name: doc.name }));
        if (type === "Item" && filters) {
          const codes = JSON.parse(filters)[0][2] as string[];
          result = codes.map((code) => this.defaultDoc("Item", code));
        }
      }
    } else if (path.endsWith("frappe.client.submit")) {
      const doc = body.doc as ErpDocument;
      const type = String(doc.doctype);
      result = { ...doc, docstatus: 1 };
      this.docs.set(`${type}/${doc.name}`, result as ErpDocument);
      this.writes.push(`submit:${type}`);
      if (type === "Payment Entry") {
        const reference = (doc.references as Array<{ reference_name: string }>)[0].reference_name;
        this.docs.get(`Sales Invoice/${reference}`)!.outstanding_amount = 0;
      }
      if (this.loseSubmitResponse) {
        this.loseSubmitResponse = false;
        throw new Error("Response lost after commit");
      }
    } else if (path.endsWith("frappe.client.cancel")) {
      const doc = this.docs.get(`${body.doctype}/${body.name}`)!;
      result = { ...doc, docstatus: 2 };
      this.docs.set(`${body.doctype}/${body.name}`, result as ErpDocument);
      this.writes.push(`cancel:${body.doctype}`);
    } else if (path.endsWith("make_sales_invoice")) {
      const so = this.docs.get(`Sales Order/${body.source_name}`)!;
      result = {
        ...so,
        name: "new-invoice",
        doctype: "Sales Invoice",
        outstanding_amount: so.grand_total,
        items: (so.items as Array<Record<string, unknown>>).map((item) => ({
          ...item,
          sales_order: so.name,
          so_detail: "so-line",
        })),
      };
    } else if (path.endsWith("get_payment_entry")) {
      const invoice = this.docs.get(`Sales Invoice/${body.dn}`)!;
      result = {
        doctype: "Payment Entry",
        company: invoice.company,
        party_type: "Customer",
        party: invoice.customer,
        payment_type: "Receive",
        paid_to: body.bank_account,
        paid_from_account_currency: "DZD",
        paid_to_account_currency: "DZD",
        paid_amount: invoice.grand_total,
        received_amount: invoice.grand_total,
        difference_amount: 0,
        references: [
          {
            reference_doctype: "Sales Invoice",
            reference_name: invoice.name,
            allocated_amount: invoice.grand_total,
          },
        ],
      };
    }
    return Response.json({ data: result });
  };

  private defaultDoc(type: string, name: string) {
    if (type === "Item")
      return {
        name,
        docstatus: 0,
        is_sales_item: 1,
        is_stock_item: name === erpConfig.shippingItem ? 0 : 1,
      };
    if (type === "Account")
      return { name, docstatus: 0, company: erpConfig.company, account_currency: "DZD" };
    throw new Error(`Missing synthetic document ${type}/${name}`);
  }

  private create(type: string, body: Record<string, unknown>) {
    if (
      [...this.docs.values()].some(
        (doc) => doc.doctype === type && doc.custom_elegancia_key === body.custom_elegancia_key,
      )
    ) {
      return new Response("Duplicate unique key", { status: 409 });
    }
    const name = `${type}-${this.writes.length + 1}`;
    const total = Array.isArray(body.items)
      ? body.items.reduce((sum, item) => sum + item.qty * item.rate, 0)
      : undefined;
    const doc: ErpDocument = {
      ...body,
      name,
      doctype: type,
      docstatus: 0,
      grand_total: total,
      rounded_total: total,
    };
    this.docs.set(`${type}/${name}`, doc);
    this.writes.push(`create:${type}`);
    if (this.loseCreateResponse) {
      this.loseCreateResponse = false;
      throw new Error("Response lost after commit");
    }
    return Response.json({ data: doc });
  }
}
