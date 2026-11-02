import { PGlite } from "@electric-sql/pglite";
import { readFile, readdir } from "node:fs/promises";
import { resolve } from "node:path";

/** Real PostgreSQL WASM; external Supabase services are explicit local stubs. */
export async function nativeTestDatabase() {
  const db = new PGlite();
  await db.exec(await readFile("supabase/tests/native-bootstrap.sql", "utf8"));
  const directory = resolve("supabase/migrations");
  for (const name of (await readdir(directory)).filter((file) => file.endsWith(".sql")).sort()) {
    const sql = (await readFile(resolve(directory, name), "utf8")).replace(
      /^create extension[^;]+;/gim,
      "",
    );
    await db.exec(sql);
  }
  return db;
}
