import { QueryClient } from "@tanstack/react-query";
import { afterEach, expect, it, vi } from "vitest";
import { deleteOrder } from "./admin-delete-order";
import { latestVersionQuery, schemaVersionQuery } from "./version";
const { client } = vi.hoisted(() => {
  const client = { rpc: vi.fn() };
  return { client };
});
vi.mock("./supabase/client", () => ({ getSupabase: () => client }));
afterEach(() => {
  vi.clearAllMocks();
  vi.unstubAllGlobals();
});
it("keeps the Supabase receiver for protected deletion and schema reads", async () => {
  client.rpc.mockImplementation(function (this: unknown, name: string) {
    expect(this).toBe(client);
    return Promise.resolve({ data: name === "elegancia_schema_version" ? 1 : null, error: null });
  });
  await deleteOrder("id", "reference");
  expect(client.rpc).toHaveBeenCalledWith("delete_elegancia_order", {
    p_id: "id",
    p_reference: "reference",
  });
  const queries = new QueryClient();
  expect(await queries.fetchQuery(schemaVersionQuery())).toBe(1);
  queries.clear();
});
it("rejects failed deletion and reports a missing schema marker as version zero", async () => {
  client.rpc.mockResolvedValue({
    data: null,
    error: { code: "PGRST202", message: "Missing migration" },
  });
  await expect(deleteOrder("id", "reference")).rejects.toThrow("Missing migration");
  const queries = new QueryClient();
  expect(await queries.fetchQuery(schemaVersionQuery())).toBe(0);
  queries.clear();
});
it("accepts published releases through a fixed read-only GitHub URL", async () => {
  const fetch = vi
    .fn()
    .mockResolvedValue(
      new Response(JSON.stringify({ tag_name: "v0.3.0", html_url: "https://untrusted.invalid" })),
    );
  vi.stubGlobal("fetch", fetch);
  const queries = new QueryClient();
  expect(await queries.fetchQuery(latestVersionQuery())).toEqual({
    version: "v0.3.0",
    url: "https://github.com/Meykiio/openstore-dz/releases/tag/v0.3.0",
  });
  expect(fetch).toHaveBeenCalledTimes(1);
  queries.clear();
});
it.each([{ tag_name: "v0.3.0", prerelease: true }, { tag_name: "../../other" }])(
  "ignores invalid release metadata %j",
  async (release) => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(JSON.stringify(release))));
    const queries = new QueryClient();
    expect(await queries.fetchQuery(latestVersionQuery())).toBeNull();
    queries.clear();
  },
);
