import { act } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { beforeEach, afterEach, expect, it, vi } from "vitest";
import { renderTest } from "../../../scripts/testing/react-render";
import { I18nProvider } from "@/lib/i18n-context";
import type { AdminOrder } from "@/lib/admin";
import { DeleteOrderButton } from "./order-delete";
const { deleteOrder } = vi.hoisted(() => ({ deleteOrder: vi.fn() }));
vi.mock("@/lib/admin-delete-order", () => ({ deleteOrder }));
let cleanup: (() => Promise<void>) | undefined;
const order = {
  id: "order1",
  public_token: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
  status: "pending",
  tracking_number: null,
} as AdminOrder;
beforeEach(() => {
  document.cookie = "openstore-locale=fr; path=/";
  deleteOrder.mockResolvedValue(undefined);
});
afterEach(async () => {
  await cleanup?.();
  cleanup = undefined;
  vi.clearAllMocks();
});
it("requires the complete reference, prevents double submission, and refreshes admin data", async () => {
  const client = new QueryClient();
  const invalidate = vi.spyOn(client, "invalidateQueries");
  const view = await renderTest(
    <I18nProvider initialLocale="fr">
      <QueryClientProvider client={client}>
        <DeleteOrderButton order={order} />
      </QueryClientProvider>
    </I18nProvider>,
  );
  cleanup = view.unmount;
  await view.click("Supprimer cette commande");
  expect(deleteOrder).not.toHaveBeenCalled();
  expect(view.container).toHaveTextContent(order.public_token);
  const input = view.container.querySelector("input")!;
  await act(async () => {
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")!.set!.call(
      input,
      order.public_token,
    );
    input.dispatchEvent(new Event("input", { bubbles: true }));
  });
  const remove = [...view.container.querySelectorAll("button")].find(
    (button) => button.textContent === "Supprimer cette commande",
  )!;
  expect(remove).not.toBeDisabled();
  let finish: () => void = () => {};
  deleteOrder.mockReturnValue(
    new Promise<void>((resolve) => {
      finish = resolve;
    }),
  );
  await act(async () => {
    remove.click();
    remove.click();
  });
  expect(deleteOrder).toHaveBeenCalledTimes(1);
  expect(remove).toBeDisabled();
  await act(async () => finish());
  expect(invalidate).toHaveBeenCalledWith({ queryKey: ["admin_orders"] });
  expect(invalidate).toHaveBeenCalledWith({ queryKey: ["admin_orders_count"] });
  client.clear();
});
it.each([
  { ...order, tracking_number: "TRACK" },
  { ...order, status: "confirmed" as const },
])("does not offer deletion for a confirmed order or existing carrier parcel", async (order) => {
  const view = await renderTest(
    <I18nProvider initialLocale="fr">
      <QueryClientProvider client={new QueryClient()}>
        <DeleteOrderButton order={order} />
      </QueryClientProvider>
    </I18nProvider>,
  );
  cleanup = view.unmount;
  expect(view.container.querySelector("button")).toBeNull();
  expect(deleteOrder).not.toHaveBeenCalled();
});
