import "@tanstack/react-start/server-only";
import { timingSafeEqual } from "node:crypto";
import { erpEnabled } from "./config";
import { runFinanceSync } from "./sync";

export async function financeCron(request: Request) {
  const headers = { "Cache-Control": "private, no-store", "X-Robots-Tag": "noindex" };
  const secret = process.env.CRON_SECRET;
  const actual = Buffer.from(request.headers.get("authorization") || "");
  const expected = Buffer.from(`Bearer ${secret || ""}`);
  if (!secret || actual.length !== expected.length || !timingSafeEqual(actual, expected)) {
    return new Response("Unauthorized", { status: 401, headers });
  }
  if (!erpEnabled()) return Response.json({ enabled: false }, { headers });
  const result = await runFinanceSync();
  return Response.json(result, { status: result.ok ? 200 : 503, headers });
}
