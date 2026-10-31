import { act, type FormEvent } from "react";
import { beforeEach, afterEach, expect, it, vi } from "vitest";
import { renderTest } from "../../scripts/testing/react-render";
import { EMPTY_CHECKOUT_FORM } from "@/components/storefront/checkout-panels";
import { useCheckoutOrder } from "./use-checkout-order";
import { readSavedOrders } from "./saved-orders";
const { placeOrder, notifyTelegramNewOrder } = vi.hoisted(() => ({
  placeOrder: vi.fn(),
  notifyTelegramNewOrder: vi.fn(),
}));
vi.mock("./server/telegram-actions", () => ({ notifyTelegramNewOrder }));
vi.mock("./order", async (original) => ({ ...(await original<object>()), placeOrder }));
const publicToken = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const form = {
  ...EMPTY_CHECKOUT_FORM,
  wilaya: "Alger",
  commune: "Alger Centre",
  phone: "0555550199",
  customer_name: "Private",
  address: "Private address",
};
let result: ReturnType<typeof useCheckoutOrder>;
const clear = vi.fn();
function Harness() {
  result = useCheckoutOrder(form, { items: [], clear }, true);
  return null;
}
const event = { preventDefault: vi.fn() } as unknown as FormEvent;
beforeEach(() => {
  window.localStorage.clear();
  placeOrder.mockResolvedValue({ token: publicToken, error: null });
  notifyTelegramNewOrder.mockResolvedValue(undefined);
});
afterEach(() => {
  vi.restoreAllMocks();
  vi.clearAllMocks();
});
it("creates the order and clears the cart without writing any token to localStorage", async () => {
  const write = vi.spyOn(Storage.prototype, "setItem");
  const view = await renderTest(<Harness />);
  await act(async () => {
    await result.submit(event);
  });
  expect(write).not.toHaveBeenCalled();
  expect(readSavedOrders()).toEqual([]);
  expect(result.placed).toEqual({ token: publicToken, createdAt: expect.any(String) });
  expect(clear).toHaveBeenCalledTimes(1);
  expect(notifyTelegramNewOrder).toHaveBeenCalledExactlyOnceWith({ data: { publicToken } });
  await view.unmount();
});
it("preserves the successful order and follow-up token when storage is blocked", async () => {
  const write = vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
    throw new Error("blocked");
  });
  const view = await renderTest(<Harness />);
  await act(async () => {
    await result.submit(event);
  });
  expect(result.placed).toEqual({ token: publicToken, createdAt: expect.any(String) });
  expect(write).not.toHaveBeenCalled();
  expect(clear).toHaveBeenCalledTimes(1);
  await view.unmount();
});
it("does not save or clear the cart on a failed RPC", async () => {
  placeOrder.mockResolvedValue({ token: null, error: "Rejected" });
  const view = await renderTest(<Harness />);
  await act(async () => {
    await result.submit(event);
  });
  expect(readSavedOrders()).toEqual([]);
  expect(result.placed).toBeNull();
  expect(notifyTelegramNewOrder).not.toHaveBeenCalled();
  expect(clear).not.toHaveBeenCalled();
  await view.unmount();
});
it("guards double submission and recovers from network rejection", async () => {
  placeOrder.mockRejectedValue(new Error("offline"));
  const view = await renderTest(<Harness />);
  await act(async () => {
    await Promise.all([result.submit(event), result.submit(event)]);
  });
  expect(placeOrder).toHaveBeenCalledTimes(1);
  expect(notifyTelegramNewOrder).not.toHaveBeenCalled();
  expect(result.submitting).toBe(false);
  expect(result.error).not.toBeNull();
  expect(readSavedOrders()).toEqual([]);
  await view.unmount();
});

it("keeps checkout successful if Telegram rejects or throws synchronously", async () => {
  for (const behavior of [
    () => Promise.reject(new Error("offline")),
    () => {
      throw new Error("offline");
    },
  ]) {
    notifyTelegramNewOrder.mockImplementation(behavior);
    const view = await renderTest(<Harness />);
    await act(async () => {
      await result.submit(event);
    });
    expect(result.placed).toEqual({ token: publicToken, createdAt: expect.any(String) });
    expect(result.error).toBeNull();
    await view.unmount();
  }
});
it("does not await Telegram and prevents duplicate successful submissions", async () => {
  notifyTelegramNewOrder.mockReturnValue(new Promise(() => {}));
  const view = await renderTest(<Harness />);
  await act(async () => {
    await Promise.all([result.submit(event), result.submit(event)]);
  });
  expect(result.placed?.token).toBe(publicToken);
  expect(result.submitting).toBe(false);
  expect(placeOrder).toHaveBeenCalledTimes(1);
  expect(notifyTelegramNewOrder).toHaveBeenCalledTimes(1);
  await view.unmount();
});
it.each([null, "not-a-public-token"])(
  "never notifies Telegram for an unusable returned token: %s",
  async (token) => {
    placeOrder.mockResolvedValue({ token, error: null });
    const view = await renderTest(<Harness />);
    await act(async () => {
      await result.submit(event);
    });
    expect(notifyTelegramNewOrder).not.toHaveBeenCalled();
    await view.unmount();
  },
);
