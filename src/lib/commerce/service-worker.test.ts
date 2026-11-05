// @vitest-environment node
import { readFileSync } from "node:fs";
import { runInNewContext } from "node:vm";
import { expect, it, vi } from "vitest";
const code = readFileSync("public/sw.js", "utf8");
function worker() {
  const listeners = new Map<string, (event: unknown) => void>();
  const fetcher = vi.fn(async (_request: unknown) => new Response("network"));
  const cache = { match: vi.fn(async () => undefined), put: vi.fn(), addAll: vi.fn() };
  const caches = {
    open: vi.fn(async () => cache),
    match: vi.fn(async () => new Response("offline without catalogue")),
    keys: vi.fn(async () => ["unrelated-cache", "elegancia-old", "openstore-shell"]),
    delete: vi.fn(),
  };
  const self = {
    location: { origin: "https://shop.test" },
    addEventListener: (name: string, handler: (event: unknown) => void) =>
      listeners.set(name, handler),
    clients: { claim: vi.fn() },
    skipWaiting: vi.fn(),
  };
  runInNewContext(code, { self, caches, fetch: fetcher, URL, Response });
  const request = (path: string, mode = "navigate") => {
    let response: Promise<Response> | undefined;
    listeners.get("fetch")!({
      request: {
        url: path.startsWith("http") ? path : `https://shop.test${path}`,
        method: "GET",
        mode,
      },
      respondWith: (value: Promise<Response>) => {
        response = value;
      },
    });
    return response;
  };
  return { listeners, request, fetcher, cache, caches, self };
}
it("ne met jamais de HTML catalogue en cache et ne montre aucun stock hors connexion", async () => {
  const sw = worker();
  expect(await (await sw.request("/catalogue"))?.text()).toBe("network");
  expect(sw.cache.put).not.toHaveBeenCalled();
  sw.fetcher.mockRejectedValue(new Error("offline"));
  expect(await (await sw.request("/product/parure"))?.text()).toBe("offline without catalogue");
  expect(sw.caches.match).toHaveBeenCalledWith("/offline.html");
});
it("ignore admin, API, checkout, suivi, JSON et Supabase", () => {
  const sw = worker();
  for (const path of [
    "/admin",
    "/admin/settings",
    "/api/shipping-labels",
    "/checkout",
    "/order/token",
    "/track",
    "/login",
    "/setup",
  ])
    expect(sw.request(path)).toBeUndefined();
  expect(sw.request("https://project.supabase.co/rest/v1/orders")).toBeUndefined();
  expect(sw.request("/assets/customer.json", "cors")).toBeUndefined();
  expect(sw.request("/products/private.jpg", "cors")).toBeUndefined();
});
it("préserve les caches étrangers et attend une action pour activer une mise à jour", async () => {
  const sw = worker();
  let ready: Promise<unknown> | undefined;
  sw.listeners.get("activate")!({
    waitUntil: (value: Promise<unknown>) => {
      ready = value;
    },
  });
  await ready;
  expect(sw.caches.delete).toHaveBeenCalledWith("elegancia-old");
  expect(sw.caches.delete).not.toHaveBeenCalledWith("unrelated-cache");
  expect(sw.self.skipWaiting).not.toHaveBeenCalled();
  sw.listeners.get("message")!({ data: { type: "SKIP_WAITING" } });
  expect(sw.self.skipWaiting).toHaveBeenCalledTimes(1);
});
