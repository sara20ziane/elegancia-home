import { act, type ReactNode } from "react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { renderTest } from "../../../scripts/testing/react-render";
import { testProduct, testVariant } from "../../../scripts/testing/v020-fixtures";
import { I18nProvider } from "@/lib/i18n-context";
import { QuickOrder } from "./quick-order";
import type { CheckoutForm } from "./checkout-panels";
const { placeOrder, clear, notify } = vi.hoisted(() => ({
  placeOrder: vi.fn(),
  clear: vi.fn(),
  notify: vi.fn(),
}));
vi.mock("@/lib/order", async (original) => ({ ...(await original<object>()), placeOrder }));
vi.mock("@/lib/server/telegram-actions", () => ({ notifyTelegramNewOrder: notify }));
vi.mock("@/lib/cart", () => ({ useCart: () => ({ items: [], clear }) }));
vi.mock("@/lib/use-checkout-quote", () => ({
  useCheckoutQuote: () => ({
    settings: { accepts_cod: true },
    delivery: { available: true, fee: 600 },
    homeDelivery: { available: true, fee: 600 },
    pickup: null,
  }),
}));
vi.mock("./delivery-choice", () => ({ DeliveryChoice: () => null }));
vi.mock("./checkout-panels", async (original) => ({
  ...(await original<object>()),
  AddressFields: ({
    form,
    onChange,
  }: {
    form: CheckoutForm;
    onChange: (form: CheckoutForm) => void;
  }) => (
    <button
      type="button"
      onClick={() =>
        onChange({
          ...form,
          customer_name: "Test cliente",
          phone: "0555550199",
          wilaya: "Alger",
          commune: "Alger Centre",
          address: "Adresse test",
        })
      }
    >
      Adresse test
    </button>
  ),
}));
vi.mock("@tanstack/react-router", () => ({
  Link: ({ children, params }: { children: ReactNode; params: { token: string } }) => (
    <a href={`/order/${params.token}`}>{children}</a>
  ),
}));
let cleanup: (() => Promise<void>) | undefined;
beforeEach(() => {
  document.cookie = "openstore-locale=fr; path=/";
  placeOrder.mockResolvedValue({ token: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa", error: null });
  notify.mockResolvedValue(undefined);
});
afterEach(async () => {
  await cleanup?.();
  cleanup = undefined;
  vi.clearAllMocks();
});
it("orders the selected bedding variant/quantity directly without changing the cart", async () => {
  const client = new QueryClient();
  const view = await renderTest(
    <I18nProvider initialLocale="fr">
      <QueryClientProvider client={client}>
        <QuickOrder
          product={testProduct}
          name={testProduct.name}
          selected={testVariant}
          images={[]}
          quantity={3}
        />
      </QueryClientProvider>
    </I18nProvider>,
  );
  cleanup = view.unmount;

  expect(view.container).not.toHaveTextContent("Adresse test");
  await view.click("Commander maintenant");
  await view.click("Adresse test");
  await act(async () => {
    view.container
      .querySelector("form")!
      .dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));
  });
  expect(placeOrder).toHaveBeenCalledWith(expect.objectContaining({ commune: "Alger Centre" }), [
    { variant_id: testVariant.id, quantity: 3 },
  ]);
  expect(clear).not.toHaveBeenCalled();
  expect(notify).toHaveBeenCalledTimes(1);
  expect(view.container).toHaveTextContent("Commande reçue");
  expect(view.container).toHaveTextContent("Copier le numéro de commande");
  client.clear();
});
