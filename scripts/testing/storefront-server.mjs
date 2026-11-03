import { createServer } from "node:http";
import { nativeTestDatabase } from "./native-database.ts";
import { product, productId, settings, variants } from "./storefront-fixtures.mjs";

// This is an HTTP adapter for tests, not a PostgREST/Auth/Storage emulator.
// SQL checkout and tracking use the real versioned RPCs in ephemeral PostgreSQL WASM.
const db = await nativeTestDatabase();
await db.query(
  "update store_settings set accepts_cod=true,delivery_wilayas=array['Alger'] where id=1",
);
await db.query(
  "insert into delivery_zones(wilaya,fee,stopdesk_fee,is_active) values('Alger',600,400,true) on conflict(wilaya) do update set fee=600,stopdesk_fee=400,is_active=true",
);
await db.query(
  "insert into products(id,slug,name,name_fr,status) values($1,$2,$3,$4,'published')",
  [productId, product.slug, product.name, product.name_fr],
);
for (const variant of variants)
  await db.query(
    "insert into product_variants(id,product_id,size,color_name,price,stock,fabric,set_type,piece_count) values($1,$2,$3,$4,$5,$6,$7,$8,$9)",
    [
      variant.id,
      productId,
      variant.size,
      variant.color_name,
      variant.price,
      variant.stock,
      variant.fabric,
      variant.set_type,
      variant.piece_count,
    ],
  );
let queue = Promise.resolve();

async function handle(req, res) {
  const path = new URL(req.url, "http://127.0.0.1:54329").pathname;
  const send = (data, status = 200) => {
    res.writeHead(status, {
      "Content-Type": "application/json",
      "Access-Control-Allow-Origin": "http://127.0.0.1:8080",
      "Access-Control-Allow-Headers": "*",
      "Access-Control-Allow-Methods": "GET,POST,OPTIONS",
    });
    res.end(JSON.stringify(data));
  };
  if (req.method === "OPTIONS") return send(null);
  if (path === "/health") return send({ ready: true });
  let raw = "";
  for await (const chunk of req) {
    raw += chunk;
    if (raw.length > 100000) return send({ message: "Too large" }, 413);
  }
  const body = raw ? JSON.parse(raw) : {};
  if (path.endsWith("/rpc/catalogue_page"))
    return send({
      products: [product],
      total: 1,
      facets: {
        sizes: variants.map((v) => v.size),
        colors: ["Vert sauge"],
        priceMin: 9500,
        priceMax: 9500,
      },
    });
  if (path.endsWith("/store_settings")) return send(settings);
  if (path.endsWith("/products")) return send(product);
  if (path.endsWith("/delivery_zones"))
    return send([
      {
        id: "test-zone",
        wilaya: "Alger",
        fee: 600,
        stopdesk_fee: 400,
        eta_days: 3,
        is_active: true,
      },
    ]);
  if (path.endsWith("/rpc/admin_exists")) return send(true);
  if (
    /\/(reviews|categories|size_guides|admin_users)$/.test(path) ||
    path.endsWith("/rpc/category_product_counts")
  )
    return send([]);
  if (path.endsWith("/rpc/place_order") || path.endsWith("/rpc/track_order")) {
    // Queue the role change and query together so concurrent HTTP requests cannot share role state.
    queue = queue.then(async () => {
      await db.exec("set role anon");
      try {
        const result = path.endsWith("/place_order")
          ? await db.query("select place_order($1::jsonb,$2::jsonb) data", [
              JSON.stringify(body.p_customer),
              JSON.stringify(body.p_items),
            ])
          : await db.query("select track_order($1::uuid) data", [body.p_token]);
        send(result.rows[0].data);
      } catch (error) {
        send({ message: error.message, code: error.code, hint: error.hint }, 400);
      } finally {
        await db.exec("reset role");
      }
    });
    return queue;
  }
  return send({ message: "Access denied in isolated test adapter" }, 403);
}
createServer((req, res) => {
  void handle(req, res).catch(() => {
    res.writeHead(500);
    res.end();
  });
}).listen(54329, "127.0.0.1", () => process.stdout.write("Synthetic E2E backend ready\n"));
