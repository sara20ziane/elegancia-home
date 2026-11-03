import { expect, it } from "vitest";
import { EMPTY_DRAFT } from "@/components/admin/variant-draft";
import { updateBeddingSelection } from "./bedding-presets";
import { hasPrincipalDimensions } from "./catalog-readiness";

it("ne signale pas une dimension volontairement non applicable comme manquante", () => {
  const draft = updateBeddingSelection(EMPTY_DRAFT, {
    size: "Queen size",
    set_type: "Parure de drap",
    piece_count: "3",
  });
  expect(hasPrincipalDimensions({ ...draft, bedding_provenance: draft.provenance })).toBe(true);
  expect(
    hasPrincipalDimensions({
      ...draft,
      flat_sheet_size: "",
      bedding_provenance: {
        ...draft.provenance,
        flat_sheet_size: { source: "preset", state: "unknown" },
      },
    }),
  ).toBe(false);
});
