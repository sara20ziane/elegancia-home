import type * as OrderModule from "@/lib/order";
import { act, type ReactNode } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { renderTest } from "../../../scripts/testing/react-render";
import { I18nProvider } from "@/lib/i18n-context";
import { saveOrderLocally, readSavedOrders } from "@/lib/saved-orders";
import { SavedOrders } from "./saved-orders";

const { trackOrder, writeText } = vi.hoisted(() => ({
  trackOrder: vi.fn(),
  writeText: vi.fn().mockResolvedValue(undefined),
}));
vi.mock("@/lib/order", async (original) => ({
  ...(await original<typeof OrderModule>()),
  trackOrder,
}));
vi.mock("@tanstack/react-router", () => ({
  Link: ({ params, children }: { params: { token: string }; children: ReactNode }) => (
    <a href={`/order/${params.token}`}>{children}</a>
  ),
}));
vi.mock("@/components/storefront/store-layout", () => ({
  StoreLayout: ({ children }: { children: ReactNode }) => <div>{children}</div>,
}));
const publicToken = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const data = {
  token: publicToken,
  status: "pending",
  delivery_method: "home",
  tracking_number: null,
  created_at: "2026-10-31T10:00:00.000Z",
  customer_name: "Never display here",
};
let queryClient: QueryClient;
let cleanup: (() => Promise<void>) | undefined;
beforeEach(() => {
  window.localStorage.clear();
  document.cookie = "openstore-locale=fr; path=/";
  queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  Object.defineProperty(navigator, "clipboard", { configurable: true, value: { writeText } });
  trackOrder.mockResolvedValue(data);
});
afterEach(async () => {
  await cleanup?.();
  cleanup = undefined;
  queryClient.clear();
  vi.clearAllMocks();
});
async function render(node: ReactNode) {
  const view = await renderTest(
    <I18nProvider initialLocale="fr">
      <QueryClientProvider client={queryClient}>{node}</QueryClientProvider>
    </I18nProvider>,
  );
  cleanup = view.unmount;
  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 20));
  });
  return view;
}

describe("saved order tracking", () => {
  it("loads by public token, shows status/method and handles missing tracking", async () => {
    saveOrderLocally({ publicToken, createdAt: data.created_at });
    const view = await render(<SavedOrders />);
    expect(trackOrder).toHaveBeenCalledExactlyOnceWith(publicToken);
    expect(view.container).toHaveTextContent("Mes commandes sauvegardées");
    expect(view.container).toHaveTextContent("En attente");
    expect(view.container).toHaveTextContent("Livraison à domicile");
    expect(view.container).toHaveTextContent("après la création du colis");
    expect(view.container).not.toHaveTextContent("Copier le numéro de suivi");
    expect(view.container).not.toHaveTextContent(data.customer_name);
    expect(view.container.querySelector("a")).toHaveAttribute("href", `/order/${publicToken}`);
  });
  it("shows later Packers tracking, copies it and removes only the local bookmark", async () => {
    saveOrderLocally({ publicToken, createdAt: data.created_at });
    const view = await render(<SavedOrders />);
    await act(async () => {
      queryClient.setQueryData(["track", publicToken], {
        ...data,
        status: "shipped",
        tracking_number: "PACKERS-123",
      });
    });
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 20));
    });
    expect(view.container).toHaveTextContent("PACKERS-123");
    await view.click("Copier le numéro de suivi");
    expect(writeText).toHaveBeenCalledWith("PACKERS-123");
    expect(view.container).toHaveTextContent("Numéro de suivi copié");
    await view.click("Retirer de mes commandes");
    expect(readSavedOrders()).toEqual([]);
    expect(view.container).toHaveTextContent("Aucune commande enregistrée");
    expect(trackOrder).toHaveBeenCalledTimes(1);
  });
  it("keeps a bookmark when the RPC is unavailable", async () => {
    saveOrderLocally({ publicToken, createdAt: data.created_at });
    trackOrder.mockRejectedValue(new Error("offline"));
    const view = await render(<SavedOrders />);
    expect(view.container).toHaveTextContent("Suivi temporairement indisponible");
    expect(readSavedOrders()).toHaveLength(1);
  });
  it("updates after a cross-tab storage change", async () => {
    const view = await render(<SavedOrders />);
    await act(async () => {
      window.localStorage.setItem(
        "elegancia-saved-orders-v1",
        JSON.stringify([{ publicToken, createdAt: null }]),
      );
      window.dispatchEvent(new StorageEvent("storage", { key: "elegancia-saved-orders-v1" }));
    });
    expect(view.container).toHaveTextContent(publicToken);
  });
});
