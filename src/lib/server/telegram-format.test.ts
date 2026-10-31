import { describe, expect, it, vi } from "vitest";
vi.mock("@tanstack/react-start/server-only", () => ({}));
import { telegramOrder as order } from "../../../scripts/testing/telegram-fixtures";
import { formatNewOrder, formatPackersParcel, splitTelegramText } from "./telegram-format";

describe("Telegram plain text formatting", () => {
  it("includes every canonical field for a single item, without token or note", () => {
    const text = formatNewOrder({
      ...order,
      token: "private-public-token",
      note: "Private note",
    } as typeof order);
    for (const value of [
      "NOUVELLE COMMANDE — ELEGANCIA HOME",
      "Cliente test",
      "0555550199",
      "Alger",
      "Alger Centre",
      "Adresse de test",
      "Aveline",
      "Queen — Parure de drap",
      "Quantité : 1",
      "À confirmer",
    ])
      expect(text).toContain(value);
    expect(text).not.toContain("private-public-token");
    expect(text).not.toContain("Private note");
  });
  it("lists all items and computes each line amount", () => {
    const text = formatNewOrder({
      ...order,
      items: [
        ...order.items,
        { product_name: "Velina", variant_label: "King", quantity: 2, unit_price: 8000 },
      ],
    });
    expect(text).toContain("Aveline");
    expect(text).toContain("Velina — King");
    expect(text).toContain("Quantité : 2");
    expect(text).toContain("Total ligne : 16 000 DA");
  });
  it("formats French/Algerian DA amounts and Africa/Algiers date", () => {
    const text = formatNewOrder(order);
    expect(text).toContain("Prix unitaire : 7 500 DA");
    expect(text).toContain("Sous-total : 7 500 DA");
    expect(text).toContain("Livraison : 400 DA");
    expect(text).toContain("TOTAL : 7 900 DA");
    expect(text).toMatch(/31\/10\/2026.*14:09/);
  });
  it("distinguishes home from Stop Desk without inventing an office", () => {
    expect(formatNewOrder(order)).toContain("Mode : Livraison à domicile");
    expect(formatNewOrder(order)).not.toContain("Point Stop Desk");
    const desk = formatNewOrder({
      ...order,
      delivery_method: "stopdesk",
      stopdesk_name: "Commune retournée",
    });
    expect(desk).toContain("Mode : Stop Desk");
    expect(desk).toContain("Point Stop Desk : Commune retournée");
    expect(
      formatNewOrder({ ...order, delivery_method: "stopdesk", stopdesk_name: null }),
    ).toContain("Point Stop Desk : Non renseigné");
  });
  it("handles missing commune/tracking/variant and flattens user-entered newlines", () => {
    const text = formatNewOrder({
      ...order,
      commune: null,
      customer_name: "Test\nCliente",
      items: [{ ...order.items[0], variant_label: null }],
    });
    expect(text).toContain("Commune : Non renseigné");
    expect(text).toContain("Nom : Test Cliente");
    expect(text).toContain("en attente de création du colis");
    expect(text).not.toContain("null");
  });
  it("formats the saved Packers parcel with canonical COD and tracking", () => {
    const text = formatPackersParcel({
      ...order,
      delivery_method: "stopdesk",
      tracking_number: "ECGHTG2610311948869",
    });
    for (const value of [
      "COLIS PACKERS CRÉÉ",
      "Cliente test",
      "0555550199",
      "Stop Desk",
      "Alger — Alger Centre",
      "Montant COD : 7 900 DA",
      "ECGHTG2610311948869",
    ])
      expect(text).toContain(value);
    expect(formatNewOrder({ ...order, tracking_number: "ECGHTG2610311948869" })).toContain(
      "ECGHTG2610311948869",
    );
  });
  it("splits long orders with all articles and no missing characters", () => {
    const items = Array.from({ length: 50 }, (_, index) => ({
      ...order.items[0],
      product_name: `Article ${index} ${"x".repeat(100)}`,
    }));
    const text = formatNewOrder({ ...order, items });
    const chunks = splitTelegramText(text);
    expect(chunks.length).toBeGreaterThan(1);
    expect(chunks.join("")).toBe(text);
    expect(chunks.every((chunk) => chunk.length <= 4000)).toBe(true);
    expect(chunks.join("")).toContain("Article 49");
  });
  it("preserves emoji surrogate pairs at hard split boundaries", () => {
    const text = `${"x".repeat(3999)}🛍️${"y".repeat(5000)}`;
    const chunks = splitTelegramText(text);
    expect(chunks.join("")).toBe(text);
    expect(chunks[0]).toHaveLength(3999);
  });
});
