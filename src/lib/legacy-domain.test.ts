import { describe, expect, it } from "vitest";
import { redirectLegacyDomain } from "./legacy-domain";

describe("redirectLegacyDomain", () => {
  it.each(["GET", "HEAD"])("redirects %s links without losing their paths or queries", (method) => {
    const request = new Request("https://elegancia-home.vercel.app/track?source=a%2Fb", { method });
    const response = redirectLegacyDomain(request);

    expect(response?.status).toBe(308);
    expect(response?.headers.get("location")).toBe(
      "https://cotonia-home.vercel.app/track?source=a%2Fb",
    );
    expect(response?.headers.get("referrer-policy")).toBe("no-referrer");
    expect(response?.headers.get("cache-control")).toBe("no-store");
  });

  it("keeps the destination on the new host even with two initial path separators", () => {
    const request = new Request("https://elegancia-home.vercel.app//example.com/path");
    const response = redirectLegacyDomain(request);

    expect(response?.headers.get("location")).toBe(
      "https://cotonia-home.vercel.app//example.com/path",
    );
  });

  it.each([
    ["https://elegancia-home.vercel.app/api", "GET"],
    ["https://elegancia-home.vercel.app/api/shipping-labels", "GET"],
    ["https://elegancia-home.vercel.app/checkout", "POST"],
    ["https://cotonia-home.vercel.app/product/parure", "GET"],
    ["https://branch-preview.vercel.app/product/parure", "GET"],
  ])("preserves %s %s", (url, method) => {
    expect(redirectLegacyDomain(new Request(url, { method }))).toBeUndefined();
  });
});
