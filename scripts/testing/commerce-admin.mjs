// Loopback-only HTTP adapter. Every decision and mutation still runs through PostgreSQL RLS.
export async function handleCommerce(db, req, path, body, send, adminId) {
  const admin = req.headers.authorization === "Bearer synthetic-admin-token";
  const reviews = path.endsWith("/reviews");
  const rpc = path.match(
    /\/rpc\/(admin_commerce_analytics|admin_setup_audit|admin_commerce_phone_history|pack_availability)$/,
  )?.[1];
  const table = path.match(
    /\/(orders|blocked_phones|order_export_targets|order_export_jobs)$/,
  )?.[1];
  if (!reviews && !(admin && (rpc || table))) return false;
  const url = new URL(req.url, "http://127.0.0.1");
  const eq = (name) => url.searchParams.get(name)?.replace(/^eq\./, "") ?? null;
  const offset = Math.max(0, Number(url.searchParams.get("offset")) || 0);
  const limit = Math.min(1000, Number(url.searchParams.get("limit")) || 1000);
  await db.exec(
    `set role ${admin ? "authenticated" : "anon"};select set_config('request.jwt.claim.sub','${admin ? adminId : ""}',false)`,
  );
  try {
    if (rpc) {
      const queries = {
        admin_commerce_analytics: [
          "select admin_commerce_analytics($1,$2,$3::date,$4::date) data",
          [body.p_days ?? 30, body.p_min_orders ?? 3, body.p_from ?? null, body.p_to ?? null],
        ],
        admin_setup_audit: ["select admin_setup_audit() data", []],
        admin_commerce_phone_history: [
          "select coalesce(jsonb_agg(h),'[]') data from admin_commerce_phone_history($1::text[]) h",
          [body.p_phones],
        ],
        pack_availability: [
          "select coalesce(jsonb_agg(h),'[]') data from pack_availability($1::uuid) h",
          [body.p_product],
        ],
      };
      send((await db.query(...queries[rpc])).rows[0].data);
    } else if (reviews && req.method === "POST") {
      await db.query(
        "insert into reviews(product_id,customer_name,rating,comment) values($1,$2,$3,$4)",
        [body.product_id, body.customer_name, body.rating, body.comment],
      );
      send(null, 201);
    } else if (reviews && req.method === "PATCH" && admin) {
      await db.query("update reviews set is_approved=$1 where id=$2", [body.is_approved, eq("id")]);
      send(null);
    } else if (reviews) {
      const result = await db.query(
        "select to_jsonb(r)||jsonb_build_object('products',jsonb_build_object('name',p.name,'slug',p.slug)) data from reviews r left join products p on p.id=r.product_id where ($1::uuid is null or r.product_id=$1::uuid) and ($2::boolean is null or r.is_approved=$2::boolean) order by r.created_at desc",
        [eq("product_id"), eq("is_approved")],
      );
      const rows = result.rows.map((r) => r.data);
      send(req.method === "HEAD" ? null : rows.slice(offset, offset + limit), 200, {
        "Content-Range": `0-${Math.max(0, rows.length - 1)}/${rows.length}`,
      });
    } else if (table === "orders") {
      const result = await db.query(
        "select to_jsonb(o)||jsonb_build_object('order_items',coalesce((select jsonb_agg(i) from order_items i where i.order_id=o.id),'[]')) data from orders o where ($1::uuid is null or o.id=$1::uuid) and ($2::text is null or o.status::text=$2) order by o.created_at desc,o.id",
        [eq("id"), eq("status")],
      );
      const rows = result.rows.map((r) => r.data);
      send(req.method === "HEAD" ? null : rows.slice(offset, offset + limit), 200, {
        "Content-Range": `0-${Math.max(0, rows.length - 1)}/${rows.length}`,
      });
    } else if (table === "blocked_phones") {
      if (req.method === "POST") {
        await db.query("insert into blocked_phones(phone) values($1)", [body.phone]);
        send(null, 201);
      } else if (req.method === "DELETE") {
        await db.query("delete from blocked_phones where phone=$1", [eq("phone")]);
        send(null);
      } else {
        const rows = (await db.query("select phone from blocked_phones order by phone")).rows;
        send(rows.slice(offset, offset + limit), 200, {
          "Content-Range": `0-${Math.max(0, rows.length - 1)}/${rows.length}`,
        });
      }
    } else if (table === "order_export_targets" || table === "order_export_jobs") send([]);
  } catch (error) {
    send({ message: error.message, code: error.code }, 400);
  } finally {
    await db.exec("reset role; select set_config('request.jwt.claim.sub','',false)");
  }
  return true;
}
