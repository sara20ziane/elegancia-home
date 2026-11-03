// Test-only adapter. The fixed token has no meaning outside the loopback harness.
// All writes below execute the versioned RPCs with the authenticated PostgreSQL role.
export const testAdminId = "cccccccc-1111-4111-8111-111111111111";
export async function handleCatalogAdmin(db, req, path, body, send) {
  const admin = req.headers.authorization === "Bearer synthetic-admin-token";
  if (!admin) return false;
  if (path === "/auth/v1/user") {
    send({
      id: testAdminId,
      aud: "authenticated",
      role: "authenticated",
      email: "catalog@example.test",
    });
    return true;
  }
  if (!/\/(admin_users|products|categories)$/.test(path) && !/\/rpc\/catalog_/.test(path))
    return false;
  await db.exec(
    `set role authenticated; select set_config('request.jwt.claim.sub','${testAdminId}',false)`,
  );
  try {
    if (path.endsWith("/admin_users")) send({ role: "owner" });
    else if (path.endsWith("/categories"))
      send((await db.query("select * from categories where is_active order by sort_order")).rows);
    else if (path.endsWith("/products")) {
      const url = new URL(req.url, "http://127.0.0.1");
      const id = url.searchParams.get("id")?.replace(/^eq\./, "");
      const result = await db.query(
        `select to_jsonb(p)||jsonb_build_object(
        'categories',null,'product_categories',coalesce((select jsonb_agg(jsonb_build_object('category_id',pc.category_id)) from product_categories pc where pc.product_id=p.id),'[]'),
        'product_variants',coalesce((select jsonb_agg(to_jsonb(v)||jsonb_build_object('variant_images',coalesce((select jsonb_agg(i) from variant_images i where i.variant_id=v.id),'[]')) order by v.sort_order) from product_variants v where v.product_id=p.id),'[]')) data
        from products p where ($1::uuid is null or p.id=$1::uuid) order by p.created_at desc`,
        [id ?? null],
      );
      const rows = result.rows.map((row) => row.data);
      send(req.headers.accept?.includes("vnd.pgrst.object") ? (rows[0] ?? null) : rows, 200, {
        "Content-Range": `0-${Math.max(0, rows.length - 1)}/${rows.length}`,
      });
    } else if (path.endsWith("/rpc/catalog_generate"))
      send(
        (await db.query("select catalog_generate($1::jsonb) data", [JSON.stringify(body.p)]))
          .rows[0].data,
      );
    else if (path.endsWith("/rpc/catalog_presets"))
      send(
        (
          await db.query("select catalog_presets($1::jsonb) data", [
            body.p ? JSON.stringify(body.p) : null,
          ])
        ).rows[0].data,
      );
    else if (path.endsWith("/rpc/catalog_apply_common"))
      send(
        (
          await db.query("select catalog_apply_common($1::uuid,$2::jsonb) data", [
            body.p_product,
            JSON.stringify(body.p_patch),
          ])
        ).rows[0].data,
      );
    else send({ message: "Unsupported test operation" }, 400);
  } catch (error) {
    send({ message: error.message, code: error.code }, 400);
  } finally {
    await db.exec("reset role");
  }
  return true;
}
