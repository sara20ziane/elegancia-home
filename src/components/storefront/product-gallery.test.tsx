import { act, useState } from "react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { renderTest } from "../../../scripts/testing/react-render";
import { I18nProvider } from "@/lib/i18n-context";
import { ProductGallery } from "./product-gallery";
vi.mock("./image-lightbox", () => ({ ImageLightbox: () => null }));
let cleanup: (() => Promise<void>) | undefined;
beforeEach(() => {
  document.cookie = "openstore-locale=fr; path=/";
  Object.defineProperty(HTMLElement.prototype, "scrollTo", { configurable: true, value: vi.fn() });
});
afterEach(async () => {
  await cleanup?.();
  cleanup = undefined;
  vi.restoreAllMocks();
});
function Harness() {
  const [active, setActive] = useState(0);
  return (
    <I18nProvider initialLocale="fr">
      <ProductGallery
        images={["/a.webp", "/b.webp", "/c.webp"]}
        alt="Test product"
        active={active}
        onSelect={setActive}
      />
    </I18nProvider>
  );
}
it("navigates by arrows, thumbnails, keyboard and native mobile scroll", async () => {
  const view = await renderTest(<Harness />);
  cleanup = view.unmount;
  const click = async (label: string) => {
    await act(async () => {
      (view.container.querySelector(`[aria-label="${label}"]`) as HTMLElement).click();
    });
  };
  await click("Suivant");
  expect(view.container.querySelector('[aria-label="Description 2"]')).toHaveAttribute(
    "aria-current",
    "true",
  );
  await click("Description 3");
  expect(view.container.querySelector('[aria-label="Description 3"]')).toHaveAttribute(
    "aria-current",
    "true",
  );
  const track = view.container.querySelector('[tabindex="0"]') as HTMLElement;
  await act(async () =>
    track.dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowLeft", bubbles: true })),
  );
  expect(view.container.querySelector('[aria-label="Description 2"]')).toHaveAttribute(
    "aria-current",
    "true",
  );
  Object.defineProperty(track, "clientWidth", { value: 300 });
  Object.defineProperty(track, "scrollLeft", { value: 0, writable: true });
  await act(async () => track.dispatchEvent(new Event("scroll", { bubbles: true })));
  expect(view.container.querySelector('[aria-label="Description 1"]')).toHaveAttribute(
    "aria-current",
    "true",
  );
});
it("shows a stable empty frame without navigation when no image exists", async () => {
  const view = await renderTest(
    <ProductGallery images={[]} active={0} alt="Empty" onSelect={() => {}} />,
  );
  cleanup = view.unmount;
  expect(view.container.querySelector("button")).toBeNull();
});
