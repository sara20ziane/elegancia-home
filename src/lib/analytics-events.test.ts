import { afterEach, expect, it, vi } from "vitest";
import { setAnalyticsAdapter, trackEcommerce } from "./analytics-events";
import { analyticsUrl } from "./analytics-url";

afterEach(() => setAnalyticsAdapter(undefined));

it("n’envoie que les champs autorisés, sans token ni informations client", async () => {
  const sink = vi.fn();
  setAnalyticsAdapter(sink);
  const input = {
    product_id: "11111111-1111-4111-8111-111111111111",
    product_slug: "serena",
    quantity: 2,
    amount: 19000,
    phone: "private",
    address: "private",
    token: "private",
    currency: "EUR",
  };
  trackEcommerce("add_to_cart", input);
  expect(sink).not.toHaveBeenCalled();
  await Promise.resolve();
  expect(sink).toHaveBeenCalledExactlyOnceWith("add_to_cart", {
    product_id: input.product_id,
    product_slug: "serena",
    quantity: 2,
    amount: 19000,
    currency: "DZD",
  });
});

it("reste utilisable si le fournisseur échoue, immédiatement ou plus tard", async () => {
  setAnalyticsAdapter(() => {
    throw new Error("offline");
  });
  expect(() => trackEcommerce("order_completed")).not.toThrow();
  await new Promise((resolve) => setTimeout(resolve, 0));
  setAnalyticsAdapter(() => Promise.reject(new Error("offline")));
  expect(() => trackEcommerce("order_completed")).not.toThrow();
  await new Promise((resolve) => setTimeout(resolve, 0));
});

it("retire les URL privées, paramètres et fragments avant envoi", () => {
  for (const path of [
    "/admin/finance",
    "/login",
    "/setup",
    "/track",
    "/order/token",
    "/api/finance/id/pdf",
  ])
    expect(analyticsUrl(`https://shop.example${path}?phone=private`)).toBeNull();
  expect(analyticsUrl("https://shop.example/catalogue?q=private#private")).toBe(
    "https://shop.example/catalogue",
  );
});

it("écarte les identifiants invalides et les montants non finis", async () => {
  const sink = vi.fn();
  setAnalyticsAdapter(sink);
  trackEcommerce("view_product", {
    product_id: "private",
    product_slug: "a@example.com",
    amount: Infinity,
    quantity: -1,
  });
  await Promise.resolve();
  expect(sink).toHaveBeenCalledWith("view_product", { currency: "DZD" });
});
