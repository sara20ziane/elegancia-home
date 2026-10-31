import { beforeEach, afterEach, describe, expect, it, vi } from "vitest";
import {
  readSavedOrders,
  removeSavedOrder,
  saveOrderLocally,
  SAVED_ORDERS_KEY,
} from "./saved-orders";
const publicToken = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const createdAt = "2026-10-31T10:00:00.000Z";
beforeEach(() => window.localStorage.clear());
afterEach(() => vi.restoreAllMocks());

describe("saved orders", () => {
  it("saves the public token and date, including before a parcel exists", () => {
    expect(saveOrderLocally({ publicToken, createdAt })).toBe(true);
    expect(readSavedOrders()).toEqual([{ publicToken, createdAt }]);
    expect(window.localStorage.getItem("openstore-saved-orders")).toBeNull();
  });
  it("deduplicates UUID case and preserves the original date", () => {
    saveOrderLocally({ publicToken, createdAt });
    saveOrderLocally({ publicToken: publicToken.toUpperCase(), createdAt: "2026-11-01" });
    expect(readSavedOrders()).toEqual([{ publicToken, createdAt }]);
  });
  it("removes only the selected browser entry", () => {
    saveOrderLocally({ publicToken, createdAt });
    expect(removeSavedOrder(publicToken)).toBe(true);
    expect(readSavedOrders()).toEqual([]);
  });
  it.each(["broken{", "null", "{}", '[null,12,{}, {"publicToken":"internal-id"}]'])(
    "tolerates invalid storage: %s",
    (raw) => {
      window.localStorage.setItem(SAVED_ORDERS_KEY, raw);
      expect(readSavedOrders()).toEqual([]);
      expect(saveOrderLocally({ publicToken, createdAt })).toBe(true);
    },
  );
  it("whitelists fields on write and read, with no name, phone, address or tracking", () => {
    const input = {
      publicToken,
      createdAt,
      name: "Private",
      customer_name: "Private",
      phone: "0555555555",
      address: "Private",
      tracking_number: "TEST",
      wilaya: "Alger",
      commune: "Alger Centre",
      status: "shipped",
      total: 15000,
      items: [{ product_name: "Private purchase", quantity: 2 }],
    };
    saveOrderLocally(input);
    expect(JSON.parse(window.localStorage.getItem(SAVED_ORDERS_KEY)!)).toEqual([
      { publicToken, createdAt },
    ]);
    window.localStorage.setItem(SAVED_ORDERS_KEY, JSON.stringify([input]));
    expect(readSavedOrders()).toEqual([{ publicToken, createdAt }]);
  });
  it("handles blocked and full storage without throwing", () => {
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new Error("quota");
    });
    expect(saveOrderLocally({ publicToken, createdAt })).toBe(false);
    expect(removeSavedOrder(publicToken)).toBe(false);
    vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
      throw new Error("blocked");
    });
    expect(readSavedOrders()).toEqual([]);
  });
  it("normalizes invalid dates to null and bounds the list to the last 30", () => {
    for (let i = 0; i < 35; i += 1) {
      saveOrderLocally({
        publicToken: `aaaaaaaa-aaaa-4aaa-8aaa-${i.toString().padStart(12, "0")}`,
        createdAt: "invalid",
      });
    }
    expect(readSavedOrders()).toHaveLength(30);
    expect(readSavedOrders()[0].createdAt).toBeNull();
  });
});
