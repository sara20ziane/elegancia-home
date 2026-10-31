import { act, type ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { renderTest } from "../../../scripts/testing/react-render";
import { I18nProvider } from "@/lib/i18n-context";
import { readSavedOrders, saveOrderLocally, SAVED_ORDERS_KEY } from "@/lib/saved-orders";
import { OrderPlaced } from "./order-placed";

vi.mock("@tanstack/react-router", () => ({
  Link: ({ params, children }: { params: { token: string }; children: ReactNode }) => (
    <a href={`/order/${params.token}`}>{children}</a>
  ),
}));
vi.mock("@/components/storefront/store-layout", () => ({
  StoreLayout: ({ children }: { children: ReactNode }) => <div>{children}</div>,
}));
const publicToken = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const createdAt = "2026-10-31T10:00:00.000Z";
const saveLabel = "Enregistrer cette commande sur cet appareil";
let cleanup: (() => Promise<void>) | undefined;
beforeEach(() => {
  window.localStorage.clear();
  document.cookie = "openstore-locale=fr; path=/";
});
afterEach(async () => {
  await cleanup?.();
  cleanup = undefined;
  vi.restoreAllMocks();
});
async function render() {
  const view = await renderTest(
    <I18nProvider initialLocale="fr">
      <OrderPlaced token={publicToken} phone="0555550199" createdAt={createdAt} />
    </I18nProvider>,
  );
  cleanup = view.unmount;
  return view;
}

describe("explicit order saving", () => {
  it("offers saving with a shared-device warning and never writes on mount", async () => {
    const write = vi.spyOn(Storage.prototype, "setItem");
    const view = await render();
    expect(view.container).toHaveTextContent(saveLabel);
    expect(view.container).toHaveTextContent("Évite cette option sur un appareil partagé.");
    expect(view.container).not.toHaveTextContent("Commande enregistrée sur cet appareil");
    expect(view.container).not.toHaveTextContent("Enregistrement local indisponible");
    expect(write).not.toHaveBeenCalled();
    expect(view.container.querySelector("a")).toHaveAttribute("href", `/order/${publicToken}`);
    expect(view.container).toHaveTextContent("Suivre ma commande");
  });
  it("saves only token/date on click, confirms success and prevents duplicate entries", async () => {
    const view = await render();
    const button = [...view.container.querySelectorAll("button")].find(
      (item) => item.textContent === saveLabel,
    )!;
    await act(async () => {
      button.click();
      button.click();
    });
    expect(readSavedOrders()).toEqual([{ publicToken, createdAt }]);
    expect(JSON.parse(window.localStorage.getItem(SAVED_ORDERS_KEY)!)).toEqual([
      { publicToken, createdAt },
    ]);
    expect(window.localStorage.getItem(SAVED_ORDERS_KEY)).not.toContain("0555550199");
    expect(view.container).toHaveTextContent("Commande enregistrée sur cet appareil");
    expect(
      [...view.container.querySelectorAll("button")].some(
        (button) => button.textContent === saveLabel,
      ),
    ).toBe(false);
    expect(view.container.querySelector("a")).toHaveAttribute("href", `/order/${publicToken}`);
  });
  it("recognizes a previously saved order without another write or duplicate", async () => {
    saveOrderLocally({ publicToken, createdAt });
    const write = vi.spyOn(Storage.prototype, "setItem");
    const view = await render();
    expect(view.container).toHaveTextContent("Commande enregistrée sur cet appareil");
    expect(
      [...view.container.querySelectorAll("button")].some(
        (button) => button.textContent === saveLabel,
      ),
    ).toBe(false);
    expect(readSavedOrders()).toHaveLength(1);
    expect(write).not.toHaveBeenCalled();
  });
  it("keeps confirmation and tracking accessible when saving fails, and allows retry", async () => {
    const write = vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new Error("quota");
    });
    const view = await render();
    await view.click(saveLabel);
    expect(view.container).toHaveTextContent("Enregistrement local indisponible");
    expect(view.container).toHaveTextContent("Commande reçue");
    expect(view.container).toHaveTextContent("Suivre ma commande");
    expect(view.container.querySelector("a")).toHaveAttribute("href", `/order/${publicToken}`);
    expect(readSavedOrders()).toEqual([]);
    write.mockRestore();
    await view.click(saveLabel);
    expect(readSavedOrders()).toEqual([{ publicToken, createdAt }]);
    expect(view.container).toHaveTextContent("Commande enregistrée sur cet appareil");
  });
});
