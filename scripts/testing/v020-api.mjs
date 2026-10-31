// Disposable HTTP fixtures for browser tests. Never connects to a real Supabase project.
import http from "node:http";
import { testProduct, testVariant } from "./v020-fixtures.ts";
const product = structuredClone(testProduct);
product.product_categories = [];
product.created_at = new Date().toISOString();
product.product_variants.forEach((v) =>
  v.variant_images.forEach((image, i) => {
    image.url = `http://127.0.0.1:59999/image/${i}.svg`;
  }),
);
const orders = [];
const uploads = [];
let sequence = 0;
const settings = {
  id: 1,
  name: "Elegancia Home",
  name_fr: "Elegancia Home",
  accepts_cod: true,
  delivery_wilayas: ["Alger"],
  whatsapp: "0555550199",
  phone: "0555550199",
  free_shipping_threshold: 0,
  delivery_fee_flat: 0,
  currency: "DZD",
};
const adminId = "00000000-0000-4000-8000-000000000001";
const user = {
  id: adminId,
  email: "test@example.invalid",
  aud: "authenticated",
  role: "authenticated",
  app_metadata: { provider: "email" },
  user_metadata: {},
};
const jwt = [
  Buffer.from('{"alg":"HS256","typ":"JWT"}').toString("base64url"),
  Buffer.from(
    JSON.stringify({
      sub: adminId,
      role: "authenticated",
      aud: "authenticated",
      exp: Math.floor(Date.now() / 1000) + 3600,
    }),
  ).toString("base64url"),
  "test",
].join(".");
http
  .createServer(async (req, res) => {
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Access-Control-Allow-Headers", "*");
    res.setHeader("Access-Control-Allow-Methods", "GET,POST,PATCH,DELETE,HEAD,OPTIONS");
    res.setHeader("Access-Control-Expose-Headers", "Content-Range");
    res.setHeader("Content-Type", "application/json");
    if (req.method === "OPTIONS") {
      res.end();
      return;
    }
    const url = new URL(req.url, "http://localhost");
    let body = "";
    for await (const part of req) body += part;
    let input = {};
    try {
      input = JSON.parse(body || "{}");
    } catch {}
    const send = (data, status = 200) => {
      res.statusCode = status;
      res.end(JSON.stringify(data));
    };
    if (url.pathname.startsWith("/image/")) {
      res.setHeader("Content-Type", "image/svg+xml");
      res.end(
        `<svg xmlns="http://www.w3.org/2000/svg" width="800" height="600"><rect width="800" height="600" fill="${url.pathname.includes("0") ? "#c9b6a5" : "#bdcad0"}"/></svg>`,
      );
      return;
    }
    if (url.pathname === "/fixture/state") return send({ orders, uploads });
    if (url.pathname === "/fixture/reset") {
      orders.length = 0;
      uploads.length = 0;
      sequence = 0;
      return send({ ok: true });
    }
    if (url.pathname.startsWith("/auth/v1/token"))
      return send({
        access_token: jwt,
        refresh_token: "test-refresh",
        token_type: "bearer",
        expires_in: 3600,
        user,
      });
    if (url.pathname === "/auth/v1/user") return send({ user, ...user });
    if (url.pathname.includes("/storage/v1/object/")) {
      uploads.push({
        path: url.pathname,
        encoded: /Content-Type: image\/(webp|jpeg)/i.test(body),
        bytes: body.length,
      });
      return send({ Key: "test-image.webp", Id: "test-object" });
    }
    const table = url.pathname.split("/").pop();
    if (url.pathname.includes("/rpc/")) {
      if (table === "place_order") {
        const token = `aaaaaaaa-aaaa-4aaa-8aaa-${String(++sequence).padStart(12, "0")}`;
        const lines = (input.p_items ?? []).map((line) => ({
          id: line.variant_id,
          variant_id: line.variant_id,
          product_name: product.name,
          variant_label: product.product_variants.find((v) => v.id === line.variant_id)?.size,
          quantity: line.quantity,
          unit_price: testVariant.price,
        }));
        const subtotal = lines.reduce((sum, line) => sum + line.quantity * line.unit_price, 0);
        orders.push({
          id: token,
          public_token: token,
          token,
          ...input.p_customer,
          created_at: new Date().toISOString(),
          order_source: "website",
          status: "pending",
          carrier: null,
          tracking_number: null,
          tracking_url: null,
          subtotal,
          delivery_fee: 600,
          total: subtotal + 600,
          items: lines,
          order_items: lines,
        });
        return send(token);
      }
      if (table === "track_order")
        return send(orders.find((o) => o.public_token === input.p_token) ?? null);
      if (table === "delete_elegancia_order") {
        const i = orders.findIndex(
          (o) => o.id === input.p_id && o.public_token === input.p_reference,
        );
        if (i >= 0) orders.splice(i, 1);
        return send(null);
      }
      if (table === "catalogue_page")
        return send({
          products: [product],
          total: 1,
          facets: { sizes: ["Queen", "King"], colors: [], minPrice: 7500, maxPrice: 7500 },
        });
      if (table === "admin_analytics")
        return send({
          days: 30,
          totals: { orders: orders.length, confirmedValue: 0, refused: 0 },
          funnel: {},
          revenue: [],
          byWilaya: [],
          topProducts: [],
          lowStock: [],
        });
      if (table === "elegancia_schema_version") return send(1);
      if (table === "admin_exists") return send(true);
      return send([]);
    }
    if (table === "store_settings") return send(settings);
    if (table === "products") {
      res.setHeader("Content-Range", "0-0/1");
      return send(url.searchParams.has("slug") || url.searchParams.has("id") ? product : [product]);
    }
    if (table === "admin_users") return send({ role: "owner" });
    if (table === "delivery_zones")
      return send([{ wilaya: "Alger", fee: 600, stopdesk_fee: 400, eta_days: 3, is_active: true }]);
    if (table === "orders") {
      res.setHeader("Content-Range", `0-${Math.max(0, orders.length - 1)}/${orders.length}`);
      return send(req.method === "HEAD" ? null : orders);
    }
    if (table === "product_variants") return send(product.product_variants);
    if (table === "variant_images") {
      if (req.method === "POST")
        for (const image of input) {
          const variant = product.product_variants.find((v) => v.id === image.variant_id);
          variant?.variant_images.push({ ...image, id: `uploaded-${Date.now()}` });
        }
      return send([]);
    }
    return send([]);
  })
  .listen(59999, "127.0.0.1");
