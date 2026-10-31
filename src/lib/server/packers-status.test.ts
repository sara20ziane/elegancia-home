import { describe, expect, it } from "vitest";
import {
  eligiblePackersOrder,
  mapPackersStatus,
  packersStatusPatch,
  parsePackersOrder,
  readVerifiedPackersRules,
  type SyncOrder,
  type VerifiedPackersRule,
} from "./packers-status";

// Synthetic contract fixtures, deliberately not presented as actual EcoTrack values.
const rules: VerifiedPackersRule[] = [
  { raw: "fixture-delivered", target: "delivered" },
  { raw: "fixture-refused", target: "refused" },
  { raw: "fixture-physically-received", target: "returned", physicalReturnReceived: true },
];
const order: SyncOrder = {
  id: "order-1",
  carrier: "Packers",
  tracking_number: "TRACK-1",
  status: "shipped",
  delivered_at: null,
  refused_at: null,
  refused_reason: null,
};

describe("Packers response identity and ambiguity", () => {
  it.each([
    { tracking: "TRACK-1", status: "fixture-delivered" },
    { data: [{ tracking: "TRACK-1", status: "fixture-delivered" }] },
    { data: { orders: [{ tracking: "TRACK-1", status: "fixture-delivered" }] } },
  ])("reads supported envelopes only with exact tracking", (payload) => {
    expect(parsePackersOrder(payload, "TRACK-1")).toBe("fixture-delivered");
  });
  it.each([
    null,
    "html",
    { success: false, tracking: "TRACK-1", status: "fixture-delivered" },
    { tracking: "OTHER", status: "fixture-delivered" },
    { status: "fixture-delivered" },
    { tracking: "TRACK-1", status: { name: "fixture-delivered" } },
    { tracking: "TRACK-1", status: "fixture-delivered", statut: "fixture-refused" },
    { tracking: "TRACK-1", tracking_number: "OTHER", status: "fixture-delivered" },
    [
      { tracking: "TRACK-1", status: "fixture-delivered" },
      { tracking: "TRACK-1", status: "fixture-delivered" },
    ],
  ])("rejects wrong, missing or ambiguous identity/status", (payload) => {
    expect(parsePackersOrder(payload, "TRACK-1")).toBeNull();
  });
});

describe("verified mapping", () => {
  it("defaults to observation only, including old guessed statuses", () => {
    expect(readVerifiedPackersRules(undefined)).toEqual([]);
    for (const raw of ["livred", "returned", "retours_en_transit_stock", "unknown"]) {
      expect(packersStatusPatch(order, raw, [], "now").status).toBeUndefined();
    }
  });
  it.each(["delivered", "refused"] as const)("maps verified %s", (target) => {
    expect(packersStatusPatch(order, `fixture-${target}`, rules, "now").status).toBe(target);
  });
  it("requires explicit physical receipt evidence for returns", () => {
    expect(mapPackersStatus("returning", [{ raw: "returning", target: "returned" }])).toBeNull();
    expect(packersStatusPatch(order, "fixture-physically-received", rules, "now").status).toBe(
      "returned",
    );
  });
  it("preserves delivery dates and the explicit confirmation workflow", () => {
    expect(
      packersStatusPatch({ ...order, delivered_at: "original" }, "fixture-delivered", rules, "now")
        .delivered_at,
    ).toBe("original");
    expect(
      packersStatusPatch({ ...order, status: "confirmed" }, "fixture-delivered", rules, "now")
        .status,
    ).toBeUndefined();
  });
  it("ignores non Packers, missing tracking and terminal orders", () => {
    for (const patch of [
      { carrier: "Other" },
      { tracking_number: null },
      { tracking_number: " " },
      { status: "returned" },
    ]) {
      expect(eligiblePackersOrder({ ...order, ...patch })).toBe(false);
    }
  });
  it.each([
    "{}",
    '[{"raw":"x","target":"cancelled"}]',
    '[{"raw":"x","target":"returned"}]',
    '[{"raw":"x","target":"refused"},{"raw":"x","target":"delivered"}]',
  ])("rejects invalid contracts", (value) => {
    expect(() => readVerifiedPackersRules(value)).toThrow();
  });
});
