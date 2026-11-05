import "@tanstack/react-start/server-only";
import { assertAdmin } from "./packers-auth";
import { isTokenShaped } from "../order";
import { ORDER_SELECT, type AdminOrder } from "../admin";
import { renderShippingPdf } from "../shipping-pdf";

const PRIVATE = {
  "Cache-Control": "private, no-store, max-age=0",
  "X-Robots-Tag": "noindex, nofollow",
  "Referrer-Policy": "no-referrer",
  "X-Content-Type-Options": "nosniff",
};
export async function shippingResponse(request: Request): Promise<Response> {
  const fail = (status: number, message = "Étiquettes indisponibles.") =>
    new Response(message, { status, headers: PRIVATE });
  const token = request.headers.get("authorization")?.match(/^Bearer (.+)$/)?.[1];
  if (!token) return fail(401);
  try {
    const { supabase } = await assertAdmin(token);
    if (!supabase) return fail(403);
    const search = new URL(request.url).searchParams;
    const id = search.get("id");
    if (id && !isTokenShaped(id)) return fail(400);
    const format = search.get("format") === "a4" ? "a4" : "label";
    let query = supabase
      .from("orders")
      .select(ORDER_SELECT)
      .order("created_at")
      .order("id")
      .limit(201);
    query = id ? query.eq("id", id) : query.eq("status", "confirmed");
    const result = await query;
    if (result.error) return fail(503);
    const orders = (result.data ?? []) as unknown as AdminOrder[];
    if (!orders.length) return fail(404);
    if (orders.length > 200)
      return fail(422, "Plus de 200 commandes : imprimez individuellement ou réduisez le lot.");
    const settings = await supabase.from("store_settings").select("name").eq("id", 1).single();
    if (settings.error) return fail(503);
    const bytes = await renderShippingPdf(orders, settings.data.name, format);
    return new Response(new Uint8Array(bytes).buffer, {
      headers: {
        ...PRIVATE,
        "Content-Type": "application/pdf",
        "Content-Disposition": 'attachment; filename="etiquettes-internes-elegancia.pdf"',
      },
    });
  } catch {
    return fail(503);
  }
}
