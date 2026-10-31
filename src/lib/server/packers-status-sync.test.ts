import { beforeEach, describe, expect, it, vi } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
vi.mock("@tanstack/react-start/server-only", () => ({}));
import { syncPackersStatuses } from "./packers-status-sync";

const original = {
  id: "1",
  carrier: "Packers",
  tracking_number: "TRACK",
  status: "shipped",
  delivered_at: null,
  refused_at: null,
  refused_reason: null,
};

function database(options: { stale?: boolean; saveError?: boolean; order?: typeof original } = {}) {
  let stored = { ...original, ...options.order };
  const writes: Record<string, unknown>[] = [];
  const filters: Record<string, unknown> = {};
  const query = {
    select: vi.fn(() => query),
    eq: vi.fn(() => query),
    not: vi.fn(() => query),
    in: vi.fn(() => query),
    order: vi.fn(() => query),
    limit: vi.fn(async () => ({ data: [{ ...stored }], error: null })),
  };
  const update = vi.fn((patch: Record<string, unknown>) => {
    const save = {
      eq: vi.fn((key: string, value: unknown) => {
        filters[key] = value;
        return save;
      }),
      select: vi.fn(async () => {
        if (options.saveError) return { data: null, error: { message: "denied" } };
        if (
          options.stale ||
          Object.entries(filters).some(
            ([key, value]) => stored[key as keyof typeof stored] !== value,
          )
        ) {
          return { data: [], error: null };
        }
        writes.push(patch);
        stored = { ...stored, ...patch };
        return { data: [{ id: stored.id }], error: null };
      }),
    };
    return save;
  });
  const client = { from: vi.fn(() => ({ ...query, update })) } as unknown as SupabaseClient;
  return { client, writes, update, filters };
}

beforeEach(() => {
  vi.stubEnv(
    "PACKERS_VERIFIED_STATUS_RULES",
    JSON.stringify([
      { raw: "fixture-refused", target: "refused" },
      { raw: "fixture-delivered", target: "delivered" },
      { raw: "fixture-received", target: "returned", physicalReturnReceived: true },
    ]),
  );
});

describe("Packers synchronization", () => {
  it("leaves orders untouched on network failure", async () => {
    const db = database();
    const result = await syncPackersStatuses(db.client, {
      getOrder: vi.fn().mockRejectedValue(new Error("offline")),
    });
    expect(result).toMatchObject({ ok: true, failed: 1, changed: 0 });
    expect(db.update).not.toHaveBeenCalled();
  });
  it("observes unknown status without changing business state", async () => {
    const db = database();
    expect(
      await syncPackersStatuses(db.client, {
        getOrder: async () => ({ tracking: "TRACK", status: "unknown" }),
      }),
    ).toMatchObject({ changed: 0, unrecognized: 1 });
    expect(db.writes[0]).not.toHaveProperty("status");
  });
  it.each(["fixture-refused", "fixture-delivered", "fixture-received"])(
    "applies %s only once",
    async (status) => {
      const db = database();
      const carrier = { getOrder: vi.fn(async () => ({ tracking: "TRACK", status })) };
      expect(await syncPackersStatuses(db.client, carrier)).toMatchObject({ changed: 1 });
      expect(await syncPackersStatuses(db.client, carrier)).toMatchObject({ changed: 0 });
      expect(db.writes).toHaveLength(1);
      expect(db.filters).toMatchObject({
        carrier: "Packers",
        tracking_number: "TRACK",
        status: "shipped",
      });
    },
  );
  it("does not count a concurrent update or rejected write as a transition", async () => {
    for (const options of [{ stale: true }, { saveError: true }]) {
      const db = database(options);
      expect(
        await syncPackersStatuses(db.client, {
          getOrder: async () => ({ tracking: "TRACK", status: "fixture-refused" }),
        }),
      ).toMatchObject({ changed: 0 });
      expect(db.writes).toHaveLength(0);
    }
  });
  it("never calls Packers for missing tracking or a different carrier", async () => {
    for (const order of [
      { ...original, carrier: "Other" },
      { ...original, tracking_number: "" },
    ]) {
      const db = database({ order });
      const getOrder = vi.fn();
      await syncPackersStatuses(db.client, { getOrder });
      expect(getOrder).not.toHaveBeenCalled();
    }
  });
});
