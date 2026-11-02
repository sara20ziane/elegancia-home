import { describe, expect, it } from "vitest";
import { customerFields, mapSalesOrder, normalizeCustomerPhone } from "./mapping";
import { financeOrder, erpConfig } from "../../../scripts/testing/erpnext-fixtures";

describe("mapping Elegancia canonique", () => {
  it.each(["0555123456", "+213 555 123 456", "213555123456", "00213555123456"])(
    "normalise %s",
    (raw) => {
      expect(normalizeCustomerPhone(raw)).toBe("0555123456");
    },
  );
  it("rejette un téléphone sans identité exploitable", () => {
    expect(() => normalizeCustomerPhone("123")).toThrow();
  });
  it("préserve les coordonnées disponibles sans inventer un email ou une commune", () => {
    const order = financeOrder();
    order.commune = null;
    expect(customerFields(order)).toEqual({
      customer_name: order.customer_name,
      customer_type: "Individual",
      custom_elegancia_phone: "0555123456",
      custom_elegancia_address: order.address,
      custom_elegancia_commune: "",
      custom_elegancia_wilaya: "Alger",
    });
  });
  it("transmet prix réels, variantes, quantités et livraison stockés", () => {
    const order = financeOrder();
    const payload = mapSalesOrder(order, "Customer-1", erpConfig);
    expect(payload.items).toMatchObject([
      { item_code: "AVELINE-QUEEN-SAUGE", qty: 2, rate: 3000 },
      { item_code: "DELIVERY", qty: 1, rate: 600 },
    ]);
    expect(payload.items.reduce((sum, item) => sum + item.qty * item.rate, 0)).toBe(order.total);
    expect(payload.custom_elegancia_order_id).toBe(order.id);
    expect(payload).not.toHaveProperty("tax_rate");
  });
  it("préserve la livraison offerte et les prix déjà remisés", () => {
    const order = financeOrder();
    order.delivery_fee = 0;
    order.total = order.subtotal;
    expect(mapSalesOrder(order, "C", erpConfig).items).toHaveLength(1);
  });
  it.each(["mapping", "subtotal", "total", "quantity"])("bloque une incohérence %s", (kind) => {
    const order = financeOrder();
    if (kind === "mapping") order.items[0].item_code = null;
    if (kind === "subtotal") order.subtotal = 1;
    if (kind === "total") order.total = 1;
    if (kind === "quantity") order.items[0].quantity = -1;
    expect(() => mapSalesOrder(order, "C", erpConfig)).toThrow();
  });
});
