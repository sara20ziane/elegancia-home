import { describe, expect, it } from "vitest";
import type { StoreSettings } from "./store-settings";
import { pickupFee, resolveDelivery, type DeliveryZone } from "./delivery";

// The same rule as delivery_fee_for() in schema.sql. If these drift apart, the
// buyer is shown one price and charged another.
const settings = { delivery_fee_flat: 600, free_shipping_threshold: 10000 } as StoreSettings;
const zones: DeliveryZone[] = [
  { wilaya: "Alger", fee: 650, stopdesk_fee: 400, eta_days: 2, is_active: true },
  { wilaya: "Oran", fee: 800, stopdesk_fee: null, eta_days: 3, is_active: true },
];

describe("resolveDelivery", () => {
  it("uses only a synchronized Packers fee, with no flat fallback", () => {
    expect(resolveDelivery(settings, zones, "Alger", 2500).fee).toBe(650);
    expect(resolveDelivery(settings, zones, "Blida", 2500).available).toBe(false);
  });

  it("charges the pickup price for pickup", () => {
    expect(resolveDelivery(settings, zones, "Alger", 2500, "stopdesk").fee).toBe(400);
  });

  it("uses the parure offer, never an unrelated monetary threshold", () => {
    expect(resolveDelivery(settings, zones, "Alger", 10000, "stopdesk").fee).toBe(400);
    expect(resolveDelivery(settings, zones, "Alger", 10000, "stopdesk", 2).fee).toBe(0);
    expect(resolveDelivery(settings, zones, "Oran", 12000).fee).toBe(800);
    expect(resolveDelivery(settings, zones, "Oran", 12000, "home", 3).fee).toBe(0);
  });

  it("offers pickup only where it is priced", () => {
    expect(pickupFee(zones, "Alger")).toBe(400);
    expect(pickupFee(zones, "Oran")).toBeNull();
  });
});
