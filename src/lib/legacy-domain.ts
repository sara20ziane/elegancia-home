import { SITE_URL } from "./seo";

const LEGACY_HOST = "elegancia-home.vercel.app";

export function redirectLegacyDomain(request: Request): Response | undefined {
  if (request.method !== "GET" && request.method !== "HEAD") return;

  const from = new URL(request.url);
  if (from.hostname !== LEGACY_HOST || /^\/api(?:\/|$)/i.test(from.pathname)) return;

  const to = new URL(SITE_URL);
  to.pathname = from.pathname;
  to.search = from.search;
  return new Response(null, {
    status: 308,
    headers: {
      Location: to.href,
      "Cache-Control": "no-store",
      "Referrer-Policy": "no-referrer",
    },
  });
}
